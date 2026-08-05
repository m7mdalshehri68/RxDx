"""
OpenMed disease NER — dependency-light inference.

Runs an OpenMed BertForTokenClassification checkpoint with numpy only:
no torch, no GPU, no network. Reads model.safetensors directly.

  from openmed_ner import DiseaseNER
  ner = DiseaseNER("/path/to/OpenMed-NER-DiseaseDetect-BioMed")
  ner.extract("Patient with type 2 diabetes and diabetic nephropathy.")
  -> [{'text': 'type 2 diabetes', 'start': 13, 'end': 28, 'score': 0.99}, ...]

Everything stays on this machine. No clinical text leaves the process.
"""
import json, struct, os
import numpy as np

try:
    import ml_dtypes
    _BF16 = ml_dtypes.bfloat16
except Exception:                                    # pragma: no cover
    _BF16 = None

_DTYPES = {"F32": np.float32, "F16": np.float16, "I64": np.int64, "BOOL": np.bool_}


def _load_safetensors(path):
    """Memory-maps a .safetensors file and returns {name: float32 ndarray}."""
    with open(path, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(n))
        data_start = 8 + n
    blob = np.memmap(path, dtype=np.uint8, mode="r")
    out = {}
    for name, meta in header.items():
        if name == "__metadata__":
            continue
        lo, hi = meta["data_offsets"]
        raw = blob[data_start + lo: data_start + hi]
        if meta["dtype"] == "BF16":
            if _BF16 is not None:
                arr = raw.view(_BF16).astype(np.float32)
            else:                                     # widen bf16 -> f32 by hand
                u16 = raw.view(np.uint16).astype(np.uint32)
                arr = (u16 << 16).view(np.float32)
        else:
            dt = _DTYPES.get(meta["dtype"])
            if dt is None:
                raise ValueError("unsupported dtype %s for %s" % (meta["dtype"], name))
            arr = raw.view(dt).astype(np.float32)
        out[name] = arr.reshape(meta["shape"])
    return out


class LazyWeights:
    """Reads one tensor at a time from a .safetensors file — never holds the
    whole model in RAM. Used by the ONNX exporter on small machines."""

    def __init__(self, path):
        self.path = path
        with open(path, "rb") as f:
            n = struct.unpack("<Q", f.read(8))[0]
            self.header = json.loads(f.read(n))
            self.start = 8 + n
        self.header.pop("__metadata__", None)
        self._blob = np.memmap(path, dtype=np.uint8, mode="r")

    def __contains__(self, k):
        return k in self.header

    def keys(self):
        return self.header.keys()

    def __getitem__(self, name):
        meta = self.header[name]
        lo, hi = meta["data_offsets"]
        raw = self._blob[self.start + lo: self.start + hi]
        if meta["dtype"] == "BF16":
            if _BF16 is not None:
                arr = raw.view(_BF16).astype(np.float32)
            else:
                u16 = raw.view(np.uint16).astype(np.uint32)
                arr = (u16 << 16).view(np.float32)
        else:
            arr = raw.view(_DTYPES[meta["dtype"]]).astype(np.float32)
        return arr.reshape(meta["shape"])


def _gelu(x):
    return 0.5 * x * (1.0 + np.tanh(0.7978845608028654 * (x + 0.044715 * x ** 3)))


def _layer_norm(x, w, b, eps):
    mu = x.mean(-1, keepdims=True)
    var = x.var(-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * w + b


def _softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)


