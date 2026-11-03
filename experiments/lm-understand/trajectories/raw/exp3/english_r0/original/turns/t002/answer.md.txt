```python
import numpy as np
from scipy.linalg import svd, svdvals, eigvals
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=3, suppress=True, linewidth=180)

with threadpool_limits(limits=4):
    print("L0 GAIN DISTRIBUTIONS")
    for name in ["ln1_w.0", "ln2_w.0"]:
        a = W[name]
        print(name, "quantiles", np.quantile(a, [0,.1,.25,.5,.75,.9,.95,1]))
        ids = np.argsort(a)[-45:][::-1]
        print("largest coordinates", list(zip(ids.tolist(), np.round(a[ids],3).tolist())))
    print("\nL0 SINGULAR VALUES")
    for name in ["W_q.0","W_k.0","W_v.0","W_o.0","W_fc.0","W_proj.0"]:
        s = svdvals(W[name])
        print(name, "top 40", s[:40], "tail quantiles", np.quantile(s, [.1,.25,.5,.75]))
    print("\nGAIN-WEIGHTED HEAD PRODUCTS (weight algebra only)")
    for l in range(4):
        g, b = W[f"ln1_w.{l}"], W[f"ln1_b.{l}"]
        for j in range(6):
            s = slice(64*j,64*(j+1))
            q, k = W[f"W_q.{l}"][s], W[f"W_k.{l}"][s]
            a = (q*g).T @ (k*g) / 8
            a = a-a.mean(0,keepdims=True)-a.mean(1,keepdims=True)+a.mean()
            sv = svdvals(a)
            e = eigvals(a)
            e = e[np.argsort(np.abs(e))[::-1]]
            key_bias = (k*g).T @ (q@b)/8
            query_bias = (q*g).T @ (k@b)/8
            print(f"L{l}H{j}", "norm", round(float(np.linalg.norm(a)),3),
                  "top sv", sv[:6], "rank", round(float((sv@sv)/sv[0]**2),2),
                  "bias key/query norms", np.round([np.linalg.norm(key_bias),np.linalg.norm(query_bias)],3),
                  "eigenvalues", e[:6])
    print("\nL0 QK COORDINATE CONCENTRATION")
    for j in range(6):
        s=slice(64*j,64*(j+1))
        q,k=W["W_q.0"][s],W["W_k.0"][s]
        energy=(q*q).sum(0)+(k*k).sum(0)
        ids=np.argsort(energy)[-24:][::-1]
        print("H",j,"top coordinates",ids, "energy",energy[ids],
              "ln1",W["ln1_w.0"][ids],"ln2",W["ln2_w.0"][ids])
```
