"""Bupa Arabia — Prerequisites Medical Information for Pre-Authorization (46 pages),
written out as RxDx requirement sets.

Every entry in the document becomes one set. `bx` keeps the codes exactly as Bupa
printed them; `px` holds the prefixes RxDx matches on in ICD-10-AM. Where the two
differ the reason is recorded in `fix`, so management can raise it with Bupa.

    python3 bupa_prereq_build.py > bupa_sets.json
"""
import json, re, sys

# ── evidence patterns: what in a note counts as the answer ──────────────────
E = dict(
    HX=r"history|presented|presents|complain|c/o|\bHPI\b|\bHPC\b|since|for \d+ ?(day|week|month|year)|\d+ ?(days?|weeks?|months?|years?) (ago|history)",
    EXAM=r"exam|O/E|on examination|tender|auscultat|palpat|inspection|range of motion|\bROM\b|reflex|power|strength|neurolog|chest clear|abdomen soft|\bDRE\b",
    PROVDX=r"impression|provisional|diagnos|assessment|\bdx\b|differential|\bddx\b|likely|suspected",
    TRAUMA=r"trauma|injur|\bfall\b|\bfell\b|accident|\bRTA\b|twist|struck|hit by|sport|atraumatic|non-?traumatic",
    LABS=r"\blab|result|level|\bCBC\b|\bFBC\b|\bCRP\b|HbA1c|creatinine|\bLFTs?\b|\bKFT\b|\bRFT\b|electrolyte|culture|marker",
    PRIORIMG=r"x-?ray|\bXR\b|ultrasound|\bUSS?\b|sonograph|\bCT\b|\bMRI\b|previous (imaging|scan)|prior (imaging|scan)",
    IMG=r"x-?ray|\bXR\b|ultrasound|\bUSS?\b|sonograph|\bCT\b|\bMRI\b|radiolog|imaging|scan",
    USCTMRI=r"ultrasound|\bUSS?\b|sonograph|\bCT\b|\bMRI\b|imaging",
    VITALS=r"\bBP\b|blood pressure|\bHR\b|pulse|heart rate|\bRR\b|resp(iratory)? rate|SpO2|O2 sat|saturation|temperature|\btemp\b|vital",
    VSC=r"vital signs? chart|vitals? chart|\bVSC\b|observation chart|obs chart|vital|\bBP\b",
    PLAN=r"\bplan\b|management|surgery|operat|fixation|\bORIF\b|conservative|physio|refer|admit|\bcast\b|brace|arthroplast|arthroscop",
    CLASSIF=r"classif|grade|type [IVX0-9]|Weber|Gustilo|Garden|Neer|Sanders|Hawkins|Lauge|Denis|\bAO\b|Pipkin|Evans|Schatzker|Meyerding|Lenke|Kellgren|\bKL\b|Tile|Letournel|Young-?Burgess|\bstable\b|\bunstable\b",
    INITMGMT=r"analges|NSAID|paracetamol|physio|medication|treated|conservative|\brest\b|brace|trial|tried|failed|initial management|previous (treatment|management)|antibiotic|steroid|injection",
    DUR=r"\bfor \d+|since|\d+ ?(days?|weeks?|months?|years?)|duration|onset|chronic",
    CBC=r"\bCBC\b|\bFBC\b|full blood count|complete blood count|\bHb\b|ha?emoglobin|\bWBC\b|platelet",
    CRP=r"\bCRP\b|C-?reactive",
    ESR=r"\bESR\b|sedimentation",
    ELEC=r"electrolyte|\bNa\b|sodium|potassium|\bU&E\b",
    ABG=r"\bABG\b|\bVBG\b|blood gas",
    UA=r"urin(e|alysis)|\bUA\b|urine R/?E|dipstick",
    STOOL=r"stool",
    CALPRO=r"calprotectin",
    FOBT=r"\bFOBT\b|occult blood|\bFIT\b",
    HPYLORI=r"pylori|\bHP stool|urea breath",
    INR=r"\bINR\b|prothrombin|\bPT/|coag",
    LFT=r"\bLFTs?\b|liver function|\bALT\b|\bAST\b|bilirubin|\bALP\b",
    KFT=r"\bKFT\b|\bRFT\b|renal function|kidney function|creatinine|\burea\b|\bBUN\b|eGFR",
    BILI=r"bilirubin",
    BHCG=r"hCG|beta ?hcg|b-?hCG",
    TVUS=r"\bTVUS\b|transvaginal|\bTVS\b|\bTV ?US\b",
    US=r"ultrasound|\bUSS?\b|sonograph|\bscan\b",
    CTG=r"\bCTG\b|cardiotocograph",
    PARTO=r"partogra",
    ECG=r"\bECG\b|\bEKG\b",
    ECHO=r"\becho",
    HOLTER=r"holter|event monitor|ambulatory ECG|loop recorder",
    TROP=r"troponin|\btrop\b",
    MEDREPORT=r"report|history|presented|complain|gravida|\bG\d|\bP\d|\bLMP\b",
    MEDHX=r"medication|drug history|current (meds|medications)|\bon (metformin|insulin|amlodipine|aspirin|statin|inhaler)|\bmeds\b",
    DRUGHX=r"drug history|medication|\bNSAID|aspirin|anticoagul|warfarin|clopidogrel|\bmeds\b",
    SIMILAR=r"similar (attack|episode)|previous (episode|attack|bleed)|recurrent|first episode|no previous",
    DRE=r"\bDRE\b|\bPR exam|per rectal|digital rectal|rectal exam",
    ALARM=r"alarm|red flag|weight loss|dysphagia|melaena|melena|haematemesis|hematemesis|anaemia|anemia|no alarm",
    NEURO=r"neurolog|\bGCS\b|power|cranial nerve|plantar|focal|sensation|reflex",
    CTBRAIN=r"CT (brain|head)|MRI (brain|head)|\bCT\b|\bMRI\b",
    MRACTA=r"\bMRA\b|\bCTA\b|angiogra",
    GROWTHCHART=r"growth chart|centile|percentile|height velocity|z-?score",
)

def Q(text, ev, **kw):
    q = {"q": text, "ev": E.get(ev, ev)}
    q.update(kw)
    return q

def opt(text, ev, **kw):
    return Q(text, ev, opt=1, **kw)

SETS = []

def add(id, t, sec, page, q, bx=None, px=None, cx=None, svc=None, on=None, no=None,
        age=None, sex=None, fix=None, sp=None):
    s = {"id": "b-" + id, "t": t, "sp": sp or sec, "sec": sec, "pay": ["bupa"],
         "src": "Bupa Prerequisites p.%d" % page, "q": q}
    if bx: s["bx"] = bx
    if px: s["px"] = px
    if cx: s["cx"] = cx
    if svc: s["svc"] = svc
    if on: s["on"] = on
    if no: s["no"] = no
    if age: s["age"] = age
    if sex: s["sex"] = sex
    if fix: s["fix"] = fix
    SETS.append(s)

# ── Services (pp. 3–10) ─────────────────────────────────────────────────────
def img_set(id, name, page, bx, svc):
    add(id, name, "Imaging", page, [
        Q("Comprehensive history and examination findings, stating the indication for the " + name + " and the relevant past medical and surgical history?", r"indication|history|exam|O/E"),
        opt("Trauma history relevant to the complaint, if there was trauma?", "TRAUMA"),
        Q("Clear provisional diagnosis?", "PROVDX"),
        opt("Lab results that support the suspected diagnosis, if any?", "LABS"),
        opt("Initial or previous relevant imaging (ultrasound or X-ray), if done?", "PRIORIMG"),
    ], bx=bx, svc=svc, on="svc")

img_set("mri", "MRI", 3, ["M23", "M51", "M75", "M17", "R51", "R22", "G43", "C71", "M54"], [r"\bMRI\b|magnetic resonance"])
img_set("ct", "CT scan", 3, ["R55", "R51", "I61.9", "I63.9", "C71.9", "R10", "K35"], [r"\bCT\b|computed tomograph"])

LAB_BX = ["E11", "R53", "E55", "E03", "E05", "D50"]
add("lab-hba1c", "HbA1c test", "Labs", 4, [
    Q("History of the present illness or medication history that makes HbA1c relevant — and RBS or FBS reports if available?", r"diabet|polyuria|polydipsia|glucose|\bRBS\b|\bFBS\b|metformin|insulin|medication"),
], bx=LAB_BX, px=["E11", "E10", "E13", "E14", "R73"], svc=[r"hba1c|\ba1c\b|glycated|glycosylated"], on="svc")
add("lab-vitd", "Vitamin D test", "Labs", 4, [
    Q("The medical indication for testing vitamin D in this patient — stated, with the evidence?", r"vitamin d|vit d|osteopor|osteomalac|rickets|fracture|malabsorp|bone pain|fatigue|deficien|indication"),
], bx=LAB_BX, px=["E55", "M81", "M83"], svc=[r"vitamin d (level|test)|vit\.? ?d (level|test)|25-?OH|serum vitamin d|check (vitamin|vit\.?) ?d"], on="svc")
add("lab-fshlh", "FSH and LH", "Labs", 4, [
    Q("Initial prolactin and TSH reports, and the clinical examination?", r"prolactin|\bTSH\b"),
    Q("Relevant to what — irregular menstruation, infertility, PCOS, premature ovarian failure, menopause, or another reason? State which.", r"irregular|oligomenor|amenor|infertil|\bPCOS\b|polycystic|ovarian (failure|insufficiency)|menopaus|subfertil"),
], bx=LAB_BX, svc=[r"\bFSH\b|\bLH\b|gonadotroph"], on="svc")
add("lab-t4t3", "Free T4 and T3", "Labs", 4, [
    Q("TSH report — in a suspected case of primary hypothyroidism?", r"\bTSH\b"),
], bx=LAB_BX, px=["E03", "E05"], svc=[r"\bf?T4\b|\bf?T3\b|thyroxine level|triiodothyronine"], on="svc")
add("lab-ferritin", "Ferritin and iron studies", "Labs", 4, [
    Q("CBC report?", "CBC"),
    Q("Detailed history of the present illness, medication history and the relevant examination findings?", r"history|medication|exam|pallor|fatigue|menorrhag|bleed"),
], bx=LAB_BX, px=["D50", "D64", "R53"], svc=[r"ferritin|iron studies|serum iron|\bTIBC\b|transferrin"], on="svc",
    no=["Not applied in cases of iron overload."])

add("physio", "Physiotherapy sessions", "Physiotherapy", 4, [
    Q("Detailed history — duration of illness, the primary cause of the complaint, and the initial management given?", r"(since|for \d+|duration|weeks|months)[\s\S]*(cause|after|due to|injur|strain|degenerat|surgery)|initial management|treated with|analges|NSAID"),
    Q("Physical examination findings — range of motion, reflexes, strength?", r"range of motion|\bROM\b|reflex|strength|power|flexion|extension|abduction|straight leg"),
    Q("Radiology report — X-ray, CT or MRI?", r"x-?ray|\bXR\b|\bCT\b|\bMRI\b|radiolog"),
    Q("Detailed treatment plan — the physiotherapy modalities, the number of sessions and the goals — with a follow-up assessment report?", r"sessions?|modalit|TENS|ultrasound therapy|exercise|goal|frequency|\d+ ?x ?(per|/) ?week"),
], bx=["M54", "M23", "M17", "M75", "M25", "M77", "M76", "G83.4", "G35", "R26.89", "R39.81", "M40"],
    svc=[r"physiotherap|physical therap|\bPT session|rehabilitation|\bphysio\b"], on="svc",
    fix=["R26.89 and R39.81 are ICD-10-CM codes; ICD-10-AM uses R26.8 and R39.8."])