class DiseaseNER:
    def __init__(self, model_dir, max_len=None):
        self.dir = model_dir
        self.cfg = json.load(open(os.path.join(model_dir, "config.json")))
        if self.cfg.get("model_type") != "bert":
            raise ValueError(
                "This runner supports BERT checkpoints. %r is %s — export it to ONNX "
                "and serve it with onnxruntime instead." % (model_dir, self.cfg.get("model_type"))
            )
        from tokenizers import Tokenizer
        self.tok = Tokenizer.from_file(os.path.join(model_dir, "tokenizer.json"))
        # the packaged tokenizer pads to 512; padding here would multiply the
        # compute by ~10x for a short note and adds nothing to the result
        try:
            self.tok.no_padding()
            self.tok.no_truncation()
        except Exception:
            pass
        self.W = _load_safetensors(os.path.join(model_dir, "model.safetensors"))
        self.id2label = {int(k): v for k, v in self.cfg["id2label"].items()}
        self.H = self.cfg["hidden_size"]
        self.heads = self.cfg["num_attention_heads"]
        self.layers = self.cfg["num_hidden_layers"]
        self.eps = self.cfg.get("layer_norm_eps", 1e-12)
        self.max_len = max_len or self.cfg.get("max_position_embeddings", 512)
        self.cls_id = self.tok.token_to_id("[CLS]")
        self.sep_id = self.tok.token_to_id("[SEP]")

    # ---------------- forward pass ----------------
    def _encode_block(self, ids):
        W, H, nh = self.W, self.H, self.heads
        dh = H // nh
        x = W["bert.embeddings.word_embeddings.weight"][ids]
        x = x + W["bert.embeddings.position_embeddings.weight"][: len(ids)]
        x = x + W["bert.embeddings.token_type_embeddings.weight"][0]
        x = _layer_norm(x, W["bert.embeddings.LayerNorm.weight"],
                        W["bert.embeddings.LayerNorm.bias"], self.eps)
        for i in range(self.layers):
            p = "bert.encoder.layer.%d." % i
            q = x @ W[p + "attention.self.query.weight"].T + W[p + "attention.self.query.bias"]
            k = x @ W[p + "attention.self.key.weight"].T + W[p + "attention.self.key.bias"]
            v = x @ W[p + "attention.self.value.weight"].T + W[p + "attention.self.value.bias"]
            L = x.shape[0]
            q = q.reshape(L, nh, dh).transpose(1, 0, 2)
            k = k.reshape(L, nh, dh).transpose(1, 0, 2)
            v = v.reshape(L, nh, dh).transpose(1, 0, 2)
            att = _softmax(q @ k.transpose(0, 2, 1) / np.sqrt(dh), -1)
            ctx = (att @ v).transpose(1, 0, 2).reshape(L, H)
            ctx = ctx @ W[p + "attention.output.dense.weight"].T + W[p + "attention.output.dense.bias"]
            x = _layer_norm(ctx + x, W[p + "attention.output.LayerNorm.weight"],
                            W[p + "attention.output.LayerNorm.bias"], self.eps)
            h = _gelu(x @ W[p + "intermediate.dense.weight"].T + W[p + "intermediate.dense.bias"])
            h = h @ W[p + "output.dense.weight"].T + W[p + "output.dense.bias"]
            x = _layer_norm(h + x, W[p + "output.LayerNorm.weight"],
                            W[p + "output.LayerNorm.bias"], self.eps)
        return _softmax(x @ W["classifier.weight"].T + W["classifier.bias"], -1)

    # ---------------- public API ----------------
    def extract(self, text, threshold=0.5):
        """Returns disease spans as [{text, start, end, score}] with character offsets."""
        if not text or not text.strip():
            return []
        enc = self.tok.encode(text, add_special_tokens=False)
        ids, offs = enc.ids, enc.offsets
        room = self.max_len - 2
        spans, cursor = [], 0
        while cursor < len(ids):
            chunk_ids = [self.cls_id] + ids[cursor: cursor + room] + [self.sep_id]
            chunk_off = [(0, 0)] + offs[cursor: cursor + room] + [(0, 0)]
            probs = self._encode_block(np.asarray(chunk_ids, dtype=np.int64))
            spans += self._decode(probs, chunk_off, text, threshold)
            cursor += room
        return self._merge(spans, text)

    def _decode(self, probs, offsets, text, threshold):
        out, cur = [], None
        for i in range(1, len(offsets) - 1):
            lab = self.id2label.get(int(probs[i].argmax()), "O")
            score = float(probs[i].max())
            s, e = offsets[i]
            if lab == "O" or score < threshold:
                if cur:
                    out.append(cur); cur = None
                continue
            if lab.startswith("B-") or cur is None:
                if cur:
                    out.append(cur)
                cur = {"start": s, "end": e, "scores": [score]}
            else:
                cur["end"] = e
                cur["scores"].append(score)
        if cur:
            out.append(cur)
        out = [c for c in out if c["end"] > c["start"]]
        for c in out:
            c["text"] = text[c["start"]:c["end"]]
            c["score"] = round(sum(c["scores"]) / len(c["scores"]), 4)
            del c["scores"]
        return [c for c in out if c["text"].strip()]

    @staticmethod
    def _merge(spans, text):
        """Joins spans separated only by whitespace/hyphen and drops duplicates."""
        spans = sorted(spans, key=lambda x: (x["start"], x["end"]))
        out = []
        for s in spans:
            if out and s["start"] - out[-1]["end"] <= 1 and \
               text[out[-1]["end"]:s["start"]].strip(" -") == "":
                out[-1]["end"] = max(out[-1]["end"], s["end"])
                out[-1]["text"] = text[out[-1]["start"]:out[-1]["end"]]
                out[-1]["score"] = round(min(out[-1]["score"], s["score"]), 4)
            elif not (out and s["start"] < out[-1]["end"]):
                out.append(s)
        return out


