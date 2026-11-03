```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

def summary(a):
    return "norm=%.3f mean=%.5f std=%.5f min=%.4f max=%.4f" % (
        np.linalg.norm(a), a.mean(), a.std(), a.min(), a.max())

for l in range(4):
    print("\nLAYER", l)
    for name in ["ln1_w", "ln1_b", "ln2_w", "ln2_b", "W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"]:
        print(name, summary(W[f"{name}.{l}"]))
    print("head: Qnorm Knorm Vnorm Onorm | QK sv(top6), top1_energy, symmetry, trace/norm | OV sv(top4), trace/norm")
    for j in range(6):
        s = slice(j*64, (j+1)*64)
        q = W[f"W_q.{l}"][s].astype(float)
        k = W[f"W_k.{l}"][s].astype(float)
        v = W[f"W_v.{l}"][s].astype(float)
        o = W[f"W_o.{l}"][:, s].astype(float)
        g = W[f"ln1_w.{l}"]
        A = (q*g).T @ (k*g) / 8
        B = o @ (v*g)
        sa = np.linalg.svd(A, compute_uv=False)[:64]
        sb = np.linalg.svd(B, compute_uv=False)[:64]
        print("L%dH%d" % (l,j),
              np.round([np.linalg.norm(z) for z in [q,k,v,o]], 3),
              "|", np.round(sa[:6],3), "E1=%.3f sym=%.3f tr=%.3f" %
              (sa[0]**2/(sa@sa), np.sum(A*A.T)/np.sum(A*A), np.trace(A)/np.linalg.norm(A)),
              "|", np.round(sb[:4],3), "tr=%.3f" % (np.trace(B)/np.linalg.norm(B)))
```