EQ_BX = ["E11", "E10", "I10", "I11", "J45", "J40", "H90", "H91", "G47.33", "G47.20", "E10", "E11"]
EQ_FIX = ["Bupa prints one code list for all six devices. G47.33 and G47.20 are ICD-10-CM codes: in ICD-10-AM G47.33 is sleep hypoventilation syndrome and G47.20 does not exist; obstructive sleep apnoea is G47.3."]
add("dev-glucometer", "Glucometer device", "Medical equipment", 5, [
    Q("RBS, FBS or HbA1c result — or the medication history?", r"\bRBS\b|\bFBS\b|HbA1c|A1c|glucose|metformin|insulin|medication"),
], fix=EQ_FIX, bx=EQ_BX, px=["E10", "E11", "E13", "E14", "O24"], svc=[r"glucometer|gluco-?meter|glucose meter|test strips|lancet"], on="svc")
add("dev-bp", "Blood pressure machine", "Medical equipment", 5, [
    Q("Three blood pressure readings taken on different occasions?", r"\d{2,3}\s*/\s*\d{2,3}[\s\S]*?\d{2,3}\s*/\s*\d{2,3}[\s\S]*?\d{2,3}\s*/\s*\d{2,3}"),
], fix=EQ_FIX, bx=EQ_BX, px=["I10", "I11", "I12", "I13", "I15"], svc=[r"BP (machine|monitor|device|apparatus)|blood pressure (machine|monitor|device)|sphygmomanometer"], on="svc")
add("dev-nebuliser", "Nebuliser device", "Medical equipment", 5, [
    Q("Clinical findings and the diagnosis?", r"wheez|asthma|COPD|bronch|exam|O/E|diagnos|impression"),
], fix=EQ_FIX, bx=EQ_BX, px=["J45", "J44", "J40", "J41", "J42", "J43"], svc=[r"nebuli[sz]er"], on="svc")
add("dev-hearing", "Hearing aid device", "Medical equipment", 5, [
    Q("Audiometry?", r"audiogra|audiometr|pure tone|\bPTA\b"),
    opt("Tympanometry, if applicable?", r"tympanometr|tympanogram"),
], fix=EQ_FIX, bx=EQ_BX, px=["H90", "H91"], svc=[r"hearing aid"], on="svc")
add("dev-cpap", "CPAP for obstructive sleep apnoea", "Medical equipment", 5, [
    Q("Sleep study report?", r"sleep study|polysomnogra|\bPSG\b|\bAHI\b|apnoea-hypopnoea|apnea-hypopnea"),
], bx=EQ_BX, px=["G47.3"], svc=[r"\bCPAP\b"], on="svc",
    fix=EQ_FIX)
add("dev-insulinpump", "Insulin pump therapy", "Medical equipment", 5, [
    Q("Documented treatment with multiple daily injections for at least 6 months, including the drug prescriptions?", r"(multiple daily injection|\bMDI\b|basal[- ]bolus)[\s\S]*(6|six) months|(6|six) months[\s\S]*(multiple daily injection|\bMDI\b|basal[- ]bolus)"),
    Q("Documented blood glucose readings for the last two months?", r"glucose (log|diary|readings)|\bSMBG\b|\bCGM\b|blood glucose readings|glucometer readings"),
    Q("Visit reports showing attempts to adjust the insulin and the patient's self-management?", r"dose adjust|titrat|insulin adjust|adjusted (the )?(insulin|dose)|self-?management"),
    Q("Report confirming the patient completed a diabetes education programme — self-care and follow-up?", r"diabetes education|\bDSME\b|education (programme|program)|educator"),
    Q("At least two HbA1c results, each recent (within 3 months) and at least 3 months apart?", r"(HbA1c|A1c)[\s\S]*(HbA1c|A1c)"),
], fix=EQ_FIX, bx=EQ_BX, px=["E10", "E11", "E13"], svc=[r"insulin pump|\bCSII\b"], on="svc")

add("surg-general", "Surgery or procedure — general", "Surgery", 6, [
    Q("Imaging report — ultrasound, CT or MRI?", "USCTMRI"),
    Q("Clinical examination?", "EXAM"),
    opt("Relevant lab tests or tumour markers, if available?", r"\blab|\bCBC\b|marker|\bCEA\b|\bCA ?19|\bCA ?125|\bAFP\b|thyroglobulin|calcitonin|\bTFT|result"),
], bx=["K40", "K80", "K82.8", "K64", "K61", "C18.9", "D17.1", "C44.319", "K56.6", "E04.2", "C73"],
    px=["K40", "K80", "K82", "K64", "K61", "C18", "D17", "C44", "K56", "E04", "C73"],
    svc=[r"hernia repair|herniorrhaph|hernioplast|cholecystectom|haemorrhoidectom|hemorrhoidectom|fistulotom|fistulectom|thyroidectom|excision|colectom|hemicolectom|resection|laparoscop"], on="svc",
    fix=["C44.319 is an ICD-10-CM code; ICD-10-AM uses C44.3 for skin of other parts of the face."])
add("surg-ophtha", "Surgery or procedure — ophthalmology", "Surgery", 6, [
    Q("Detailed history — the aetiology, the previous management, and the examination findings?", r"history|aetiolog|etiolog|previous (treatment|management)|drops|visual acuity|\bVA\b|\bIOP\b|slit lamp|fundus|exam"),
    opt("OCT report — in glaucoma, not mandatory?", r"\bOCT\b|optical coherence"),
], bx=["H25", "H40", "H26.9", "H43.1"], px=["H25", "H26", "H40", "H43"],
    svc=[r"phaco|cataract (surgery|extraction)|trabeculectom|vitrectom|glaucoma surgery|\bIOL\b|laser (iridotomy|trabeculoplasty)"], on="svc")
add("surg-ortho", "Surgery or procedure — orthopaedics", "Surgery", 7, [
    Q("Clinical history — duration, the primary cause, and the initial management if any?", r"(since|for \d+|duration|weeks|months|years)|initial management|treated with|analges|physio"),
    Q("Physical examination — range of motion, reflexes, strength, deformities?", r"range of motion|\bROM\b|reflex|strength|power|deformit|flexion|swelling|tender"),
    Q("Radiology report — X-ray, CT or MRI?", r"x-?ray|\bXR\b|\bCT\b|\bMRI\b|radiolog"),
], bx=["M23", "M51", "M75", "M17", "M54"],
    svc=[r"arthroscop|arthroplast|meniscectom|\bACL\b|discectom|laminectom|rotator cuff repair|decompression|spinal fusion|joint replacement"], on="svc")
add("endoscopy", "Endoscopy or gastroscopy", "Endoscopy", 7, [
    Q("Detailed history stating the indication, including any alarm symptoms, and the relevant examination findings?", r"indication|alarm|dyspeps|epigastric|dysphag|weight loss|haematemesis|hematemesis|melaena|melena|anaemia|anemia|reflux|vomit"),
    opt("Lab reports — CBC, H. pylori, stool occult blood, coeliac antibodies — if relevant?", r"\bCBC\b|pylori|occult blood|\bFOBT\b|coeliac|celiac|\bTTG\b|anti-?tTG"),
    opt("Initial radiology — barium swallow or ultrasound — if done?", r"barium|ultrasound|\bUSS?\b"),
], bx=["K29", "K21", "K25.9", "R11", "D13.1", "R12", "C16.9", "R10"], px=["K29", "K21", "K25", "R11", "D13", "R12", "C16", "R10"],
    svc=[r"\bendoscopy\b|gastroscop|\bOGD\b|\bEGD\b|upper GI scope|oesophagogastroduodenoscop|esophagogastroduodenoscop"], on="svc")
add("surg-abdominal", "Surgery or procedure — abdominal area", "Surgery", 8, [
    Q("Imaging report — ultrasound, CT or MRI?", "USCTMRI"),
    Q("Clinical examination?", "EXAM"),
    opt("Supportive lab reports or tumour markers, if relevant?", r"\blab|\bCBC\b|\bCRP\b|marker|\bCEA\b|\bCA ?19|result"),
], bx=["K35", "K36", "K80", "K40.20", "K42.9", "K57.3", "C18.9", "K66.1", "K65", "R18.8", "K63.89", "D13.4", "D17.5", "R19", "K66"],
    px=["K35", "K36", "K80", "K40", "K42", "K57", "C18", "K66", "K65", "R18", "K63", "D13", "D17", "R19"],
    svc=[r"appendicectom|appendectom|laparotom|laparoscop|hernia repair|cholecystectom|colectom|resection|adhesiolysis"], on="svc",
    fix=["R18.8 and K63.89 are ICD-10-CM codes; ICD-10-AM has R18 (ascites) and K63.8 (other specified diseases of intestine)."])
add("cs-delivery", "Caesarean delivery", "Obstetrics", 8, [
    opt("CTG, with or without ultrasound — in cases of fetal distress?", r"\bCTG\b|cardiotocograph|fetal (distress|heart)|\bFHR\b"),
    opt("Partogram — for an emergency caesarean for failure to progress?", r"partogra|failure to progress|arrest of (labour|labor)|obstructed"),
    Q("Detailed history — current and previous antenatal care, labour and postnatal care — and the indication for the caesarean?", r"indication|previous (CS|caesarean|cesarean|LSCS)|breech|placenta|fetal distress|failure to progress|antenatal|\bANC\b"),
], bx=["O82", "O34.21", "O68.0"], px=["O82", "O34", "O68"], sex="F", age=[10, 60],
    svc=[r"caesarean|cesarean|\bC-?section\b|\bLSCS\b|\bCS\b delivery|\bCSD\b"], on="svc",
    fix=["O34.21 is an ICD-10-CM code; ICD-10-AM uses O34.2 for maternal care due to a uterine scar from previous surgery."])
add("colonoscopy", "Colonoscopy", "Endoscopy", 9, [
    Q("Relevant lab and imaging that support the indication — FOBT, calprotectin, CT, barium enema?", r"\bFOBT\b|occult blood|\bFIT\b|calprotectin|\bCT\b|barium|\blab"),
    Q("Detailed history and examination, stating any alarm symptoms or signs and the indication for colonoscopy?", r"indication|alarm|rectal bleed|bleeding per rectum|\bPR bleed|weight loss|change in bowel|anaemia|anemia|family history|screening"),
], bx=["R10", "K57.3", "D12.6", "K52.9", "K51.9", "R19.7", "K50.9"], px=["R10", "K57", "D12", "K52", "K51", "R19", "K50"],
    svc=[r"colonoscop|sigmoidoscop"], on="svc",
    fix=["R19.7 is an ICD-10-CM code (diarrhoea, unspecified); ICD-10-AM codes that as K59.1 or A09.9 depending on cause."])
add("surg-renal", "Surgery or procedure — renal", "Surgery", 9, [
    Q("Detailed history — how long the complaint has lasted, and the relevant previous medical and surgical history?", r"(since|for \d+|duration|weeks|months|years)|previous (stone|surgery|lithotrips|ureteroscop)|history"),
    Q("Imaging report — CT KUB?", r"\bCT\b.{0,10}\bKUB\b|\bCTKUB\b|CT urogra|\bKUB\b"),
], bx=["N18.1", "N18.2", "N17", "N04.9", "N20", "N23", "N39"], px=["N18", "N17", "N04", "N20", "N23", "N39"],
    svc=[r"lithotrips|\bESWL\b|ureteroscop|\bURS\b|\bPCNL\b|nephrectom|\bDJ\b|\bJJ\b|ureteric stent|cystoscop"], on="svc")