class OnnxDiseaseNER(DiseaseNER):
    """Same API as DiseaseNER, ~20x faster, backed by an ONNX export.

    One aggressive onnxruntime fusion mis-rewrites this graph, so the session is
    pinned to the BASIC optimisation level — verified numerically identical to
    the reference implementation.
    """

    def __init__(self, model_dir, onnx_path=None, threads=None):
        import onnxruntime as ort
        self.dir = model_dir
        self.cfg = json.load(open(os.path.join(model_dir, "config.json")))
        from tokenizers import Tokenizer
        self.tok = Tokenizer.from_file(os.path.join(model_dir, "tokenizer.json"))
        try:
            self.tok.no_padding(); self.tok.no_truncation()
        except Exception:
            pass
        self.id2label = {int(k): v for k, v in self.cfg["id2label"].items()}
        self.max_len = self.cfg.get("max_position_embeddings", 512)
        self.cls_id = self.tok.token_to_id("[CLS]")
        self.sep_id = self.tok.token_to_id("[SEP]")
        onnx_path = onnx_path or os.path.join(model_dir, "onnx", "model.onnx")
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        if threads:
            so.intra_op_num_threads = int(threads)
        self.sess = ort.InferenceSession(onnx_path, so, providers=["CPUExecutionProvider"])

    def _encode_block(self, ids):
        ids = np.asarray(ids, dtype=np.int64).reshape(1, -1)
        out = self.sess.run(["logits"], {
            "input_ids": ids,
            "attention_mask": np.ones_like(ids),
            "token_type_ids": np.zeros_like(ids)})[0][0]
        return _softmax(out, -1)

    def extract_batch(self, texts, threshold=0.5):
        """Runs several notes in one padded batch — the fast path for bulk work."""
        prepared = []
        for text in texts:
            enc = self.tok.encode(text or "", add_special_tokens=False)
            ids = enc.ids[: self.max_len - 2]
            offs = enc.offsets[: self.max_len - 2]
            prepared.append(([self.cls_id] + ids + [self.sep_id], [(0, 0)] + offs + [(0, 0)]))
        width = max((len(p[0]) for p in prepared), default=2)
        I = np.zeros((len(prepared), width), np.int64)
        A = np.zeros((len(prepared), width), np.int64)
        for r, (ids, _) in enumerate(prepared):
            I[r, :len(ids)] = ids
            A[r, :len(ids)] = 1
        logits = self.sess.run(["logits"], {
            "input_ids": I, "attention_mask": A,
            "token_type_ids": np.zeros_like(I)})[0]
        results = []
        for r, (ids, offs) in enumerate(prepared):
            probs = _softmax(logits[r, :len(ids)], -1)
            spans = self._decode(probs, offs, texts[r] or "", threshold)
            results.append(self._merge(spans, texts[r] or ""))
        return results
