"""
Documentation gap analyser — measures what your existing notes are missing,
before RxDx is deployed anywhere.

Reads a de-identified export of historical encounters, extracts the diseases the
clinician actually wrote using the OpenMed model, compares that against the ICD
codes that were submitted, and reports the gap in the hospital's own numbers.

    python3 gap_analyzer.py notes.csv --model <model_dir> --rxdx RxDx.html \
            --out report/ [--onnx <model.onnx>] [--limit N]

Input CSV or JSONL columns (only `note` is required):
    id, date, clinic, module, note, codes
    `codes` = the ICD codes submitted for that encounter, space or ; separated.

Outputs in --out:
    gap_report.txt        the written summary
    gap_findings.csv      one row per encounter
    gap_summary.json      machine-readable, loadable by the RxDx dashboard

Everything runs locally. No note text is written to any output file.
"""
import argparse, csv, json, os, re, sys, time
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_UNSPEC = re.compile(r"unspecified|not specified|\bNOS\b|other specified", re.I)
_STOP = {"history", "of", "the", "a", "an", "with", "and", "or", "patient", "due",
         "suspected", "possible", "likely", "probable", "evidence", "known", "for",
         "in", "on", "to", "at", "his", "her", "was", "is", "has", "had", "nos"}
# words that flip the meaning of a code — matching across a pair is a wrong code,
# not a near miss, so it is punished rather than merely unrewarded
_OPPOSED = [{"acute", "chronic"}, {"left", "right"}, {"1", "2"}, {"type1", "type2"},
            {"upper", "lower"}, {"open", "closed"}, {"benign", "malignant"},
            {"primary", "secondary"}, {"with", "without"}]

_NEG = re.compile(r"\b(no|without|denies|negative for|ruled out|rules out|excluded|"
                  r"absent|free of|no evidence of|unlikely)\b[^.;]{0,40}$", re.I)


def _norm(s):
    return re.sub(r"[^a-z0-9 ]", " ", (s or "").lower()).split()


# ICD wording that carries no clinical meaning; leaving it in makes a specific
# variant ("scorbutic anaemia") tie with the correct base code ("anaemia, unspecified")
_META = {"unspecified", "nos", "other", "site", "sites", "part", "parts", "specified",
         "type", "form", "forms", "disease", "disorder", "condition",
         "without", "complication", "complications", "mention", "elsewhere",
         "classified", "not", "and"}


def _terms(s, meta=False):
    """Keeps digits and short but decisive words — 'type 2' must survive."""
    out = frozenset(t for t in _norm(s)
                    if t not in _STOP and (len(t) > 2 or t.isdigit()))
    return out if meta else frozenset(t for t in out if t not in _META)


def _contradicts(want, dt):
    for pair in _OPPOSED:
        a_, b_ = tuple(pair)
        if (a_ in want and b_ in dt and a_ not in dt) or \
           (b_ in want and a_ in dt and b_ not in dt):
            return True
    return False


def load_icd(rxdx_html=None, icd_json=None):
    """Pulls the ICD-10-AM table straight out of RxDx so there is one source of truth."""
    if icd_json:
        rows = json.load(open(icd_json))
        return [(r["c"], r["d"], int(r.get("u") or 0)) for r in rows]
    src = open(rxdx_html, encoding="utf-8").read()
    i = src.index("const ICD = [")
    j = src.index("];", i) + 1
    arr = json.loads(src[i + len("const ICD = "):j])
    return [(r["code_id"], r["ascii_desc"], int(r.get("UnacceptPDx") or 0)) for r in arr]