add("tonsillectomy", "Tonsillectomy", "ENT", 10, [
    opt("Initial radiology — lateral neck X-ray — if relevant, for example when adenoidectomy is requested?", r"lateral (neck|soft tissue)|x-?ray|\bXR\b|adenoid"),
    Q("Detailed history and examination stating the indication for surgery?", r"indication|episodes|attacks|per year|recurrent|obstruct|snor|apnoea|apnea|hypertroph|quinsy|peritonsillar|tonsil"),
    Q("Initial management?", r"antibiotic|penicillin|amoxicillin|treated|initial management|medical (treatment|management)"),
], bx=["J03.9", "J03", "J35.1", "J35.02", "J35.2", "J36"], px=["J03", "J35", "J36"],
    svc=[r"tonsillectom|adenoidectom|adenotonsillectom"], on="svc",
    fix=["J35.02 is an ICD-10-CM code; ICD-10-AM has J35.0 (chronic tonsillitis)."])
add("admission", "Admission", "Admissions", 10, [
    Q("Vital signs chart?", "VSC"),
    Q("Lab reports?", "LABS"),
    Q("Radiology report?", "IMG"),
    Q("Detailed history and examination stating the indication for admission?", r"indication for admission|admit(ted)? (for|due to|because)|requires admission|admission (for|due to)|unable to|failed outpatient|IV (antibiotic|fluid)|monitor"),
], bx=["R10", "J18.9", "K35.8", "R07", "I16", "A09", "I63"], px=["R10", "J18", "K35", "R07", "I10", "A09", "I63"],
    svc=[r"\badmi(t|ss)|\bIPD\b|inpatient|to the ward"], on="svc",
    fix=["I16 (hypertensive crisis) is an ICD-10-CM category; ICD-10-AM has no I16 — hypertensive urgency is coded within I10–I15."])
add("extension", "Extension of stay", "Admissions", 10, [
    Q("Vital signs chart?", "VSC"),
    Q("Lab reports?", "LABS"),
    Q("Radiology report?", "IMG"),
    Q("Progress notes and the medication sheet?", r"progress note|medication (sheet|chart)|\bMAR\b|daily (review|progress)"),
], bx=["R50", "R07", "A09", "R10", "I63"], px=["R50", "R07", "A09", "R10", "I63"],
    svc=[r"(admission|stay|approval) extension|extension of (the )?(admission|stay)|extend (the )?(admission|stay)|continue (the )?(admission|stay)|length of stay"], on="svc")

# ── Milk products (pp. 11–12) ───────────────────────────────────────────────
MILKSVC = [r"formula|special milk|Neocate|Alfamino|Nutramigen|Pregestimil|Aptamil|Similac|lactose-?free|hydroly[sz]ed|amino acid"]
def milk(id, t, page, bx, px, q, fix=None):
    add(id, t, "Milk products", page, q, bx=bx, px=px, svc=MILKSVC, on=None, age=[0, 18], fix=fix)
milk("milk-cmpa", "Cow's milk protein allergy — formula", 11, ["Z91.011"], ["Z91.0", "T78.1", "K52.2"], [
    Q("Medical report with the full history and examination?", r"history|exam|rash|eczema|vomit|bloody stool|reaction|urticaria|failure to thrive"),
], fix=["Z91.011 (allergy to milk products) is an ICD-10-CM code; ICD-10-AM codes this under Z91.0 or as the reaction itself (for example K52.2 allergic gastroenteritis)."])
milk("milk-lactose", "Lactose intolerance — formula", 11, ["E73.9"], ["E73"], [
    Q("Medical report with the full history and examination?", r"history|exam|diarrh|bloat|colic|dehydrat"),
    Q("Stool analysis?", "STOOL"),
    Q("Hydrogen breath test — or stool pH with or without osmolarity?", r"hydrogen breath|\bHBT\b|stool pH|reducing substance|osmol"),
])
milk("milk-preterm", "Prematurity — formula", 11, ["P07.3"], ["P07"], [
    Q("Medical report giving the child's gestational age at birth and current body weight?", r"(gestation|weeks|\bGA\b|preterm|premature)[\s\S]*(weight|kg|\bwt\b)|(weight|kg|\bwt\b)[\s\S]*(gestation|weeks|\bGA\b|preterm|premature)"),
])
milk("milk-ftt", "Failure to thrive — formula", 11, ["R62.51"], ["R62"], [
    Q("Medical report with the full history and examination, including the growth chart?", "GROWTHCHART"),
    Q("Anthropometric measures and the current body weight?", r"weight|\bkg\b|length|height|head circumference|\bOFC\b|\bMUAC\b|anthropometr"),
], fix=["R62.51 is an ICD-10-CM code; ICD-10-AM codes failure to thrive in a child under R62.8."])
milk("milk-galactosaemia", "Galactosaemia — formula", 11, ["E74.21"], ["E74.2"], [
    Q("Newborn screening result?", r"newborn screen|neonatal screen|\bNBS\b"),
    Q("Enzyme assay?", r"enzyme (assay|activity)|\bGALT\b"),
], fix=["E74.21 is an ICD-10-CM code; ICD-10-AM uses E74.2 (disorders of galactose metabolism)."])
milk("milk-pku", "Phenylketonuria — formula", 12, ["E70.0"], ["E70.0", "E70.1"], [
    Q("Newborn screening result?", r"newborn screen|neonatal screen|\bNBS\b"),
    Q("Phenylalanine to tyrosine ratio in blood?", r"phenylalanine|\bPhe\b|Phe/Tyr"),
    Q("Urine organic acids?", r"organic acid"),
])
milk("milk-msud", "Maple syrup urine disease — formula", 12, ["E71.0"], ["E71.0"], [
    Q("Newborn screening result?", r"newborn screen|neonatal screen|\bNBS\b"),
    Q("Plasma amino acids — leucine, isoleucine, valine?", r"leucine|isoleucine|valine|amino acid"),
    Q("Urine organic acids?", r"organic acid"),
])
milk("milk-tyrosinaemia", "Tyrosinaemia — formula", 12, ["E70.21"], ["E70.2"], [
    Q("Newborn screening result?", r"newborn screen|neonatal screen|\bNBS\b"),
    Q("Plasma tyrosine level?", r"tyrosine|amino acid"),
    Q("Urine organic acids?", r"organic acid|succinylacetone"),
], fix=["E70.21 is an ICD-10-CM code; ICD-10-AM uses E70.2 (disorders of tyrosine metabolism)."])
milk("milk-ucd", "Urea cycle defect — formula", 12, ["E72.2"], ["E72.2"], [
    Q("Blood ammonia level?", r"ammonia|\bNH3\b"),
    Q("Arterial blood gas?", "ABG"),
    Q("Plasma amino acids — glutamine, citrulline, arginine?", r"glutamine|citrulline|arginine|amino acid"),
    opt("Urine orotic acid — in OTC deficiency?", r"orotic"),
])

# ── Paediatrics (pp. 13–16) ─────────────────────────────────────────────────
def ped(id, t, page, bx, px, q, fix=None, age=None):
    add(id, t, "Paediatrics", page, q, bx=bx, px=px, age=age or [0, 18], fix=fix)
ped("ped-dka", "Diabetic ketoacidosis — child", 13, ["E10.10"], ["E10.1", "E11.1", "E14.1"], [
    Q("Random blood sugar?", r"\bRBS\b|random (blood )?(sugar|glucose)|glucose|\bBSL\b"),
    Q("Arterial blood gas?", "ABG"),
    Q("Urine analysis?", "UA"),
    Q("Electrolytes?", "ELEC"),
], fix=["E10.10 is an ICD-10-CM code; ICD-10-AM codes type 1 diabetes with ketoacidosis at E10.11–E10.19."])
ped("ped-ghd", "Growth hormone deficiency", 13, ["E23.0"], ["E23.0", "E34.3", "R62"], [
    Q("Medical report including the height of both parents?", r"mid-?parental|parent(s|al)? height|father.{0,30}height|mother.{0,30}height|height of (both )?parents"),
    Q("Growth chart?", "GROWTHCHART"),
    Q("X-ray of the left hand — bone age?", r"bone age|left hand|hand x-?ray|wrist x-?ray"),
    Q("Basic labs — CBC and thyroid profile?", r"\bCBC\b[\s\S]*(\bTSH\b|thyroid)|(\bTSH\b|thyroid)[\s\S]*\bCBC\b"),
    Q("IGF-1, and growth hormone level by stimulation test?", r"IGF-?1|stimulation test|\bGH stim|clonidine|glucagon stim|arginine stim"),
])
ped("ped-congenital-hypothyroid", "Congenital hypothyroidism", 13, ["E03.1"], ["E03.0", "E03.1"], [
    Q("TSH?", r"\bTSH\b"),
    Q("T4?", r"\bf?T4\b|thyroxine"),
    opt("Thyroid ultrasound — if agenesis is suspected?", r"thyroid (ultrasound|\bUS\b|scan)|agenesis"),
])
ped("ped-cah", "Congenital adrenal hyperplasia", 13, ["E25"], ["E25"], [
    Q("Serum electrolytes?", "ELEC"),
    Q("Serum 17-hydroxyprogesterone?", r"17-?OHP|17-?hydroxyprogesterone"),
    Q("Renin level?", r"renin"),
    Q("Cortisol level?", r"cortisol"),
])
ped("ped-rickets", "Rickets", 14, ["E55"], ["E55", "E83.3"], [
    Q("X-ray?", r"x-?ray|\bXR\b"),
    Q("CBC?", "CBC"),
    Q("Serum calcium — total and ionised?", r"calcium|\bCa\b"),
    Q("Serum phosphate?", r"phosph"),
    Q("ALP?", r"\bALP\b|alkaline phosphatase"),
    Q("PTH?", r"\bPTH\b|parathyroid hormone"),
    Q("Vitamin D level?", r"vitamin d|vit d|25-?OH"),
])
ped("ped-uti", "Urinary tract infection — child", 14, ["N39"], ["N39.0", "N10", "N30"], [
    opt("CBC, if available?", "CBC"),
    opt("CRP, if available?", "CRP"),
    Q("Urine analysis?", "UA"),
])
ped("ped-gn", "Glomerulonephritis — post-streptococcal", 14, ["N00", "N01", "N02", "N03", "N04"], ["N00", "N01", "N02", "N03", "N05"], [
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
    Q("Urine analysis?", "UA"),
    Q("C3 level?", r"\bC3\b|complement"),
    Q("Throat swab, skin culture, ASO or streptozyme test?", r"throat swab|skin (swab|culture)|\bASO\b|anti-?streptolysin|streptozyme|\bADNase"),
], fix=["Bupa lists N00–N04 for glomerulonephritis, but N04 is nephrotic syndrome in ICD-10."])
ped("ped-nephrotic", "Nephrotic syndrome", 14, ["N05", "N06", "N07", "N08"], ["N04"], [
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
    Q("Urine analysis?", "UA"),
    Q("Kidney function — 24-hour urine protein or protein-to-creatinine ratio?", r"24.?h(our)? urine|protein.{0,25}creatinine|\bUPCR\b|\bPCR\b|proteinuria"),
    Q("Albumin level?", r"albumin"),
    Q("Lipid profile?", r"lipid|cholesterol|\bLDL\b|triglycerid"),
], fix=["Bupa lists N05–N08 for nephrotic syndrome. In ICD-10 nephrotic syndrome is N04; N05–N08 are unspecified nephritic syndrome, isolated proteinuria, hereditary nephropathy and glomerular disorders elsewhere."])
ped("ped-stone", "Urinary stone — child", 15, ["N20", "N21", "N22", "N23"], ["N20", "N21", "N22", "N23"], [
    Q("CT KUB or ultrasound?", r"\bCT\b.{0,10}\bKUB\b|\bKUB\b|ultrasound|\bUSS?\b"),
    Q("Urine analysis?", "UA"),
])
ped("ped-arf", "Acute renal failure — child", 15, ["N17", "N18", "N19"], ["N17", "N18", "N19"], [
    Q("Creatinine?", r"creatinine"),
    Q("Arterial blood gas?", "ABG"),
    Q("Electrolytes?", "ELEC"),
    Q("Urine analysis?", "UA"),
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
])
ped("ped-puv", "Posterior urethral valve", 15, ["Q64.2"], ["Q64.2"], [
    Q("Kidney function tests?", "KFT"),
    Q("Ultrasound?", "US"),
    Q("Voiding cystourethrogram?", r"\bVCUG\b|\bMCUG\b|voiding cystourethrogra|micturating cystourethrogra"),
])
ped("ped-asthma", "Asthma — child", 16, ["J45.909"], ["J45", "J46"], [
    Q("Medical history, examination findings, vital signs and the initial ER management?", r"(nebuli[sz]|salbutamol|ventolin|steroid|prednisolone|dexamethasone|oxygen|\bO2\b|ipratropium)"),
    Q("Spirometry — if the child is over 5 years?", r"spirometr|\bFEV1\b|peak (expiratory )?flow|\bPEF\b", lo=5),
], fix=["J45.909 is an ICD-10-CM code; ICD-10-AM uses J45.9 (asthma, unspecified)."])
ped("ped-bronchiolitis", "Acute bronchitis or bronchiolitis — child", 16, ["J00", "J20", "J21"], ["J20", "J21"], [
    Q("Bedside evaluation — history and examination?", r"history|exam|O/E|wheez|crackles|recession|retraction|feeding"),
    Q("X-ray or CT report?", r"x-?ray|\bCXR\b|\bCT\b"),
], fix=["Bupa lists J00 (common cold) with bronchitis and bronchiolitis."])
ped("ped-pneumonia", "Pneumonia — child", 16, ["J01 to J99", "J09", "J10", "J11", "J12", "J13", "J14", "J15", "J16", "J17", "J18"],
    ["J09", "J10", "J11", "J12", "J13", "J14", "J15", "J16", "J17", "J18"], [
    Q("Bedside evaluation — history and examination — and vital signs?", r"(exam|O/E|crackles|creps|bronchial breath)[\s\S]*(\bRR\b|SpO2|sat|temp|\bHR\b)|(\bRR\b|SpO2|sat|temp|\bHR\b)[\s\S]*(exam|O/E|crackles|creps)"),
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
    Q("BUN, creatinine and electrolytes?", r"\bBUN\b|\burea\b|creatinine|electrolyte"),
    Q("Blood culture?", r"blood culture"),
    Q("Chest X-ray or CT chest?", r"\bCXR\b|chest x-?ray|x-?ray chest|CT chest"),
], fix=["Bupa lists J01–J99 — the whole respiratory chapter — for pneumonia. RxDx matches the pneumonia categories J09–J18 only."])

