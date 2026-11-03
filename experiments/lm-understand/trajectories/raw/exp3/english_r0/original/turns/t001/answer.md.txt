```python
import numpy as np
from scipy.linalg import svdvals
from threadpoolctl import threadpool_limits

np.set_printoptions(precision=4, suppress=True)
with threadpool_limits(limits=4):
    print("WEIGHTS")
    for name in sorted(W):
        a = W[name]
        print(name, a.shape, "mean", float(a.mean()), "std", float(a.std()),
              "norm", float(np.linalg.norm(a)), "min/max", float(a.min()), float(a.max()))
    print("\nHEAD SPECTRA: QK = Q.T @ K / 8; OV = O @ V")
    for l in range(4):
        for j in range(6):
            s = slice(64*j, 64*(j+1))
            q, k, v, o = (W[f"W_q.{l}"][s], W[f"W_k.{l}"][s],
                           W[f"W_v.{l}"][s], W[f"W_o.{l}"][:,s])
            a, b = q.T @ k / 8, o @ v
            sa, sb = svdvals(a), svdvals(b)
            print(f"L{l}H{j}",
                  "Q/K/V/O norms", np.round([np.linalg.norm(z) for z in (q,k,v,o)], 3),
                  "QK top", np.round(sa[:8], 3),
                  "QK stable rank", round(float((sa@sa)/(sa[0]**2)), 2),
                  "QK symmetric fraction", round(float(np.linalg.norm(a+a.T)/(2*np.linalg.norm(a))), 3),
                  "OV top", np.round(sb[:6], 3),
                  "OV trace/nuclear", round(float(np.trace(b)/sb.sum()), 3))
```
