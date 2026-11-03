```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g0=W["ln1_w.0"].astype(float)
v=W["W_v.0"][192:256].astype(float)*g0
o=W["W_o.0"][:,192:256].astype(float)
B=o@v
T=np.linalg.svd(v,full_matrices=False)[2][:20].T
coords=np.array([21,39,58,99,184])
print("Counter-coordinate blocks and induction-path diagnostics")
for l in range(1,4):
    g=W[f"ln1_w.{l}"].astype(float)
    b=W[f"ln1_b.{l}"].astype(float)
    for j in range(6):
        s=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][s].astype(float)
        k=W[f"W_k.{l}"][s].astype(float)
        A=(q*g).T@(k*g)/8
        r=(q@b)@(k*g)/8
        C=T.T@A@B@T
        eig=np.linalg.eigvals(C)
        sym=np.linalg.eigvalsh((C+C.T)/2)
        print("L%dH%d"%(l,j),
              "A21,21=%.3f col21energy=%.3f row21energy=%.3f r21=%.3f"%
              (A[21,21],np.sum(A[:,21]**2)/np.sum(A*A),np.sum(A[21]**2)/np.sum(A*A),r[21]),
              "token-path tr/norm=%.3f positive_sym=%d/20"%
              (np.trace(C)/(np.linalg.norm(C)+1e-12),sum(sym>0)),
              "sym_extrema",np.round([sym[0],sym[-1]],3))
        if j in [0,3,4]:
            print("A block rows/cols",coords.tolist())
            print(np.round(A[np.ix_(coords,coords)],3))

print("\nL0 QK/OV effective ranks")
for j in range(6):
    s=slice(64*j,64*(j+1))
    A=(W["W_q.0"][s]*g0).T@(W["W_k.0"][s]*g0)/8
    B=W["W_o.0"][:,s]@(W["W_v.0"][s]*g0)
    for name,M in [("QK",A),("OV",B)]:
        sv=np.linalg.svd(M,compute_uv=False)
        energy=np.cumsum(sv**2)/np.sum(sv**2)
        print("L0H%d %s"%(j,name),"rank90/95/99",np.searchsorted(energy,[.90,.95,.99])+1)
```