# ── GIT (pp. 17–22) ─────────────────────────────────────────────────────────
def git(id, t, page, bx, px, q, fix=None, cx=None, svc=None, on=None, age=None):
    add(id, t, "Gastroenterology", page, q, bx=bx, px=px, cx=cx, svc=svc, on=on, fix=fix, age=age)
git("git-cf-ip", "Cystic fibrosis — inpatient", 17, ["E84"], ["E84"], [
    Q("Sweat chloride test?", r"sweat (chloride|test)"),
    Q("Genetic testing?", r"genetic|\bCFTR\b|mutation"),
], svc=[r"\badmi(t|ss)|inpatient|\bIPD\b"])
git("git-cf-op", "Cystic fibrosis — outpatient", 17, ["E84"], ["E84"], [
    Q("Clinical examination and history?", r"history|exam|O/E"),
])
git("git-hepatitis", "Acute viral hepatitis", 17, ["B15", "B16", "B17", "B18", "B19"], ["B15", "B16", "B17", "B18", "B19"], [
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
    Q("Liver function tests?", "LFT"),
    Q("Viral serology?", r"serolog|HBsAg|anti-?HCV|anti-?HAV|\bIgM\b|viral markers|hepatitis (A|B|C|E) (antibod|serolog|surface)"),
])
git("git-wilson", "Wilson disease", 17, ["E83"], ["E83.0"], [
    Q("CBC?", "CBC"),
    Q("Liver function?", "LFT"),
    Q("Serum ceruloplasmin?", r"caeruloplasmin|ceruloplasmin"),
    Q("24-hour urinary copper excretion?", r"urinary copper|24.?h(our)? urine copper|urine copper"),
])
git("git-gastroenteritis", "Gastroenteritis", 17, ["K52.9", "K50", "K51", "K00-K95"], ["K52", "A08", "A09"], [
    Q("CBC?", "CBC"),
    Q("CRP?", "CRP"),
    Q("Electrolytes?", "ELEC"),
    Q("Stool analysis?", "STOOL"),
    opt("Arterial blood gas, if available?", "ABG"),
], cx=["Diarrhoea"],
    fix=["Bupa lists K00–K95 — the whole digestive chapter — for gastroenteritis. RxDx matches K52, A08 and A09 only, or else every digestive diagnosis would pull in this list."])
git("git-ibd", "Inflammatory bowel disease", 18, ["K52.9", "K56"], ["K50", "K51", "K52"], [
    Q("CBC, CRP or ESR, and albumin?", r"(\bCBC\b|\bCRP\b|\bESR\b)[\s\S]*albumin|albumin[\s\S]*(\bCBC\b|\bCRP\b|\bESR\b)"),
    Q("Stool analysis?", "STOOL"),
    Q("Faecal calprotectin?", "CALPRO"),
    Q("Abdominal ultrasound or X-ray?", r"ultrasound|\bUSS?\b|x-?ray|\bAXR\b"),
    opt("Colonoscopy or upper endoscopy with biopsy, if available?", r"colonoscop|endoscop|biops|histolog"),
], fix=["Bupa lists K52.9 and K56 for inflammatory bowel disease; K56 is paralytic ileus and intestinal obstruction. Crohn's disease is K50 and ulcerative colitis K51."])
git("git-nv", "Nausea and vomiting", 18, ["R11"], ["R11"], [
    Q("Bedside evaluation — history and examination?", r"history|exam|O/E"),
    Q("Number of attacks, the suspected meal, and skin turgor?", r"(episodes?|attacks?|times)[\s\S]*(meal|food|ate|turgor|dehydrat)|turgor"),
    Q("Sodium, potassium, creatinine, BUN — ABG if available — or urine analysis?", r"\bNa\b|sodium|potassium|creatinine|\bBUN\b|\burea\b|\bABG\b|urin"),
    Q("Ultrasound?", "US"),
    Q("Vital signs?", "VITALS"),
], cx=["Nausea & vomiting"])
git("git-abdpain", "Abdominal and pelvic pain", 18, ["R12", "K92", "R10", "R13", "R14", "R19", "K58"], ["R10", "R14", "R19", "K58"], [
    Q("Lab reports — CBC, CRP, stool analysis?", r"\bCBC\b|\bCRP\b|stool"),
    Q("Ultrasound, CT or MRI?", "USCTMRI"),
    Q("Vital signs, past history and the clinical examination?", r"(\bBP\b|pulse|\bHR\b|temp|vital)[\s\S]*(exam|O/E|tender|soft)|(exam|O/E|tender|soft)[\s\S]*(\bBP\b|pulse|\bHR\b|temp|vital)"),
], cx=["Abdominal pain", "Pelvic pain"],
    fix=["Bupa groups R12 (heartburn), K92, R13 (dysphagia) and R14 with abdominal pain; RxDx matches the pain codes and leaves those to their own sets."])
git("git-oesophagus", "Disorders of the oesophagus", 18, ["R12", "K20", "K21", "K22", "K23"], ["R12", "K20", "K21", "K22", "K23"], [
    Q("Lab reports — CBC, H. pylori stool antigen, stool analysis?", r"\bCBC\b|pylori|stool"),
    Q("Ultrasound?", "US"),
    Q("Vital signs, duration, medical history and medication history?", r"(since|for \d+|duration|weeks|months)[\s\S]*(medication|\bPPI\b|omeprazole|esomeprazole|pantoprazole|antacid)|(medication|\bPPI\b|omeprazole)[\s\S]*(since|for \d+|duration|weeks|months)"),
    Q("Any alarm symptoms?", "ALARM"),
], cx=["Heartburn / dyspepsia", "Dysphagia"])
git("git-stomach", "Diseases of the stomach and duodenum", 19, ["K25", "K26", "K27", "K28", "K29", "K30", "K31", "K92"], ["K25", "K26", "K27", "K28", "K29", "K30", "K31"], [
    Q("Medical history?", "HX"),
    Q("Lab reports — CBC, H. pylori stool antigen, stool analysis, FOBT?", r"\bCBC\b|pylori|stool|\bFOBT\b|occult"),
    Q("Ultrasound?", "US"),
    Q("Vital signs, duration and medication history?", r"(\bBP\b|pulse|vital)[\s\S]*(medication|\bPPI\b|NSAID)|(medication|\bPPI\b|NSAID)[\s\S]*(\bBP\b|pulse|vital)"),
])
git("git-appendicitis", "Appendicitis", 19, ["K35", "K36", "K37", "K38"], ["K35", "K36", "K37", "K38"], [
    Q("CBC and CRP?", r"\bCBC\b[\s\S]*\bCRP\b|\bCRP\b[\s\S]*\bCBC\b|\bWBC\b[\s\S]*\bCRP\b"),
    Q("Ultrasound or CT?", r"ultrasound|\bUSS?\b|\bCT\b"),
    Q("Clinical examination?", r"exam|O/E|tender|McBurney|Rovsing|guarding|rebound|Alvarado"),
])
BLEED_Q = [
    Q("Lab reports — CBC, INR, stool analysis?", r"\bCBC\b|\bINR\b|stool"),
    Q("Vital signs, drug history, and any similar attacks?", r"(\bBP\b|pulse|\bHR\b|vital)[\s\S]*(similar|previous|recurrent|first|NSAID|aspirin|anticoag|medication)|(similar|previous|recurrent|NSAID|aspirin|anticoag)[\s\S]*(\bBP\b|pulse|\bHR\b|vital)"),
    Q("Ultrasound or CT?", r"ultrasound|\bUSS?\b|\bCT\b"),
]
git("git-haematemesis", "Haematemesis", 19, ["K92.0"], ["K92.0"], list(BLEED_Q), cx=["GI bleeding (haematemesis / melaena)"])
git("git-melaena", "Melaena", 19, ["K92.1"], ["K92.1"], list(BLEED_Q), cx=["GI bleeding (haematemesis / melaena)"])
git("git-gibleed", "Gastrointestinal haemorrhage, unspecified", 20, ["K92.2"], ["K92.2"], list(BLEED_Q) + [Q("Digital rectal examination?", "DRE")], cx=["Rectal bleeding"])
git("git-otherdigestive", "Other specified diseases of the digestive system", 20, ["K92.8", "K92.89"], ["K92.8"], list(BLEED_Q) + [Q("Digital rectal examination?", "DRE")],
    fix=["K92.89 is an ICD-10-CM code; ICD-10-AM uses K92.8."])
