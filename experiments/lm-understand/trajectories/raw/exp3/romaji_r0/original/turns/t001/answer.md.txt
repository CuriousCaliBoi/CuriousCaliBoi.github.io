```python
import numpy as np
from scipy.linalg import svdvals
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    print("LayerNorm parameters: mean, std, min, max, norm")
    for l in range(4):
        for name in ("ln1_w", "ln1_b", "ln2_w", "ln2_b"):
            a = W[f"{name}.{l}"].astype(np.float64)
            print(f"{name}.{l}", np.round([a.mean(), a.std(), a.min(), a.max(), np.linalg.norm(a)], 4))
    print("\nMatrix summaries: Frobenius norm, top singular value, stable rank")
    for l in range(4):
        for name in ("W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"):
            a = W[f"{name}.{l}"].astype(np.float64)
            s = svdvals(a)
            print(f"{name}.{l}", np.round([np.linalg.norm(a), s[0], (s*s).sum()/s[0]**2], 4))
    print("\nHead algebra (no activations):")
    print("head | QK Frobenius, top SV, stable rank, trace, symmetric eig min/max"
          " | OV Frobenius, top SV, stable rank, trace | ||Wq b||, ||Wk b||")
    for l in range(4):
        b = W[f"ln1_b.{l}"].astype(np.float64)
        for j in range(6):
            s = slice(j*64, (j+1)*64)
            q = W[f"W_q.{l}"][s].astype(np.float64)
            k = W[f"W_k.{l}"][s].astype(np.float64)
            v = W[f"W_v.{l}"][s].astype(np.float64)
            o = W[f"W_o.{l}"][:, s].astype(np.float64)
            qk = q.T @ k / 8
            ov = o @ v
            sq, so = svdvals(qk), svdvals(ov)
            eq = np.linalg.eigvalsh((qk+qk.T)/2)
            a = [np.linalg.norm(qk), sq[0], (sq*sq).sum()/sq[0]**2,
                 np.trace(qk), eq[0], eq[-1]]
            c = [np.linalg.norm(ov), so[0], (so*so).sum()/so[0]**2, np.trace(ov)]
            print(f"L{l}H{j}", np.round(a, 3), "|", np.round(c, 3), "|",
                  np.round([np.linalg.norm(q@b), np.linalg.norm(k@b)], 3))
```