class Matcher:
    """Maps a free-text disease phrase onto the closest ICD-10-AM code.

    Lexical matching alone cannot know that a bare "hypertension" means I10 and
    not maternal hypertension, so a small preferred-term table sits in front of
    it. That table is a plain CSV your coding team owns and can edit.
    """

    def __init__(self, icd, preferred=None):
        # U-chapter codes are supplementary in ICD-10-AM and are never the
        # condition a clinician wrote; excluding them removes the worst matches.
        self.icd = [r for r in icd if not r[0].startswith("U")]
        self.desc = {r[0]: r[1] for r in self.icd}
        self.bad_pdx = {r[0] for r in self.icd if len(r) > 2 and r[2] == 1}
        self.preferred = {}
        if preferred and os.path.exists(preferred):
            with open(preferred, encoding="utf-8", newline="") as f:
                for row in csv.DictReader(f):
                    ph = (row.get("phrase") or "").strip().lower()
                    cd = (row.get("code") or "").strip().upper()
                    if ph and cd:
                        self.preferred[ph] = cd
        self.toks = {}
        self.index = defaultdict(list)
        for r in self.icd:
            c, d = r[0], r[1]
            toks = _terms(d)
            if not toks:
                toks = _terms(d, meta=True)
            if not toks:
                continue
            self.toks[c] = toks
            for t in toks:
                self.index[t].append(c)

    def match(self, phrase):
        key = re.sub(r"\s+", " ", (phrase or "").strip().lower())
        if key in self.preferred:
            c = self.preferred[key]
            if c in self.desc:
                return (c, 1.0)
        want = _terms(phrase)
        if not want:
            return None
        best = self._score(want)
        # also try the head noun: "community acquired pneumonia" should still reach
        # a pneumonia code rather than settling for a poor full-phrase match
        words = [w for w in _norm(phrase) if w not in _STOP and w not in _META]
        for k in range(1, len(words)):
            alt = self._score(frozenset(words[k:]))
            if alt:
                alt = (alt[0], round(alt[1] * 0.85, 3))
                if not best or alt[1] > best[1]:
                    best = alt
                break
        return best

    def _score(self, want):
        cand = Counter()
        for t in want:
            for c in self.index.get(t, ())[:600]:
                cand[c] += 1
        if not cand:
            return None
        best, score = None, 0.0
        for c, _ in cand.most_common(120):
            dt = self.toks[c]
            inter = len(want & dt)
            if not inter:
                continue
            # reward covering the whole phrase, punish descriptions that drag in
            # unrelated words (that is what produced "scorbutic anaemia" for "anaemia")
            coverage = inter / len(want)
            noise = (len(dt) - inter) / max(len(dt), 1)
            s = coverage * (1.0 - 0.55 * noise)
            if want <= dt:
                s += 0.10
            if c in self.bad_pdx:
                s -= 0.12
            if _contradicts(want, dt):
                s -= 0.60
            # a bare term ("fever") means the generic code, not a named variant
            # ("Q fever"); the description that OPENS with the phrase is the one
            # the clinician meant
            head = _norm(self.desc[c])[:len(want)] if want else []
            if head and want <= frozenset(head):
                s += 0.06
            if "unspecified" in self.desc[c].lower():
                s += 0.04
            if s > score + 1e-9 or (abs(s - score) <= 1e-9 and best is not None
                                     and len(self.desc[c]) < len(self.desc[best])):
                best, score = c, s
        return (best, round(score, 3)) if best and score >= 0.60 else None


