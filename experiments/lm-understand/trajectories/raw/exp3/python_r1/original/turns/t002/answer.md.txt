```python
import numpy as np
from scipy.linalg import svd, svdvals
from threadpoolctl import threadpool_limits
threadpool_limits(4)

for name in ["W_q.0", "W_k.0", "W_v.0", "W_fc.0", "W_proj.0", "W_proj.3"]:
    a = np.asarray(W[name], dtype=np.float64)
    s = svdvals(a, check_finite=False)
    print(name, "first 48 singular values:", np.round(s[:48], 4))
    print("singular values 64,96,128,192,256,320,384:",
          np.round(s[np.array([64,96,128,192,256,320,384])-1],4))

A, C, Q, K = {}, {}, {}, {}
for l in range(4):
    g = np.asarray(W[f"ln1_w.{l}"],dtype=float)
    for j in range(6):
        sl = slice(j*64,(j+1)*64)
        name = f"L{l}H{j}"
        Q[name] = np.asarray(W[f"W_q.{l}"][sl],dtype=float)*g
        K[name] = np.asarray(W[f"W_k.{l}"][sl],dtype=float)*g
        A[name] = Q[name].T @ K[name] / 8
        C[name] = np.asarray(W[f"W_o.{l}"][:,sl],dtype=float) @ (
            np.asarray(W[f"W_v.{l}"][sl],dtype=float)*g)

names = list(A)
print("\nL0 QK eigenvalues with greatest absolute value:")
for n in names[:6]:
    z = np.linalg.eigvals(A[n])
    z = z[np.argsort(-np.abs(z))][:16]
    print(n, np.round(z,4))

print("\nL0 QK pairwise normalized Frobenius inner products:")
print(np.round([[np.sum(A[a]*A[b])/np.linalg.norm(A[a])/np.linalg.norm(A[b])
                 for b in names[:6]] for a in names[:6]],3))
print("\nL1 QK pairwise normalized Frobenius inner products:")
print(np.round([[np.sum(A[a]*A[b])/np.linalg.norm(A[a])/np.linalg.norm(A[b])
                 for b in names[6:12]] for a in names[6:12]],3))

print("\nEarlier-head output to later-head query/key weight composition.")
print("Each entry: ||Q_l C_earlier||F/(||Q_l||F ||C_earlier||F), and analogous K; random-isotropic scale ~0.051.")
for l in range(1,4):
    earlier = [f"L{a}H{b}" for a in range(l) for b in range(6)]
    print("earlier:", " ".join(earlier))
    for j in range(6):
        n = f"L{l}H{j}"
        qc = [np.linalg.norm(Q[n]@C[e])/np.linalg.norm(Q[n])/np.linalg.norm(C[e]) for e in earlier]
        kc = [np.linalg.norm(K[n]@C[e])/np.linalg.norm(K[n])/np.linalg.norm(C[e]) for e in earlier]
        print(n, "Q", np.round(qc,3), "K", np.round(kc,3))

print("\nLayer-0 effective input-weight joint spectrum:")
m = np.concatenate([W[f"{name}.0"]*W["ln1_w.0"] for name in ["W_q","W_k","W_v"]])
u,s,vt = svd(m,full_matrices=False,check_finite=False)
print(np.round(s[:80],4))
print("L0 ln1 gain quantiles:",np.round(np.quantile(W["ln1_w.0"],[0,.1,.25,.5,.75,.9,.95,1]),4))
print("\nFinal projection column norms quantiles:",
      np.round(np.quantile(np.linalg.norm(W["W_proj.3"],axis=0),[0,.1,.25,.5,.75,.9,1]),4))
```