git("git-digestive-unspec", "Disease of the digestive system, unspecified", 20, ["K92.9"], ["K92.9"], list(BLEED_Q) + [Q("Digital rectal examination?", "DRE")])
MUCO_Q = [
    Q("Lab reports — faecal calprotectin, CBC, ESR, albumin?", r"calprotectin|\bCBC\b|\bESR\b|albumin"),
    Q("Clinical examination and past history?", r"exam|O/E|history|previous"),
    opt("Radiology report, if available?", "IMG"),
]
git("git-mucositis", "Gastrointestinal mucositis (ulcerative)", 21, ["K92.81"], ["K92.8"], list(MUCO_Q),
    fix=["K92.81 is an ICD-10-CM code; ICD-10-AM has no mucositis code under K92 — it falls to K92.8."])
git("git-crohns", "Crohn's disease", 21, ["K50"], ["K50"], list(MUCO_Q))
git("git-uc", "Ulcerative colitis", 21, ["K51"], ["K51"], list(MUCO_Q))
git("git-colitis", "Other noninfective gastroenteritis and colitis", 21, ["K52"], ["K52"], [
    Q("Lab reports — faecal calprotectin, CBC, ESR, albumin?", r"calprotectin|\bCBC\b|\bESR\b|albumin"),
    Q("Clinical examination and past history?", r"exam|O/E|history|previous"),
    Q("Digital rectal examination?", "DRE"),
    opt("Radiology report, if available?", "IMG"),
])
git("git-faecal-incontinence", "Faecal incontinence", 22, ["R15"], ["R15"], [
    Q("Any recent spine or anal surgery?", r"(spin|anal|rectal|haemorrhoid|fistula|sphincter).{0,40}(surgery|operation)|no (previous |recent )?(spin|anal).{0,20}surgery|surgical history"),
    Q("Digital rectal examination?", "DRE"),
], cx=["Faecal incontinence"])

# ── Internal medicine (pp. 23–26) ───────────────────────────────────────────
def im(id, t, page, bx, px, q, fix=None, cx=None, svc=None):
    add(id, t, "Internal medicine", page, q, bx=bx, px=px, cx=cx, svc=svc, fix=fix)
IP = [r"\badmi(t|ss)|inpatient|\bIPD\b|\bER\b|emergency|to the ward"]
im("im-htn-op", "Essential hypertension — outpatient", 23, ["I10", "I11", "I12", "I13", "I14", "I15"], ["I10", "I11", "I12", "I13", "I15"], [
    Q("BP chart on the first request — or a medical report if the patient is already on medication (UCAF)?", r"\d{2,3}\s*/\s*\d{2,3}[\s\S]*?\d{2,3}\s*/\s*\d{2,3}|BP chart|home BP|\bon (amlodipine|lisinopril|losartan|valsartan|perindopril|ramipril|bisoprolol|atenolol|indapamide|hydrochlorothiazide|telmisartan|candesartan|nifedipine)"),
], fix=["I14 does not exist in ICD-10."])
im("im-htn-ip", "Essential hypertension — inpatient", 23, ["I10", "I11", "I12", "I13", "I14", "I15"], ["I10", "I11", "I12", "I13", "I15"], [
    Q("BP reading at the ER and the neurological examination?", r"(\d{2,3}\s*/\s*\d{2,3})[\s\S]*(neurolog|\bGCS\b|focal|power)|(neurolog|\bGCS\b|focal)[\s\S]*(\d{2,3}\s*/\s*\d{2,3})"),
    opt("CT brain — optional?", "CTBRAIN"),
], svc=IP, fix=["I14 does not exist in ICD-10."])
im("im-htn-urgency", "Hypertensive urgency", 23, ["I16.0", "I16.1"], ["I10"], [
    Q("BP reading at the ER and the neurological examination?", r"(\d{2,3}\s*/\s*\d{2,3})[\s\S]*(neurolog|\bGCS\b|focal|power)|(neurolog|\bGCS\b|focal)[\s\S]*(\d{2,3}\s*/\s*\d{2,3})"),
    opt("CT brain — optional?", "CTBRAIN"),
], svc=[r"urgency|crisis|emergency|\bER\b"],
    fix=["I16.0 and I16.1 are ICD-10-CM codes; ICD-10-AM has no I16. RxDx matches I10 with the words 'urgency', 'crisis' or ER."])
im("im-htn-secondary", "Secondary hypertension, unspecified — outpatient", 23, ["I15.9"], ["I15"], [
    Q("Medical history report?", "HX"),
    Q("Physical examination findings?", "EXAM"),
    Q("A series of blood pressure readings (BP chart) and other vital signs?", r"\d{2,3}\s*/\s*\d{2,3}[\s\S]*?\d{2,3}\s*/\s*\d{2,3}|BP chart"),
])
im("im-t2dm-op", "Type 2 diabetes mellitus — outpatient", 23, ["E11"], ["E11"], [
    Q("Clinical examination — signs and symptoms?", r"exam|O/E|polyuria|polydipsia|symptom|foot exam|neuropath"),
    Q("FBS, HbA1c or RBS lab report?", r"\bFBS\b|HbA1c|A1c|\bRBS\b|glucose"),
])
im("im-t1dm-op", "Type 1 diabetes mellitus — outpatient", 24, ["E10"], ["E10"], [
    Q("Clinical examination — signs and symptoms?", r"exam|O/E|polyuria|polydipsia|symptom"),
    Q("FBS, HbA1c or RBS lab report?", r"\bFBS\b|HbA1c|A1c|\bRBS\b|glucose"),
])
im("im-hypoglycaemia", "Hypoglycaemia", 24, ["E16.1", "E16.2", "E15", "E13.649", "E09.641", "E16.0"], ["E16", "E15", "E10.6", "E11.6", "E13.6"], [
    Q("Medical history?", "HX"),
    Q("Clinical examination — signs and symptoms?", r"exam|O/E|sweat|tremor|confus|\bGCS\b|symptom"),
    Q("RBS report?", r"\bRBS\b|random (blood )?(sugar|glucose)|glucose|\bBSL\b|\bmmol"),
], fix=["E13.649 and E09.641 are ICD-10-CM codes with no ICD-10-AM equivalent at that level."])
im("im-cvd-op", "Cerebrovascular disease — outpatient", 24, ["I60", "I61", "I62", "I63", "I64", "I65", "I66", "I67", "I68", "I69"],
   ["I60", "I61", "I62", "I63", "I64", "I65", "I66", "I67", "I68", "I69"], [
    Q("Clinical examination — signs and symptoms, and a full neurological examination?", "NEURO"),
])
im("im-cvd-ip", "Cerebrovascular disease — inpatient", 24, ["I60", "I61", "I62", "I63", "I64", "I65", "I66", "I67", "I68", "I69"],
   ["I60", "I61", "I62", "I63", "I64", "I65", "I66", "I67", "I68", "I69"], [
    Q("Clinical examination — signs and symptoms, and a full neurological examination?", "NEURO"),
    Q("CT brain or MRI brain?", r"CT (brain|head)|MRI (brain|head)|\bCT\b|\bMRI\b"),
    opt("MRA or CTA — optional?", "MRACTA"),
], svc=IP)
im("im-copd", "COPD", 24, ["J44"], ["J44"], [
    Q("Detailed medical report and vital signs chart?", "VSC"),
    Q("Home medication?", r"home medication|regular (medication|inhaler)|inhaler|tiotropium|salbutamol|seretide|symbicort|\bLAMA\b|\bLABA\b|\bICS\b"),
    Q("Blood gases and sepsis markers?", r"(\bABG\b|\bVBG\b|blood gas)[\s\S]*(\bCRP\b|procalcitonin|\bPCT\b|lactate|\bWBC\b)|(\bCRP\b|procalcitonin|\bPCT\b|lactate)[\s\S]*(\bABG\b|\bVBG\b|blood gas)"),
    opt("Spirometry and chest X-ray — may be useful?", r"spirometr|\bFEV1\b|\bCXR\b|chest x-?ray"),
])
im("im-pulm-oedema", "Pulmonary oedema", 25, ["J80", "J81"], ["J81"], [
    Q("Detailed medical report and vital signs chart?", "VSC"),
    opt("Imaging report — for example X-ray — if available?", r"x-?ray|\bCXR\b|imaging"),
    Q("Echocardiogram, renal function and other tests according to the primary cause?", r"\becho|renal function|creatinine|\bKFT\b|\bBNP\b|troponin"),
], fix=["Bupa lists J80 with pulmonary oedema; J80 is adult respiratory distress syndrome."])
im("im-sarcoidosis", "Sarcoidosis", 25, ["J86"], ["D86"], [
    Q("Imaging report — CT chest or X-ray?", r"CT chest|\bHRCT\b|x-?ray|\bCXR\b"),
    Q("Labs — ACE level, electrolytes, urine analysis, LFT?", r"\bACE\b|angiotensin|electrolyte|urin|\bLFTs?\b|calcium"),
], fix=["Bupa lists J86 for sarcoidosis. J86 is pyothorax; sarcoidosis is D86 in ICD-10."])
im("im-tb", "Tuberculosis", 25, ["A15"], ["A15", "A16"], [
    Q("Sputum stain for acid-fast bacilli, sputum culture, or PCR?", r"\bAFB\b|acid-?fast|sputum (smear|stain|culture)|GeneXpert|\bPCR\b|Xpert"),
    Q("Tuberculin skin test?", r"tuberculin|\bTST\b|\bPPD\b|mantoux"),
    Q("PPD or QuantiFERON — for latent TB?", r"\bPPD\b|QuantiFERON|\bIGRA\b|mantoux"),
    Q("Imaging report — X-ray or CT chest?", r"x-?ray|\bCXR\b|CT chest"),
    opt("Sputum culture, if available?", r"sputum culture|culture"),
])
im("im-pneumonia", "Pneumonia", 25, ["J13", "J15", "J18"], ["J13", "J15", "J18"], [
    Q("Medical report and vital signs chart?", "VSC"),
    Q("Sepsis work-up — CRP, CBC, BUN, creatinine and electrolytes?", r"\bCRP\b|\bCBC\b|\bBUN\b|\burea\b|creatinine|electrolyte"),
    Q("Clinical assessment score — CURB-65 or Pneumonia Severity Index?", r"CURB-?65|\bCRB-?65|\bPSI\b|pneumonia severity"),
    Q("Imaging — X-ray or CT chest?", r"x-?ray|\bCXR\b|CT chest"),
])
im("im-effusion", "Pleural effusion", 26, ["J90", "J91"], ["J90", "J91"], [
    Q("Detailed medical report and vital signs chart?", "VSC"),
    Q("Imaging report — X-ray or CT chest?", r"x-?ray|\bCXR\b|CT chest|ultrasound"),
])
im("im-cf", "Cystic fibrosis — adult", 26, ["E84"], ["E84"], [
    Q("Detailed medical report and vital signs chart?", "VSC"),
    Q("Sweat chloride test?", r"sweat (chloride|test)"),
])
im("im-pneumothorax", "Pneumothorax", 26, ["J93"], ["J93"], [
    Q("Vital signs chart?", "VSC"),
    Q("Medical report stating the primary cause?", r"spontaneous|primary|secondary|trauma|COPD|smok|cause"),
    Q("Imaging report — X-ray or CT chest?", r"x-?ray|\bCXR\b|CT chest"),
])
im("im-pe", "Pulmonary embolism", 26, ["J81"], ["I26"], [
    Q("Full physical examination, with the Wells score and the PERC rule for a suspected PE?", r"Wells|\bPERC\b"),
    Q("Imaging — CT pulmonary angiogram or V/Q scan?", r"\bCTPA\b|CT pulmonary angio|V/?Q"),
    Q("D-dimer?", r"d-?dimer"),
], fix=["Bupa lists J81 for pulmonary embolism. J81 is pulmonary oedema; pulmonary embolism is I26."])

