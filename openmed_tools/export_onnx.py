"""
Export an OpenMed BERT token-classification checkpoint to ONNX — without torch.

Builds the graph directly from model.safetensors using onnx.helper, so it runs
on any machine with numpy + onnx installed. Produces the exact file layout that
Transformers.js expects, so the model can run inside a browser tab with no
server and no clinical text leaving the device.

    python3 export_onnx.py <model_dir> <out_dir> [--quantize]

Output:
    <out_dir>/config.json
    <out_dir>/tokenizer.json
    <out_dir>/tokenizer_config.json
    <out_dir>/special_tokens_map.json
    <out_dir>/onnx/model.onnx
    <out_dir>/onnx/model_quantized.onnx      (with --quantize)
"""
import json, os, shutil, sys
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from openmed_ner import _load_safetensors, LazyWeights


class _G:
    """Builder that streams large weights straight to an external data file,
    so the protobuf never holds a second copy of the model in memory."""
    def __init__(self, ext_path, ext_name, threshold=4096):
        self.nodes, self.inits, self._n = [], [], 0
        self.fh = open(ext_path, "wb")
        self.ext_name = ext_name
        self.threshold = threshold

    def _tensor(self, name, arr, dtype, proto_dt):
        arr = np.ascontiguousarray(arr, dtype=dtype)
        if arr.nbytes < self.threshold:
            t = numpy_helper.from_array(arr, name)
            self.inits.append(t)
            return name
        off = self.fh.tell()
        self.fh.write(arr.tobytes())
        nbytes = arr.nbytes
        t = onnx.TensorProto()
        t.name = name
        t.data_type = proto_dt
        t.dims.extend(arr.shape)
        t.data_location = onnx.TensorProto.EXTERNAL
        for k, v in (("location", self.ext_name), ("offset", str(off)), ("length", str(nbytes))):
            e = t.external_data.add(); e.key = k; e.value = v
        self.inits.append(t)
        del arr
        return name

    def const(self, name, arr):
        return self._tensor(name, arr, np.float32, TensorProto.FLOAT)

    def const_i64(self, name, arr):
        return self._tensor(name, arr, np.int64, TensorProto.INT64)

    def close(self):
        self.fh.close()

    def op(self, kind, ins, out=None, **kw):
        self._n += 1
        out = out or ("%s_%d" % (kind.lower(), self._n))
        self.nodes.append(helper.make_node(kind, ins, [out], **kw))
        return out


def _layer_norm(g, x, w, b, eps, tag):
    mu = g.op("ReduceMean", [x], axes=[-1], keepdims=1)
    d = g.op("Sub", [x, mu])
    sq = g.op("Mul", [d, d])
    var = g.op("ReduceMean", [sq], axes=[-1], keepdims=1)
    ve = g.op("Add", [var, g.const(tag + ".eps", np.array(eps, np.float32))])
    sd = g.op("Sqrt", [ve])
    nrm = g.op("Div", [d, sd])
    sc = g.op("Mul", [nrm, w])
    return g.op("Add", [sc, b])


