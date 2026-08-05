#!/usr/bin/env python3
"""
Build the browser model and everything Hugging Face needs, in one step.

    pip install numpy onnx onnxruntime
    python3 build_model.py "C:/Users/m7mda/Downloads/OpenMed-NER-DiseaseDetect-BioMed" ./hf-upload

Needs about 8 GB of RAM and 4 GB of free disk. It does NOT need PyTorch.

Then, on huggingface.co: New model → upload every file in ./hf-upload →
paste "<your-user>/<your-model>" into RxDx: Control Centre → clinical model,
with Serving set to "Public hub". Press "Test it".
"""
import json, os, shutil, subprocess, sys, textwrap

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    here = os.path.dirname(os.path.abspath(__file__))

    for f in ("model.safetensors", "config.json", "tokenizer.json"):
        if not os.path.exists(os.path.join(src, f)):
            sys.exit("missing %s in %s" % (f, src))

    print("1/3  exporting to ONNX (this is the slow part)…", flush=True)
    r = subprocess.run([sys.executable, os.path.join(here, "export_onnx.py"),
                        src, out, "--quantize"])
    if r.returncode != 0:
        sys.exit("\nExport failed. If it was killed, the machine ran out of memory —\n"
                 "close other programs and try again, or run it on a machine with 8 GB+.")

    onnx_dir = os.path.join(out, "onnx")
    q = os.path.join(onnx_dir, "model_quantized.onnx")
    if not os.path.exists(q):
        sys.exit("\nQuantisation did not produce model_quantized.onnx.\n"
                 "The fp32 model is about 1.3 GB — too large for a browser. Re-run with more memory.")

    print("2/3  removing the fp32 copy, which the browser does not need…", flush=True)
    for f in ("model.onnx", "model.onnx_data"):
        p = os.path.join(onnx_dir, f)
        if os.path.exists(p):
            print("     dropped %s (%.0f MB)" % (f, os.path.getsize(p) / 1048576))
            os.remove(p)

    print("3/3  writing the model card…", flush=True)
    cfg = json.load(open(os.path.join(out, "config.json"), encoding="utf-8"))
    labels = cfg.get("id2label", {})
    size = os.path.getsize(q) / 1048576
    open(os.path.join(out, "README.md"), "w", encoding="utf-8").write(textwrap.dedent(f"""\
        ---
        library_name: transformers.js
        pipeline_tag: token-classification
        tags: [onnx, transformers.js, biomedical, disease, ner]
        license: apache-2.0
        ---

        # OpenMed disease NER — ONNX build for the browser

        An int8 ONNX export of an OpenMed DISEASE NER checkpoint, in the layout
        Transformers.js expects. It runs inside a browser tab, so clinical text
        never leaves the device.

        Labels: {", ".join(labels.values()) if labels else "O, B-DISEASE, I-DISEASE"}
        Quantised weights: {size:.0f} MB

        ## Measured behaviour

        Measured on 30 hand-labelled clinical notes:

        | configuration | F1 | denied findings kept out |
        |---|---|---|
        | Rule-based word list alone | 68.4% | 100% |
        | This model alone | 52.2% | **34.4%** |
        | This model + a negation layer | 66.7% | 100% |
        | Word list + this model | **69.0%** | 100% |

        **Do not run this model on its own for clinical coding.** It tags every
        disease *mention*, including ones written as absent. On its own it coded
        two thirds of the findings a doctor had explicitly denied. Pair it with a
        negation layer.

        ## Use

        ```js
        import {{ pipeline }} from '@xenova/transformers';
        const ner = await pipeline('token-classification', '<your-user>/<this-model>');
        ```
        """))
    files = []
    for root, _, fs in os.walk(out):
        for f in fs:
            p = os.path.join(root, f)
            files.append((os.path.relpath(p, out), os.path.getsize(p) / 1048576))
    print("\nReady to upload — %s\n" % out)
    for n, s in sorted(files, key=lambda x: -x[1]):
        print("   %-38s %8.1f MB" % (n, s))
    print("\n   total %.0f MB" % sum(s for _, s in files))
    print("\nNext: huggingface.co → New model → upload these files → paste the")
    print("model id into RxDx (Control Centre → clinical model, Serving = Public hub).")

if __name__ == "__main__":
    main()