# ── Orthopaedics (pp. 27–33) ────────────────────────────────────────────────
FRX_Q = lambda cls=None: [
    Q("Scenario of the trauma?", "TRAUMA"),
    Q("History and clinical examination?", r"(history|presented|complain)[\s\S]*(exam|O/E|tender|swelling|deformit)|(exam|O/E|tender|swelling|deformit)[\s\S]*(history|presented|complain)"),
    Q(("Classification — " + cls + "?") if cls else "Classification?", {"Pipkin": r"Pipkin", "Evans": r"Evans|\bstable\b|\bunstable\b",
      "AO 32": r"\bAO\b|32-?[ABC]", "Schatzker": r"Schatzker"}.get(cls.split(' ')[0] if cls else '', E["CLASSIF"]) if cls else "CLASSIF"),
    Q("Radiology report?", r"x-?ray|\bXR\b|\bCT\b|\bMRI\b|radiolog"),
    Q("Management plan details?", "PLAN"),
]
def ortho(id, t, page, bx, px, q, fix=None, svc=None, cx=None):
    add(id, t, "Orthopaedics", page, q, bx=bx, px=px, fix=fix, svc=svc, cx=cx)
ortho("ortho-pelvic-ring", "Pelvic ring fracture", 27, ["S32.0", "S32.9"], ["S32.1", "S32.2", "S32.3", "S32.5", "S32.7", "S32.8"], FRX_Q(),
      fix=["Bupa lists S32.0 and S32.9. S32.0 is a lumbar vertebra fracture and S32.9 does not exist in ICD-10-AM; pelvic ring fractures sit at S32.1–S32.8."])
ortho("ortho-acetabulum", "Acetabular fracture", 27, ["S32.3"], ["S32.4"], FRX_Q(),
      fix=["Bupa lists S32.3, which is a fracture of the ilium. The acetabulum is S32.4."])
ortho("ortho-femoral-head", "Femoral head fracture", 27, ["S72.0"], ["S72.0"], FRX_Q("Pipkin I–IV"))
ortho("ortho-intertrochanteric", "Intertrochanteric femur fracture", 27, ["S72.1"], ["S72.1"], FRX_Q("Evans — stable or unstable"))
ortho("ortho-femoral-shaft", "Femoral shaft fracture", 28, ["S72.3"], ["S72.3"], FRX_Q("AO 32-A, B or C"))
ortho("ortho-tibial-plateau", "Tibial plateau fracture", 28, ["S82.1"], ["S82.1"], FRX_Q("Schatzker I–VI"))
LOWER = ["S82.2", "S92.0 - S92.1", "S92.2", "S52.2", "S42.2"]
COPY_FIX = "Bupa prints the same code list (S82.2, S92.0–S92.1, S92.2, S52.2, S42.2) for tibial shaft, ankle, talus, calcaneus and proximal humerus fractures. RxDx matches each on its own code."
ortho("ortho-tibial-shaft", "Tibial shaft fracture", 28, LOWER, ["S82.2"], FRX_Q(), fix=[COPY_FIX])
ortho("ortho-ankle", "Ankle fracture", 28, LOWER, ["S82.5", "S82.6", "S82.8"], FRX_Q(), fix=[COPY_FIX, "None of the printed codes is an ankle fracture; RxDx uses S82.5, S82.6 and S82.8."])
ortho("ortho-talus", "Talus fracture", 29, LOWER, ["S92.1"], FRX_Q(), fix=[COPY_FIX])
ortho("ortho-calcaneus", "Calcaneus fracture", 29, LOWER, ["S92.0"], FRX_Q(), fix=[COPY_FIX])
ortho("ortho-proximal-humerus", "Proximal humerus fracture", 29, LOWER, ["S42.2"], FRX_Q(), fix=[COPY_FIX])
ortho("ortho-arthroscopy", "Arthroscopy — shoulder, wrist, hip, knee, ankle", 29,
      ["S43.0", "S43.5", "S46.0", "M75.1", "S63.5", "S66.2", "S61.4", "S73.1", "M25.8", "S83.5", "S83.2", "M93.2", "S86.0", "S93.0", "M03.2", "S93.4"],
      ["S43", "S46", "M75", "S63", "S66", "S61", "S73", "M25", "S83", "M93", "S86", "S93"], [
    Q("Scenario of the trauma?", "TRAUMA"),
    Q("History and clinical examination, with the initial lines of management?", r"(exam|O/E|tender|effusion|McMurray|Lachman|drawer|impingement)[\s\S]*(physio|analges|NSAID|rest|injection|brace|treated)|(physio|analges|NSAID|injection|brace)[\s\S]*(exam|O/E|tender|effusion)"),
    Q("Classification?", "CLASSIF"),
    Q("Radiology report — MRI or CT?", r"\bMRI\b|\bCT\b"),
    Q("Management plan details?", "PLAN"),
], svc=[r"arthroscop"], fix=["S61.4 does not exist in ICD-10-AM — open wounds of the wrist and hand are S61.0–S61.9; M03.2 is a post-infective arthropathy, unusual as the reason for an arthroscopy."])
SPINE_Q = [
    Q("History and neurological examination, the duration of the complaint, and the initial lines of management?", r"(neurolog|power|reflex|sensation|straight leg|\bSLR\b)[\s\S]*(since|for \d+|weeks|months|physio|analges|NSAID)|(since|for \d+|weeks|months|physio|analges)[\s\S]*(neurolog|power|reflex|sensation|\bSLR\b)"),
    Q("Classification?", "CLASSIF"),
    Q("Radiology report — MRI or CT?", r"\bMRI\b|\bCT\b"),
    Q("Management plan details?", "PLAN"),
]
SPINE_BX = ["M50.2", "M51.2", "M43.16", "M47.2"]
ortho("ortho-cervical-disc", "Cervical disc degeneration", 30, SPINE_BX, ["M50", "M47.2", "M47.8"], list(SPINE_Q))
ortho("ortho-lumbar-disc", "Lumbar disc degeneration", 30, SPINE_BX, ["M51", "M47.2", "M47.8"], list(SPINE_Q))
ortho("ortho-spondylolisthesis", "Spondylolisthesis", 30, SPINE_BX, ["M43.1"], list(SPINE_Q))
ortho("ortho-stenosis", "Spinal stenosis", 30, SPINE_BX, ["M48.0"], list(SPINE_Q),
      fix=["Bupa's list for spinal stenosis has no stenosis code; ICD-10-AM uses M48.0."])
VFX_Q = [
    Q("Scenario of the trauma?", "TRAUMA"),
    Q("History and neurological examination?", "NEURO"),
    Q("Classification?", "CLASSIF"),
    Q("Radiology report — MRI or CT?", r"\bMRI\b|\bCT\b"),
    Q("Management plan details?", "PLAN"),
]
VFX_BX = ["S22.0", "S22.1", "S11.0", "S32.0"]
VFX_FIX = "Bupa prints the same list (S22.0, S22.1, S11.0, S32.0) for all four spinal fractures; S11.0 is an open wound of the larynx."
ortho("ortho-thoracic-wedge", "Thoracic wedge fracture", 31, VFX_BX, ["S22.0", "S22.1"], list(VFX_Q), fix=[VFX_FIX])
ortho("ortho-thoracic-burst", "Thoracic burst fracture", 31, VFX_BX, ["S22.0", "S22.1"], list(VFX_Q), fix=[VFX_FIX])
ortho("ortho-cervical-fracture", "Cervical spine fracture", 31, VFX_BX, ["S12"], list(VFX_Q),
      fix=[VFX_FIX, "No printed code is a cervical spine fracture; ICD-10 uses S12."])
ortho("ortho-lumbar-burst", "Lumbar burst fracture", 31, VFX_BX, ["S32.0"], list(VFX_Q), fix=[VFX_FIX])
DEF_Q = [
    Q("History and neurological examination?", "NEURO"),
    Q("Classification?", "CLASSIF"),
    Q("Radiology report — MRI or CT?", r"\bMRI\b|\bCT\b|x-?ray"),
    Q("Management plan details?", "PLAN"),
]
DEF_BX = ["M41.0", "M46.1", "M84.5"]
DEF_FIX = "Bupa prints the same list (M41.0, M46.1, M84.5) for scoliosis, spinal infection and pathological fracture; M84.5 is an ICD-10-CM code."
ortho("ortho-scoliosis", "Idiopathic scoliosis", 32, DEF_BX, ["M41.0", "M41.1", "M41.2"], list(DEF_Q), fix=[DEF_FIX])
ortho("ortho-discitis", "Spinal infection (discitis)", 32, DEF_BX, ["M46.2", "M46.3", "M46.4", "M46.5"], list(DEF_Q),
      fix=[DEF_FIX, "Bupa lists M46.1, which is sacroiliitis. Discitis is M46.4 and spinal infection M46.2–M46.5."])
ortho("ortho-pathological-fracture", "Pathological fracture", 32, DEF_BX, ["M84.4", "M80"], list(DEF_Q),
      fix=[DEF_FIX, "ICD-10-AM codes pathological fracture at M84.4 (or M80 with osteoporosis)."])
OA_Q = [
    Q("History and clinical examination?", r"(history|presented|complain|pain)[\s\S]*(exam|O/E|range of motion|\bROM\b|crepitus|effusion|tender)|(exam|O/E|\bROM\b|crepitus)[\s\S]*(history|pain)"),
    Q("Past history and the previous lines of management?", r"physio|analges|NSAID|paracetamol|injection|previous (treatment|management)|weight loss|brace|tried|failed"),
    Q("Radiology report — X-ray, MRI or CT?", r"x-?ray|\bXR\b|\bMRI\b|\bCT\b"),
    Q("Management plan details?", "PLAN"),
]
OA_BX = ["M16.0", "M16.10", "M16.4", "M17.0", "M17.2", "M17.9"]
OA_FIX = "Bupa prints the same list for hip and knee osteoarthritis; M16.10 is an ICD-10-CM code — ICD-10-AM uses M16.1."
ortho("ortho-oa-hip", "Osteoarthritis of the hip", 32, OA_BX, ["M16"], list(OA_Q), fix=[OA_FIX])
ortho("ortho-oa-knee", "Osteoarthritis of the knee", 33, OA_BX, ["M17"], list(OA_Q), fix=[OA_FIX])

# ── Gynaecology and obstetrics (pp. 34–39) ──────────────────────────────────
def ob(id, t, page, bx, px, q, fix=None, age=None):
    add(id, t, "Obstetrics and gynaecology", page, q, bx=bx, px=px, sex="F", age=age or [10, 60], fix=fix)
