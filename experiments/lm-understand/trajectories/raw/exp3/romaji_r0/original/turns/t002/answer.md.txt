```python
import numpy as np
from scipy.linalg import svdvals
from threadpoolctl import threadpool_limits

def cosine(a, b):
    return float(np.vdot(a, b) / (np.linalg.norm(a)*np.linalg.norm(b)))

with threadpool_limits(limits=4):
    print("Layer 0 singular spectra (first 60, then indices 80, 120, 200, 300, 383):")
    for name in ("W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"):
        s = svdvals(W[f"{name}.0"].astype(float))
        print(name, np.round(s[:60], 3))
        print("tail", np.round(s[[80,120,200,300,383]], 4))

    qks, ovs = [], []
    print("\nLayer 0 individual-head spectra (top 12):")
    for j in range(6):
        sl = slice(64*j, 64*(j+1))
        q = W["W_q.0"][sl].astype(float)
        k = W["W_k.0"][sl].astype(float)
        v = W["W_v.0"][sl].astype(float)
        o = W["W_o.0"][:,sl].astype(float)
        qks.append(q.T @ k / 8)
        ovs.append(o @ v)
        print("H", j, "QK", np.round(svdvals(qks[-1])[:12], 4),
              "OV", np.round(svdvals(ovs[-1])[:12], 4))
    print("\nLayer 0 QK Frobenius cosines")
    print(np.round([[cosine(a,b) for b in qks] for a in qks], 3))
    print("Layer 0 OV Frobenius cosines")
    print(np.round([[cosine(a,b) for b in ovs] for a in ovs], 3))

    print("\nLayerNorm largest absolute bias coordinates:")
    for l in range(4):
        for name in ("ln1_b", "ln2_b"):
            a = W[f"{name}.{l}"]
            ix = np.argsort(np.abs(a))[-8:][::-1]
            print(f"{name}.{l}", list(zip(ix.tolist(), np.round(a[ix],4).tolist())))

    print("\nAffine QK algebra using learned LN scale and bias:")
    print("head | ||A||, top SV, stable rank, tr(A), ||key-linear coefficient||,"
          " coefficient fraction in top key singular direction")
    for l in range(4):
        g = W[f"ln1_w.{l}"].astype(float)
        b = W[f"ln1_b.{l}"].astype(float)
        for j in range(6):
            sl = slice(64*j, 64*(j+1))
            q = W[f"W_q.{l}"][sl].astype(float)
            k = W[f"W_k.{l}"][sl].astype(float)
            qg, kg = q*g, k*g
            qg -= qg.mean(axis=1, keepdims=True)
            kg -= kg.mean(axis=1, keepdims=True)
            a = qg.T @ kg / 8
            u, s, vt = np.linalg.svd(a, full_matrices=False)
            c = (q@b) @ kg / 8
            frac = abs(c@vt[0])/(np.linalg.norm(c)+1e-30)
            print(f"L{l}H{j}", np.round([np.linalg.norm(a),s[0],
                  (s*s).sum()/s[0]**2,np.trace(a),np.linalg.norm(c),frac],4))
```
