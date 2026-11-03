```python
import numpy as np
import scipy.linalg as la
from threadpoolctl import threadpool_limits
threadpool_limits(4)

def norm(x):
    return float(la.norm(x))

print("All calculations below are weight-only linear algebra; no network evaluations.")
for l in range(4):
    print("\nLAYER", l)
    for name in ["ln1_w", "ln1_b", "ln2_w", "ln2_b"]:
        a = W[f"{name}.{l}"].astype(np.float64)
        print(name, "min/mean/max/std/norm",
              np.round([a.min(), a.mean(), a.max(), a.std(), norm(a)], 5))
    for name in ["W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"]:
        a = W[f"{name}.{l}"].astype(np.float64)
        s = la.svdvals(a)
        print(name, "Frob", round(norm(a), 4),
              "top8_sv", np.round(s[:8], 4),
              "stable_rank", round(np.sum(s*s)/(s[0]*s[0]), 3))
    print("HEAD: QK_frob QK_top4_sv QK_top1_energy QK_sym_fraction QK_trace; "
          "OV_frob OV_top4_sv OV_trace OV_eig_posmax OV_eig_negmin")
    for j in range(6):
        sl = slice(64*j, 64*(j+1))
        q = W[f"W_q.{l}"][sl].astype(np.float64)
        k = W[f"W_k.{l}"][sl].astype(np.float64)
        v = W[f"W_v.{l}"][sl].astype(np.float64)
        o = W[f"W_o.{l}"][:, sl].astype(np.float64)
        a = q.T @ k
        b = o @ v
        sa, sb = la.svdvals(a)[:64], la.svdvals(b)[:64]
        eb = la.eigvals(v @ o)
        print(f"L{l}H{j}",
              round(norm(a), 4), np.round(sa[:4], 4),
              round(sa[0]**2/np.sum(sa**2), 4),
              round(norm((a+a.T)/2)/norm(a), 4), round(np.trace(a), 4),
              ";", round(norm(b), 4), np.round(sb[:4], 4),
              round(np.trace(b), 4), round(eb.real.max(), 4),
              round(eb.real.min(), 4))
```