REPORT = Q("Medical report?", "MEDREPORT")
REPORT_VSC = Q("Medical report and vital signs chart?", r"(report|history|presented|G\d|gravida)[\s\S]*(\bBP\b|pulse|\bHR\b|temp|vital)|(\bBP\b|pulse|vital)[\s\S]*(history|presented|G\d|gravida)")
ob("ob-puerperal-psych", "Puerperal psychiatric disorder", 34, ["F53.0", "F53.1"], ["F53"], [REPORT])
EARLY = lambda: [Q("Transvaginal ultrasound?", r"\bTVUS\b|transvaginal|\bTVS\b|ultrasound|\bUSS?\b"),
                 Q("CBC and quantitative beta hCG?", r"(\bCBC\b|\bHb\b)[\s\S]*hCG|hCG[\s\S]*(\bCBC\b|\bHb\b)"),
                 REPORT]
ob("ob-ectopic", "Ectopic pregnancy", 34, ["O00.00", "O00.91"], ["O00"], EARLY(),
   fix=["O00.00 and O00.91 are ICD-10-CM codes; ICD-10-AM uses O00.0–O00.9."])
ob("ob-gtd", "Gestational trophoblastic disease", 34, ["O01.0", "O02.0"], ["O01", "O02.0"], EARLY())
ob("ob-abortion", "Abortion and termination of pregnancy", 34, ["O02.1", "O07.4"], ["O02.1", "O03", "O04", "O05", "O06", "O07"], EARLY())
ob("ob-ectopic-molar", "Complications of ectopic and molar pregnancy", 34, ["O08.0", "O08.9"], ["O08"], EARLY())
ob("ob-htn", "Hypertension in pregnancy", 35, ["O10.011", "O16.9"], ["O10", "O11", "O13", "O14", "O15", "O16"], [
    Q("Ultrasound?", "US"),
    Q("CBC, kidney function (urine analysis and protein-to-creatinine ratio) and LFT?", r"(protein.{0,25}creatinine|\bUPCR\b|\bPCR\b|proteinuria|urin)[\s\S]*(\bLFTs?\b|liver|\bALT\b)|(\bLFTs?\b|liver|\bALT\b)[\s\S]*(protein|urin)"),
    Q("Medical report with the BP readings?", r"\d{2,3}\s*/\s*\d{2,3}"),
], fix=["O10.011 and O16.9 are ICD-10-CM codes; ICD-10-AM uses O10.0 and O16."])
ob("ob-early-bleed", "Haemorrhage in early pregnancy", 35, ["O20.0", "O20.9"], ["O20"], [
    Q("Ultrasound?", "US"),
    Q("CBC — with kidney function and LFT, optional?", "CBC"),
    REPORT_VSC,
])
ob("ob-vomiting", "Vomiting in pregnancy", 35, ["O21.0", "O21.9"], ["O21"], [
    Q("Ultrasound?", "US"),
    Q("CBC, electrolytes, urine analysis, random blood glucose and quantitative beta hCG?", r"(electrolyte|sodium|potassium)[\s\S]*(urin|ketone)|(urin|ketone)[\s\S]*(electrolyte|sodium|potassium)"),
    REPORT_VSC,
])
ob("ob-infection", "Infections in pregnancy", 35, ["O23.00", "O23.93"], ["O23"], [
    Q("Ultrasound?", "US"),
    Q("CBC, CRP, urine and ESR — according to the type and site of the infection?", r"\bCBC\b|\bCRP\b|urin|\bESR\b"),
    REPORT_VSC,
], fix=["O23.00 and O23.93 are ICD-10-CM codes; ICD-10-AM uses O23.0–O23.9."])
ob("ob-diabetes", "Diabetes in pregnancy", 36, ["O24.011", "O24.93"], ["O24"], [
    Q("Ultrasound?", "US"),
    Q("CBC, RBS, ABG (in an emergency) and urine analysis?", r"\bRBS\b|glucose|\bABG\b|urin"),
    opt("GTT, if available?", r"\bGTT\b|\bOGTT\b|glucose tolerance"),
    REPORT_VSC,
], fix=["O24.011 is an ICD-10-CM code; ICD-10-AM uses O24.0–O24.9."])
ob("ob-liver", "Liver disease in pregnancy", 36, ["O26.611"], ["O26.6"], [
    Q("Ultrasound?", "US"),
    Q("CBC, kidney function, LFT and bilirubin?", r"(\bLFTs?\b|liver function|\bALT\b|\bAST\b)[\s\S]*bilirubin|bilirubin[\s\S]*(\bLFTs?\b|liver function|\bALT\b)|bile acid"),
    REPORT_VSC,
], fix=["O26.611 is an ICD-10-CM code; ICD-10-AM uses O26.6."])
ob("ob-cervix", "Cervical shortening", 36, ["O26.872", "O26.879"], ["O26.8", "O34.3"], [
    Q("Transvaginal ultrasound?", r"\bTVUS\b|transvaginal|\bTVS\b|cervical length"),
    REPORT,
], fix=["O26.872 and O26.879 are ICD-10-CM codes with no ICD-10-AM match; cervical incompetence is O34.3."])
ob("ob-dfm", "Decreased fetal movement", 36, ["O36.8120", "O36.8199"], ["O36.8"], [
    Q("Ultrasound and CTG?", r"(ultrasound|\bUSS?\b|scan)[\s\S]*\bCTG\b|\bCTG\b[\s\S]*(ultrasound|\bUSS?\b|scan)"),
    REPORT_VSC,
], fix=["O36.8120 and O36.8199 are ICD-10-CM codes; ICD-10-AM uses O36.8."])
ob("ob-pprom", "Preterm premature rupture of membranes", 37, ["O42.00", "O42.92"], ["O42"], [
    Q("Ultrasound and CTG?", r"(ultrasound|\bUSS?\b|scan)[\s\S]*\bCTG\b|\bCTG\b[\s\S]*(ultrasound|\bUSS?\b|scan)"),
    REPORT_VSC,
    Q("Management plan?", r"\bplan\b|steroid|dexamethasone|betamethasone|antibiotic|erythromycin|delivery|expectant|admit"),
], fix=["O42.00 and O42.92 are ICD-10-CM codes; ICD-10-AM uses O42.0–O42.9."])
ob("ob-placenta", "Placental disorders", 37, ["O43.011", "O45.93"], ["O43", "O44", "O45"], [
    Q("Ultrasound?", "US"),
    REPORT_VSC,
    Q("Management plan?", r"\bplan\b|admit|delivery|steroid|monitor|caesarean|cesarean"),
], fix=["O43.011 and O45.93 are ICD-10-CM codes; ICD-10-AM uses O43, O44 and O45."])
ob("ob-preterm-labour", "Preterm labour", 37, ["O47.00"], ["O60", "O47.0"], [
    Q("Ultrasound and CTG?", r"(ultrasound|\bUSS?\b|scan)[\s\S]*\bCTG\b|\bCTG\b[\s\S]*(ultrasound|\bUSS?\b|scan)"),
    Q("CBC and kidney function?", r"\bCBC\b|\bKFT\b|creatinine"),
    REPORT_VSC,
], fix=["Bupa lists O47.00. In ICD-10-AM O47 is false labour; preterm labour is O60."])
ob("ob-failed-induction", "Failed induction of labour", 37, ["O61.0", "O61.9"], ["O61"], [
    Q("Ultrasound, CTG and partogram?", r"partogra"),
    REPORT_VSC,
])
ob("ob-cs", "Caesarean delivery — indication", 38, ["O82"], ["O82"], [
    Q("Indication for the caesarean?", r"indication|previous (CS|caesarean|cesarean|LSCS)|breech|placenta praevia|placenta previa|fetal distress|failure to progress|obstructed"),
    Q("Ultrasound report, CTG and partogram?", r"\bCTG\b|partogra"),
])
ob("ob-puerperium", "Puerperal complications", 38, ["O85"], ["O85", "O86", "O87", "O90"], [
    Q("Ultrasound?", "US"),
    Q("CBC, kidney function, LFT and bilirubin?", r"\bCBC\b|\bKFT\b|creatinine|\bLFTs?\b|bilirubin"),
    REPORT_VSC,
])
ob("gyn-endometriosis", "Endometriosis", 38, ["N80"], ["N80"], [
    Q("Ultrasound or MRI?", r"ultrasound|\bUSS?\b|\bTVUS\b|\bMRI\b"),
    REPORT_VSC,
])
ob("gyn-prolapse", "Female genital prolapse", 38, ["N81"], ["N81"], [
    REPORT_VSC,
    Q("Past history and the initial lines of management?", r"pelvic floor|pessary|physio|previous|tried|Kegel|initial management"),
])
ob("gyn-polyp", "Polyp of the female genital tract", 39, ["N84"], ["N84"], [
    Q("Ultrasound?", "US"),
    REPORT,
])
ob("gyn-vulva", "Noninflammatory disorders of the vulva and perineum", 39, ["N90"], ["N90"], [REPORT])
ob("gyn-oligo", "Absent, scanty and rare menstruation", 39, ["N91"], ["N91"], [
    Q("Ultrasound?", "US"),
    Q("CBC and TSH?", r"\bTSH\b"),
    REPORT,
])
ob("gyn-menorrhagia", "Excessive, frequent and irregular menstruation", 39, ["N92", "N93", "N94", "N95", "N96"], ["N92", "N93"], [
    Q("Ultrasound?", "US"),
    Q("CBC, TSH and coagulation profile?", r"coag|\bINR\b|\bPT\b|\bAPTT\b|\bPTT\b"),
    REPORT,
], fix=["Bupa includes N94–N96 (pain, menopause, recurrent miscarriage) in the heavy-bleeding list."])

# ── Cardiology (pp. 40–42) ──────────────────────────────────────────────────
def card(id, t, page, bx, px, q, svc, fix=None):
    add(id, t, "Cardiology", page, q, bx=bx, px=px, svc=svc, on="svc", fix=fix)
PTP = Q("Pre-test probability — the RF-CL model?", r"pre-?test probabilit|\bRF-?CL\b|\bPTP\b|risk factor-?weighted")
card("card-stress-ecg", "Stress ECG", 40, ["R94.31"], ["R94.3", "I20", "I25", "R07"], [
    Q("Full past history, and when the condition was first diagnosed?", r"first diagnosed|since|history of|known|\bPMH\b|past history"),
    Q("Resting ECG?", "ECG"),
    PTP,
    Q("Clinical history?", "HX"),
], [r"stress ECG|exercise (ECG|tolerance test|stress)|\bETT\b|treadmill"],
    fix=["R94.31 is an ICD-10-CM code; ICD-10-AM uses R94.3."])