def build(model_dir, out_dir):
    cfg = json.load(open(os.path.join(model_dir, "config.json")))
    if cfg.get("model_type") != "bert":
        raise SystemExit("This exporter handles BERT checkpoints; %s is %s."
                         % (model_dir, cfg.get("model_type")))
    W = LazyWeights(os.path.join(model_dir, "model.safetensors"))
    H, nh = cfg["hidden_size"], cfg["num_attention_heads"]
    nl, eps = cfg["num_hidden_layers"], cfg.get("layer_norm_eps", 1e-12)
    dh = H // nh
    os.makedirs(os.path.join(out_dir, "onnx"), exist_ok=True)
    g = _G(os.path.join(out_dir, "onnx", "model.onnx_data"), "model.onnx_data")

    ids = helper.make_tensor_value_info("input_ids", TensorProto.INT64, ["batch", "sequence"])
    mask = helper.make_tensor_value_info("attention_mask", TensorProto.INT64, ["batch", "sequence"])
    tt = helper.make_tensor_value_info("token_type_ids", TensorProto.INT64, ["batch", "sequence"])

    # ---- embeddings ----
    we = g.op("Gather", [g.const("emb.word", W["bert.embeddings.word_embeddings.weight"]), "input_ids"])
    shape = g.op("Shape", ["input_ids"])
    # Gather with a scalar index yields a 0-D length, exactly what Range wants
    seq = g.op("Gather", [shape, g.const_i64("idx.seq", np.array(1, np.int64))], axis=0)
    pos_ids = g.op("Range", [g.const_i64("r0", np.array(0, np.int64)), seq,
                             g.const_i64("r1", np.array(1, np.int64))])
    pe = g.op("Gather", [g.const("emb.pos", W["bert.embeddings.position_embeddings.weight"]), pos_ids])
    te = g.op("Gather", [g.const("emb.type", W["bert.embeddings.token_type_embeddings.weight"]), "token_type_ids"])
    x = g.op("Add", [g.op("Add", [we, pe]), te])
    x = _layer_norm(g, x, g.const("emb.ln.w", W["bert.embeddings.LayerNorm.weight"]),
                    g.const("emb.ln.b", W["bert.embeddings.LayerNorm.bias"]), eps, "emb")

    # ---- attention mask -> additive bias [batch,1,1,seq] ----
    mf = g.op("Cast", ["attention_mask"], to=TensorProto.FLOAT)
    m4 = g.op("Unsqueeze", [mf, g.const_i64("unsq.ax", [1, 2])])
    inv = g.op("Sub", [g.const("one", np.array(1.0, np.float32)), m4])
    bias = g.op("Mul", [inv, g.const("neg", np.array(-10000.0, np.float32))])

    for i in range(nl):
        print("  layer %d/%d  nodes=%d  ext=%.0f MB" % (i+1, nl, len(g.nodes), g.fh.tell()/1e6), flush=True)
        p = "bert.encoder.layer.%d." % i
        t = "l%d" % i
        def lin(nm, src):
            wt = W[p + nm + ".weight"].T
            return g.op("Add", [g.op("MatMul", [src, g.const(t + "." + nm + ".w", wt)]),
                                g.const(t + "." + nm + ".b", W[p + nm + ".bias"])])
        q, k, v = lin("attention.self.query", x), lin("attention.self.key", x), lin("attention.self.value", x)
        def split(src, nm):
            r = g.op("Reshape", [src, g.const_i64(t + nm + ".shp", [0, 0, nh, dh])])
            return g.op("Transpose", [r], perm=[0, 2, 1, 3])
        qh, kh, vh = split(q, ".q"), split(k, ".k"), split(v, ".v")
        kt = g.op("Transpose", [kh], perm=[0, 1, 3, 2])
        sc = g.op("Div", [g.op("MatMul", [qh, kt]),
                          g.const(t + ".scale", np.array(np.sqrt(dh), np.float32))])
        at = g.op("Softmax", [g.op("Add", [sc, bias])], axis=-1)
        ctx = g.op("Transpose", [g.op("MatMul", [at, vh])], perm=[0, 2, 1, 3])
        ctx = g.op("Reshape", [ctx, g.const_i64(t + ".merge", [0, 0, H])])
        ao = g.op("Add", [g.op("MatMul", [ctx, g.const(t + ".ao.w", W[p + "attention.output.dense.weight"].T)]),
                          g.const(t + ".ao.b", W[p + "attention.output.dense.bias"])])
        x = _layer_norm(g, g.op("Add", [ao, x]),
                        g.const(t + ".ln1.w", W[p + "attention.output.LayerNorm.weight"]),
                        g.const(t + ".ln1.b", W[p + "attention.output.LayerNorm.bias"]), eps, t + ".ln1")
        inter = g.op("Add", [g.op("MatMul", [x, g.const(t + ".int.w", W[p + "intermediate.dense.weight"].T)]),
                             g.const(t + ".int.b", W[p + "intermediate.dense.bias"])])
        act = g.op("Gelu", [inter], approximate="tanh") if False else g.op("Erf", [
            g.op("Div", [inter, g.const(t + ".sq2", np.array(np.sqrt(2.0), np.float32))])])
        act = g.op("Mul", [g.op("Mul", [inter, g.const(t + ".half", np.array(0.5, np.float32))]),
                           g.op("Add", [act, g.const(t + ".one", np.array(1.0, np.float32))])])
        outp = g.op("Add", [g.op("MatMul", [act, g.const(t + ".out.w", W[p + "output.dense.weight"].T)]),
                            g.const(t + ".out.b", W[p + "output.dense.bias"])])
        x = _layer_norm(g, g.op("Add", [outp, x]),
                        g.const(t + ".ln2.w", W[p + "output.LayerNorm.weight"]),
                        g.const(t + ".ln2.b", W[p + "output.LayerNorm.bias"]), eps, t + ".ln2")

    logits = g.op("Add", [g.op("MatMul", [x, g.const("cls.w", W["classifier.weight"].T)]),
                          g.const("cls.b", W["classifier.bias"])], out="logits")
    out_vi = helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", "sequence", len(cfg["id2label"])])
    graph = helper.make_graph(g.nodes, "openmed_token_classification", [ids, mask, tt], [out_vi], g.inits)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)],
                              producer_name="RxDx-openmed-export")
    model.ir_version = 9

    print("  graph built, serialising protobuf...", flush=True)
    g.close()
    path = os.path.join(out_dir, "onnx", "model.onnx")
    onnx.save(model, path)
    for f in ("config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"):
        src = os.path.join(model_dir, f)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(out_dir, f))
    json.dump({"modes": ["int8"], "per_channel": False, "reduce_range": False},
              open(os.path.join(out_dir, "quantize_config.json"), "w"), indent=1)
    json.dump({"inputs": ["input_ids", "attention_mask", "token_type_ids"],
               "outputs": ["logits"], "task": "token-classification",
               "labels": cfg["id2label"], "opset": 13},
              open(os.path.join(out_dir, "transformersjs-contract.json"), "w"), indent=1)
    return path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    p = build(sys.argv[1], sys.argv[2])
    print("wrote", p, "%.0f MB" % (sum(os.path.getsize(os.path.join(os.path.dirname(p), f))
                                       for f in os.listdir(os.path.dirname(p))) / 1e6))
    if "--quantize" in sys.argv:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        q = os.path.join(os.path.dirname(p), "model_quantized.onnx")
        quantize_dynamic(p, q, weight_type=QuantType.QInt8)
        print("quantized ->", q, "%.0f MB" % (os.path.getsize(q) / 1e6))
