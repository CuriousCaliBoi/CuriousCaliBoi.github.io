```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

As={};Bs={}
for l in range(4):
    g=W[f"ln1_w.{l}"].astype(float)
    for j in range(6):
        s=slice(64*j,64*(j+1))
        As[l,j]=(W[f"W_q.{l}"][s]*g).T@(W[f"W_k.{l}"][s]*g)/8
        Bs[l,j]=W[f"W_o.{l}"][:,s].astype(float)@(W[f"W_v.{l}"][s]*g)
print("Trace(A_lh B_0j)/||A_lh B_0j||, for j=0..5 (positive matching composition)")
for l in range(1,4):
    for h in range(6):
        vals=[]
        for j in range(6):
            C=As[l,h]@Bs[0,j]
            vals.append(np.trace(C)/np.linalg.norm(C))
        print("L%dH%d"%(l,h),np.round(vals,3))

print("\nStrongest matching compositions over ALL preceding heads")
for l in range(1,4):
    for h in range(6):
        vals=[]
        for p in range(l):
            for j in range(6):
                C=As[l,h]@Bs[p,j]
                vals.append((np.trace(C)/np.linalg.norm(C),p,j))
        print("L%dH%d"%(l,h),[(round(x,3),p,j) for x,p,j in sorted(vals,reverse=True)[:4]])

print("\nL0H3 Q,K,V singular spectra")
for name in ["W_q","W_k","W_v"]:
    a=W[f"{name}.0"][192:256].astype(float)
    print(name,np.round(np.linalg.svd(a,compute_uv=False),3))
print("\nMLP0 input spectrum")
a=W["W_fc.0"].astype(float)*W["ln2_w.0"]
print(np.round(np.linalg.svd(a,compute_uv=False)[:100],3))

print("\nPositional-like QK L0H3 versus value subspaces: squared overlap")
_,_,qv=np.linalg.svd(W["W_q.0"][192:256],full_matrices=False)
_,_,kv=np.linalg.svd(W["W_k.0"][192:256],full_matrices=False)
_,_,vv=np.linalg.svd(W["W_v.0"][192:256],full_matrices=False)
for r in [16,24,28,32,40]:
    print(r, "Q/K",np.linalg.norm(qv[:r]@kv[:r].T)**2/r,
          "Q/V",np.linalg.norm(qv[:r]@vv[:r].T)**2/r,
          "K/V",np.linalg.norm(kv[:r]@vv[:r].T)**2/r)
```