def read_rows(path, limit=None):
    rows = []
    if path.lower().endswith(".jsonl"):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line:
                rows.append(json.loads(line))
            if limit and len(rows) >= limit:
                break
    else:
        with open(path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                rows.append(r)
                if limit and len(rows) >= limit:
                    break
    return rows


def negated(note, span):
    return bool(_NEG.search(note[max(0, span["start"] - 60):span["start"]]))


def analyse(rows, ner, matcher, batch=8):
    findings = []
    t0 = time.time()
    # group notes of similar length together: a padded batch costs the length of
    # its longest member, so mixing a 20-token note with a 400-token one wastes
    # most of the compute
    order = sorted(range(len(rows)), key=lambda i: len(rows[i].get("note", "") or ""))
    rows = [rows[i] for i in order]
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        texts = [r.get("note", "") or "" for r in chunk]
        spans_all = (ner.extract_batch(texts) if hasattr(ner, "extract_batch")
                     else [ner.extract(t) for t in texts])
        for r, note, spans in zip(chunk, texts, spans_all):
            coded = [c.strip().upper() for c in re.split(r"[;, ]+", str(r.get("codes", "") or "")) if c.strip()]
            coded_roots = {c.split(".")[0] for c in coded}
            found, missed, neg = [], [], 0
            for s in spans:
                if negated(note, s):
                    neg += 1
                    continue
                m = matcher.match(s["text"])
                if not m:
                    continue
                code, sim = m
                found.append({"phrase": s["text"], "code": code, "similarity": sim})
                if code.split(".")[0] not in coded_roots:
                    missed.append({"phrase": s["text"], "code": code,
                                   "desc": matcher.desc[code], "similarity": sim})
            unspec = [c for c in coded if _UNSPEC.search(matcher.desc.get(c, ""))]
            unsupported = [c for c in coded
                           if c.split(".")[0] not in {f["code"].split(".")[0] for f in found}]
            findings.append({
                "id": r.get("id", ""), "date": r.get("date", ""),
                "clinic": r.get("clinic", ""), "module": r.get("module", ""),
                "note_chars": len(note),
                "diseases_written": len(spans), "diseases_negated": neg,
                "diseases_mapped": len(found), "codes_submitted": len(coded),
                "codes_unspecified": len(unspec),
                "unspecified_codes": " ".join(unspec),
                "missed_conditions": len(missed),
                "missed_detail": "; ".join("%s -> %s" % (m["phrase"], m["code"]) for m in missed[:6]),
                "codes_not_supported": len(unsupported),
                "unsupported_codes": " ".join(unsupported),
                "no_code_at_all": 1 if (spans and not coded) else 0,
            })
    findings.sort(key=lambda f: str(f.get("id", "")))
    return findings, time.time() - t0


def summarise(findings, seconds):
    n = len(findings)
    tot = lambda k: sum(f[k] for f in findings)
    with_missed = sum(1 for f in findings if f["missed_conditions"])
    with_unspec = sum(1 for f in findings if f["codes_unspecified"])
    with_unsup = sum(1 for f in findings if f["codes_not_supported"])
    nocode = sum(f["no_code_at_all"] for f in findings)
    top_missed = Counter()
    for f in findings:
        for part in filter(None, f["missed_detail"].split("; ")):
            top_missed[part.split(" -> ")[-1]] += 1
    top_unspec = Counter()
    for f in findings:
        for c in f["unspecified_codes"].split():
            top_unspec[c] += 1
    by_clinic = defaultdict(lambda: {"n": 0, "missed": 0, "unspec": 0})
    for f in findings:
        b = by_clinic[f["clinic"] or "(not stated)"]
        b["n"] += 1
        b["missed"] += f["missed_conditions"]
        b["unspec"] += f["codes_unspecified"]
    pct = lambda a: (round(a / n * 100) if n else 0)
    return {
        "encounters": n, "seconds": round(seconds, 1),
        "diseases_written": tot("diseases_written"),
        "diseases_negated": tot("diseases_negated"),
        "codes_submitted": tot("codes_submitted"),
        "missed_conditions": tot("missed_conditions"),
        "encounters_with_a_missed_condition": with_missed,
        "pct_with_a_missed_condition": pct(with_missed),
        "encounters_with_an_unspecified_code": with_unspec,
        "pct_with_an_unspecified_code": pct(with_unspec),
        "encounters_with_an_unsupported_code": with_unsup,
        "pct_with_an_unsupported_code": pct(with_unsup),
        "encounters_with_no_code": nocode,
        "top_missed_codes": top_missed.most_common(15),
        "top_unspecified_codes": top_unspec.most_common(15),
        "by_clinic": {k: v for k, v in sorted(by_clinic.items(), key=lambda x: -x[1]["missed"])},
    }


def write_report(s, matcher, out_dir, source):
    L = ["RxDx — documentation gap analysis",
         "Generated %s   ·   source: %s" % (time.strftime("%Y-%m-%d %H:%M"), os.path.basename(source)),
         "",
         "This measures the hospital's EXISTING notes. Nothing here depends on RxDx being",
         "deployed — it is the baseline against which any improvement will be judged.",
         "",
         "1. WHAT WAS READ",
         "   %s encounters analysed in %s seconds." % (f"{s['encounters']:,}", s["seconds"]),
         "   %s disease mentions found in the notes (%s of them explicitly negated and ignored)."
         % (f"{s['diseases_written']:,}", f"{s['diseases_negated']:,}"),
         "   %s ICD codes were submitted across those encounters." % f"{s['codes_submitted']:,}",
         "",
         "2. THE GAP",
         "   Conditions written in the note but never coded: %s" % f"{s['missed_conditions']:,}",
         "   Encounters with at least one such condition:    %s  (%s%%)"
         % (f"{s['encounters_with_a_missed_condition']:,}", s["pct_with_a_missed_condition"]),
         "   Encounters carrying an unspecified code:        %s  (%s%%)"
         % (f"{s['encounters_with_an_unspecified_code']:,}", s["pct_with_an_unspecified_code"]),
         "   Encounters with a code the note does not support: %s  (%s%%)"
         % (f"{s['encounters_with_an_unsupported_code']:,}", s["pct_with_an_unsupported_code"]),
         "   Encounters with disease text but no code at all:  %s" % f"{s['encounters_with_no_code']:,}",
         ""]
    if s["top_missed_codes"]:
        L += ["3. MOST FREQUENTLY MISSED CONDITIONS"]
        for c, k in s["top_missed_codes"]:
            L.append("   %-9s %-58s %s encounters" % (c, matcher.desc.get(c, "")[:58], k))
        L.append("")
    if s["top_unspecified_codes"]:
        L += ["4. UNSPECIFIED CODES IN HEAVIEST USE"]
        for c, k in s["top_unspecified_codes"]:
            L.append("   %-9s %-58s %s encounters" % (c, matcher.desc.get(c, "")[:58], k))
        L.append("")
    if len(s["by_clinic"]) > 1:
        L += ["5. BY CLINIC", "   %-28s %8s %10s %10s" % ("Clinic", "Notes", "Missed", "Unspecified")]
        for k, v in list(s["by_clinic"].items())[:20]:
            L.append("   %-28s %8s %10s %10s" % (k[:28], v["n"], v["missed"], v["unspec"]))
        L.append("")
    L += ["6. HOW TO READ THIS",
          "   'Missed' means the clinician documented the condition and the coder never",
          "   captured it. That is revenue the hospital earned and did not claim, and it is",
          "   the gap RxDx closes at the point of care rather than weeks later.",
          "",
          "   'Unsupported' is the opposite risk: a code with nothing in the note behind it.",
          "   Those are the encounters an auditor recovers money on.",
          "",
          "   Matching is automated and approximate. Before any figure goes to a board,",
          "   have a coder review a random sample of the rows in gap_findings.csv.",
          "",
          "7. DATA HANDLING",
          "   Note text was read in memory only. No clinical text appears in any output file."]
    open(os.path.join(out_dir, "gap_report.txt"), "w", encoding="utf-8").write("\n".join(L))
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("notes")
    ap.add_argument("--model", required=True)
    ap.add_argument("--rxdx"); ap.add_argument("--icd-json")
    ap.add_argument("--onnx"); ap.add_argument("--out", default="gap_out")
    ap.add_argument("--preferred", default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                        "preferred_codes.csv"))
    ap.add_argument("--limit", type=int); ap.add_argument("--batch", type=int, default=8)
    a = ap.parse_args()
    if not (a.rxdx or a.icd_json):
        raise SystemExit("Pass --rxdx RxDx.html (or --icd-json) so the ICD-10-AM table can be loaded.")
    os.makedirs(a.out, exist_ok=True)
    from openmed_ner import DiseaseNER, OnnxDiseaseNER
    ner = OnnxDiseaseNER(a.model, a.onnx) if a.onnx else DiseaseNER(a.model)
    matcher = Matcher(load_icd(a.rxdx, a.icd_json), a.preferred)
    rows = read_rows(a.notes, a.limit)
    print("analysing %d encounters..." % len(rows), flush=True)
    findings, secs = analyse(rows, ner, matcher, a.batch)
    with open(os.path.join(a.out, "gap_findings.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(findings[0].keys()))
        w.writeheader(); w.writerows(findings)
    s = summarise(findings, secs)
    json.dump(s, open(os.path.join(a.out, "gap_summary.json"), "w"), indent=1)
    print(write_report(s, matcher, a.out, a.notes))


if __name__ == "__main__":
    main()
