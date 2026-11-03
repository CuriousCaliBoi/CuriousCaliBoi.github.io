```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g0=W["ln1_w.0"].astype(float)
V0=W["W_v.0"][192:256].astype(float)*g0
T=np.linalg.svd(V0,full_matrices=False)[2][:20].T
B0=W["W_o.0"][:,192:256].astype(float)@V0
Uout=np.linalg.svd(W["W_proj.3"].astype(float),full_matrices=False)[0][:,:24]

print("Final heads: weight-only token-to-output and matching diagnostics")
for j in range(6):
    s=slice(j*64,(j+1)*64)
    g=W["ln1_w.3"].astype(float)
    A=(W["W_q.3"][s]*g).T@(W["W_k.3"][s]*g)/8
    B=W["W_o.3"][:,s].astype(float)@(W["W_v.3"][s]*g)
    D=B@T
    C=T.T@A@B0@T
    print("L3H%d"%j,
          "OV token-map norm %.3f output-subspace energy %.3f"%
          (np.linalg.norm(D),np.linalg.norm(Uout.T@D)**2/np.linalg.norm(D)**2),
          "matching trace/norm %.3f"%(np.trace(C)/np.linalg.norm(C)),
          "matching eig real",np.round(np.sort(np.linalg.eigvals(C).real)[-6:],4))

print("\nCoordinate concentration of L0 OV output (rows 21,39,58,99,184)")
ix=[21,39,58,99,184]
for j in range(6):
    s=slice(j*64,(j+1)*64)
    B=W["W_o.0"][:,s].astype(float)@(W["W_v.0"][s]*g0)
    print("L0H%d"%j,round(np.sum(B[ix]**2)/np.sum(B**2),4))

print("\nInduction matching control: signed/permuted head-output coordinates")
rng=np.random.default_rng(1022)
s=slice(192,256);g=W["ln1_w.3"].astype(float)
A=(W["W_q.3"][s]*g).T@(W["W_k.3"][s]*g)/8
left=T.T@A
right=B0@T
actual=left@right
null=[]
for _ in range(1000):
    perm=rng.permutation(384)
    sign=rng.choice([-1.,1.],384)
    C=(left*sign)@right[perm]
    null.append(np.trace(C)/np.linalg.norm(C))
print("observed",np.trace(actual)/np.linalg.norm(actual),
      "null mean/std",np.mean(null),np.std(null),
      "null 1/99 percentiles",np.percentile(null,[1,99]),
      "null max",max(null))
```
