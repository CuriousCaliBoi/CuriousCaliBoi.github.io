```python
import numpy as np
import scipy.linalg as la
from threadpoolctl import threadpool_limits
threadpool_limits(4)

A, B = {}, {}
for l in range(4):
    w = W[f"ln1_w.{l}"].astype(float)
    bias = W[f"ln1_b.{l}"].astype(float)
    print("\nLAYER", l, "(gain-weighted matrices; no LayerNorm evaluation)")
    for j in range(6):
        s = slice(64*j, 64*(j+1))
        q0 = W[f"W_q.{l}"][s].astype(float)
        k0 = W[f"W_k.{l}"][s].astype(float)
        v0 = W[f"W_v.{l}"][s].astype(float)
        o = W[f"W_o.{l}"][:,s].astype(float)
        q, k, v = q0*w, k0*w, v0*w
        a, b = q.T@k, o@v
        A[l,j], B[l,j] = a, b
        sv = la.svdvals(a)[:64]
        qb, kb = q0@bias, k0@bias
        key_linear = k.T@qb
        query_linear = q.T@kb
        print(f"L{l}H{j}",
              "QKnorm", round(la.norm(a),4),
              "QKsv", np.round(sv[:6],4),
              "QKtrace", round(np.trace(a),4),
              "OVnorm", round(la.norm(b),4),
              "bias_key/query_norm", np.round([la.norm(key_linear),la.norm(query_linear)],4))

print("\nNormalized trace(A_lh @ B_0j), columns L0H0..L0H5")
for l in range(1,4):
    for j in range(6):
        a = A[l,j]
        vals = [np.trace(a@B[0,k])/(la.norm(a)*la.norm(B[0,k])) for k in range(6)]
        print(f"L{l}H{j}", np.round(vals,4))

print("\nLargest earlier-head trace compositions (signed normalized trace)")
for l in range(2,4):
    for j in range(6):
        a = A[l,j]
        vals = []
        for m in range(l):
            for k in range(6):
                b = B[m,k]
                vals.append((float(np.trace(a@b)/(la.norm(a)*la.norm(b))), f"L{m}H{k}"))
        print(f"L{l}H{j}", sorted(vals, reverse=True)[:5])

print("\nL0H2 effective QK spectrum")
a = A[0,2]
u,s,vt = la.svd(a, full_matrices=False)
print("singular values", np.round(s[:40],5))
ev = la.eigvals(a)
ix = np.argsort(abs(ev))[::-1][:24]
print("largest eigenvalues", np.round(ev[ix],4))
print("left/right top-20 subspace overlap", np.round(la.svdvals(u[:,:20].T@vt[:20].T),4))

print("\nL0 query/key and value subspace overlap with L0H2 dominant QK subspace")
p = la.orth(np.column_stack([u[:,:20],vt[:20].T]))
for j in range(6):
    s0 = slice(64*j,64*(j+1))
    vals=[]
    for name in ["W_q","W_k","W_v"]:
        m = W[f"{name}.0"][s0].astype(float)*W["ln1_w.0"]
        vals.append(la.norm(m@p)**2/la.norm(m)**2)
    print(f"L0H{j}", np.round(vals,4))
```