card("card-ctca", "CT coronary angiography", 40, ["I21", "I20"], ["I20", "I21", "I25", "R07"], [
    Q("Full past history, when first diagnosed, and why CTCA rather than another test?", r"first diagnosed|past history|known|indication|rather than|instead of|versus"),
    Q("Resting ECG?", "ECG"),
    PTP,
    Q("Clinical history?", "HX"),
], [r"\bCTCA\b|CT coronary|coronary CT|CT angio(gram|graphy)? (of )?(the )?coronar|calcium scor"])
card("card-dse", "Dobutamine stress echocardiography", 40, ["R07", "I21"], ["R07", "I20", "I21", "I25"], [
    Q("Full past history, when first diagnosed, and why this test rather than another?", r"first diagnosed|past history|known|indication|rather than|instead of"),
    Q("Resting ECG?", "ECG"),
    PTP,
    Q("Clinical history?", "HX"),
], [r"dobutamine|stress echo"])
card("card-ica", "Invasive coronary angiography", 40, ["I21", "I20"], ["I20", "I21", "I22", "I24", "I25"], [
    Q("Full past history, and when first diagnosed?", r"first diagnosed|past history|known|history of"),
    Q("Resting ECG and cardiac enzymes?", r"\bECG\b[\s\S]*(troponin|enzyme|\bCK\b)|(troponin|enzyme)[\s\S]*\bECG\b"),
    Q("Other imaging report — echo, CT angiography?", r"\becho|\bCTCA\b|CT angio|stress"),
    PTP,
    Q("Clinical history?", "HX"),
], [r"coronary angiogra|\bCAG\b|cardiac cath|cath lab"])
PCI_Q = [
    Q("ECG?", "ECG"),
    Q("High-sensitivity troponin?", "TROP"),
    Q("Angiography report?", r"angiogra|\bCAG\b|cath"),
    opt("SYNTAX score II — where it applies (not in acute MI)?", r"SYNTAX"),
    opt("GRACE risk score — in unstable angina?", r"GRACE"),
    Q("Clinical history and full past history?", r"history|past medical|\bPMH\b|known"),
]
card("card-pci", "PCI", 41, ["I21", "I20"], ["I20", "I21", "I22", "I25"], [dict(x) for x in PCI_Q], [r"\bPCI\b|coronary (angioplast|stent)|\bPTCA\b|drug-eluting stent"])
card("card-cabg", "CABG", 41, ["I21", "I20"], ["I20", "I21", "I22", "I25"], [dict(x) for x in PCI_Q], [r"\bCABG\b|bypass graft"])
card("card-ppm", "Permanent pacemaker", 41, ["Z95.0", "R00.2", "I48"], ["I44", "I45", "I49", "R00.1", "I48", "R55"], [
    Q("Clinical history, past medical history and the primary aetiology?", r"aetiolog|etiolog|cause|heart block|bradycard|sick sinus|history"),
    Q("Vital signs?", "VITALS"),
    Q("ECG — and Holter if available?", r"\bECG\b|holter"),
    Q("Initial lines of management?", r"stopped|withheld|atropine|isoprenaline|temporary pacing|medication review|initial management|treated"),
], [r"pacemaker|\bPPM\b"],
    fix=["Bupa lists Z95.0 (presence of a cardiac device) for pacemaker insertion; that is a status code, not the reason for the device."])
card("card-holter", "Holter monitor", 41, ["R00.2", "I48"], ["R00", "I47", "I48", "I49", "R55"], [
    Q("Clinical history, including how often the palpitations happen?", r"(palpitation|episode|attack)[\s\S]{0,60}(per|a|each|times|daily|weekly|week|month|day)|frequen"),
    Q("Resting ECG?", "ECG"),
], [r"holter|ambulatory ECG|event monitor"])
card("card-abpm", "Ambulatory blood pressure monitoring", 42, ["I10", "I11", "R03.0"], ["I10", "I11", "R03.0"], [
    Q("Clinical history?", "HX"),
    Q("Office BP readings?", r"\d{2,3}\s*/\s*\d{2,3}|office BP|clinic BP"),
    Q("Home BP readings?", r"home BP|home (blood pressure|readings)|self-?monitor|\bHBPM\b"),
], [r"\bABPM\b|ambulatory (BP|blood pressure)|24.?h(our)? BP"])
DEV_Q = [
    Q("Clinical history and full past history?", r"history|past medical|\bPMH\b|known"),
    Q("Complete medication history?", "MEDHX"),
    Q("Echocardiogram?", "ECHO"),
    Q("ECG or Holter report?", r"\bECG\b|holter"),
    Q("ER notes?", r"\bER\b|emergency|\bED\b note|presented to"),
]
card("card-icd", "ICD device", 42, ["Z95.810"], ["I47.2", "I49.0", "I46", "I42", "I50", "I25"], [dict(x) for x in DEV_Q], [r"\bICD\b(?! ?-?10)|defibrillator|\bAICD\b"],
     fix=["Z95.810 is an ICD-10-CM status code (presence of a defibrillator); ICD-10-AM has Z95.8, and the claim needs the arrhythmia or heart-failure code that justifies the device."])
card("card-crt", "CRT device", 42, ["Z95"], ["I50", "I42", "I44.7"], [dict(x) for x in DEV_Q], [r"CRT[- ]?[DP]\b|CRT device|cardiac resynchron|resynchroni[sz]ation|biventricular pac"],
     fix=["Bupa lists Z95, a status code; the device is justified by heart failure (I50) or cardiomyopathy (I42)."])
card("card-eps", "EPS and cardiac ablation", 42, ["R00.2", "I48"], ["I47", "I48", "I49", "R00"], [
    Q("Past medical history — heart failure, structural heart disease, previous admissions?", r"heart failure|structural|previous admission|cardiomyopath|valv|\bPMH\b|no (heart failure|structural)"),
    Q("Previous management and its duration?", r"(beta.?block|bisoprolol|metoprolol|amiodarone|flecainide|diltiazem|verapamil|anticoag)|previous (treatment|management)"),
    Q("Presenting symptoms and clinical status — documented tachycardia episodes and how often, syncope, palpitations?", r"(episode|attack)[\s\S]{0,80}(per|times|frequen|week|month)|syncope|palpitation"),
    Q("Arrhythmia documentation — ECGs, Holter or event monitor findings, and echo (structure and function)?", r"(\bECG\b|holter|event monitor)[\s\S]*\becho|\becho[\s\S]*(\bECG\b|holter)"),
], [r"\bEPS\b|electrophysiolog|catheter ablation|cardiac ablation|(AF|SVT|AVNRT|AVRT|flutter|pathway) ablation|ablation (of|for) (AF|SVT|atrial|the pathway|flutter)"])

# ── Milk formula protocol (p. 43) ───────────────────────────────────────────
add("milk-protocol", "Specialised infant formula — clinical pre-approval guideline", "Milk products", 43, [
    Q("Breastfeeding encouraged first — and documented?", r"breast ?feed|breast ?milk|\bEBF\b|lactation"),
    Q("Cow's milk allergy: a trial of extensively hydrolysed formula for 4–8 weeks — and the response? If improved, continue 4–6 months.", r"extensively hydroly[sz]ed|\beHF\b|Nutramigen|Pregestimil|Alimentum|Aptamil Pepti|Althera|hydroly[sz]ed"),
    Q("Lactose intolerance: how long has the diarrhoea lasted, and what is the dehydration status?", r"(diarrh)[\s\S]{0,80}(\d+ ?days?|weeks?|>\s*14|persistent)|dehydrat"),
    Q("Persistent diarrhoea over 14 days in a formula-fed child: a trial of lactose-free formula for 4–6 weeks — and the response?", r"lactose-?free|\bLF formula|Al 110|\bO-?Lac"),
    opt("No improvement: referred to a paediatric gastroenterologist?", r"refer[\s\S]{0,40}(gastro|\bGI\b)|paediatric gastro|pediatric gastro"),
], svc=MILKSVC, px=["Z91.0", "T78.1", "K52.2", "E73", "P07", "R62", "E70", "E71", "E72", "E74"], age=[0, 3],
    no=["Non-persistent diarrhoea with no or mild dehydration: continue breastfeeding — formula is not the answer.",
        "Persistent diarrhoea (over 14 days) in a breastfed child: continue breastfeeding.",
        "Reference: Insurance Authority rules and instructions."])

# ── Biological agents (p. 45) ───────────────────────────────────────────────
BIOSVC = [r"biologic|adalimumab|Humira|etanercept|Enbrel|infliximab|Remicade|certolizumab|golimumab|ustekinumab|Stelara|secukinumab|Cosentyx|ixekizumab|guselkumab|risankizumab|tocilizumab|Actemra|rituximab|abatacept|dupilumab|Dupixent|omalizumab|Xolair|mepolizumab|Nucala|benralizumab|Fasenra|tezepelumab|vedolizumab|Entyvio"]
add("biologics", "Biological agent — submission", "Biological agents", 45, [
    Q("Confirmed diagnosis and ICD-10 code?", r"diagnos|confirmed|ICD|[A-Z]\d\d\.\d"),
    Q("Specialist consultation notes?", r"rheumatolog|dermatolog|gastroenterolog|allerg|immunolog|pulmonolog|specialist|consultant"),
    Q("Disease severity or activity assessment — the score?", r"\bDAS-?28\b|\bDAS\b|\bPASI\b|\bEASI\b|\bSCORAD\b|\bCDAI\b|\bSDAI\b|\bBASDAI\b|\bASDAS\b|Mayo|Harvey|\bHBI\b|\bUAS7\b|\bACT\b|severity|activity score"),
    Q("Initial investigations attached, where applicable?", r"\blab|\bCBC\b|\bCRP\b|\bESR\b|\bRF\b|anti-?CCP|\bIgE\b|eosinophil|biops|x-?ray|\bMRI\b|result"),
    Q("Previous treatment history?", r"methotrexate|\bMTX\b|sulfasalazine|hydroxychloroquine|leflunomide|azathioprine|topical|phototherapy|ciclosporin|cyclosporin|mesalazine|steroid|antihistamine|previous (treatment|therap)|conventional"),
    Q("Documented treatment failure or intolerance?", r"fail|inadequate response|intoleran|not tolerated|side effect|no response|refractory"),
    Q("TB screening, where applicable?", r"\bTB\b|tuberculosis|QuantiFERON|\bIGRA\b|\bPPD\b|mantoux|\bCXR\b|chest x-?ray"),
    Q("HBV and HCV screening, where applicable?", r"HBsAg|hepatitis B|anti-?HBc|\bHBV\b|\bHCV\b|hepatitis C"),
    Q("Vaccination status reviewed?", r"vaccin|immuni[sz]ation"),
    Q("Clinical rationale for choosing this biologic?", r"rationale|chosen|because|preferred|selected|indicated|mechanism|comorbid"),
    Q("Prescription details — quantities and duration?", r"(mg|dose)[\s\S]{0,60}(every|weekly|monthly|q\d|x ?\d|for \d+ (weeks|months))|quantity|duration"),
], svc=BIOSVC, on="svc", sp="Biological agents",
    no=["Most common reasons Bupa refuses a biologic: missing disease-severity documentation; missing initial investigations; no evidence of step-therapy failure; missing TB, HBV or HCV screening; missing specialist assessment; insufficient rationale for the biologic chosen."])

# ── output ──────────────────────────────────────────────────────────────────
def finish():
    for s in SETS:
        # a list tied to a service stays silent until the service is written, on every screen
        if s.get("svc") and s.get("on") != "svc":
            s["gate"] = 1
    for sid in ("b-im-htn-op", "b-im-cvd-op", "b-git-cf-op"):
        [x for x in SETS if x["id"] == sid][0]["nsvc"] = IP

def check():
    finish()
    ids = set()
    for s in SETS:
        assert s["id"] not in ids, s["id"]; ids.add(s["id"])
        for q in s["q"]:
            if q.get("lo") is None: q.pop("lo", None)
            re.compile(q["ev"], re.I)
        for r in s.get("svc", []): re.compile(r, re.I)
    return len(SETS), sum(len(s["q"]) for s in SETS)

if __name__ == "__main__":
    n, qn = check()
    sys.stderr.write("%d sets, %d questions (%d optional)\n" % (n, qn, sum(1 for s in SETS for q in s["q"] if q.get("opt"))))
    json.dump(SETS, sys.stdout, ensure_ascii=False, indent=1)
