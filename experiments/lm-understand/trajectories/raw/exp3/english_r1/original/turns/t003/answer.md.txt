```python
import numpy as np
import scipy.linalg as la
from threadpoolctl import threadpool_limits
threadpool_limits(4)

for l in range(4):
    print("\nLAYER",l)
    for name in ["W_fc","W_proj"]:
        m = W[f"{name}.{l}"].astype(float)
        s = la.svdvals(m)
        print(name,"first 40 SV:",np.round(s[:40],3))
        print("SV indices 40,60,80,100,150,200,300,383:",
              np.round(s[[40,60,80,100,150,200,300,383]],3))

def head(l,j):
    sl=slice(j*64,(j+1)*64)
    w=W[f"ln1_w.{l}"].astype(float)
    q=W[f"W_q.{l}"][sl].astype(float)*w
    k=W[f"W_k.{l}"][sl].astype(float)*w
    v=W[f"W_v.{l}"][sl].astype(float)*w
    o=W[f"W_o.{l}"][:,sl].astype(float)
    return q.T@k,o@v

aa=[head(0,j)[0] for j in range(6)]
bb=[head(0,j)[1] for j in range(6)]
print("\nL0 OV matrix cosine similarities:")
print(np.round([[np.sum(x*y)/(la.norm(x)*la.norm(y)) for y in bb] for x in bb],3))
print("L0 QK matrix cosine similarities:")
print(np.round([[np.sum(x*y)/(la.norm(x)*la.norm(y)) for y in aa] for x in aa],3))

print("\nL0H2 unweighted QK singular values:")
q=W["W_q.0"][128:192].astype(float)
k=W["W_k.0"][128:192].astype(float)
u,s,vt=la.svd(q.T@k,full_matrices=False)
print(np.round(s[:48],3))
p=la.orth(np.column_stack((u[:,:20],vt[:20].T)))
print("L0 raw Q/K/V energy in this subspace:")
for j in range(6):
    print(j, np.round([la.norm(W[f"{name}.0"][64*j:64*(j+1)]@p)**2/
                       la.norm(W[f"{name}.0"][64*j:64*(j+1)])**2
                       for name in ["W_q","W_k","W_v"]],4))

print("\nL1 key-bias weight directions and L0 OV outputs")
for j in range(6):
    sl=slice(j*64,(j+1)*64)
    q=W["W_q.1"][sl].astype(float)
    k=W["W_k.1"][sl].astype(float)
    r=(k*W["ln1_w.1"]).T@(q@W["ln1_b.1"])
    vals=[]
    for b in bb:
        vals.append(la.norm(r@b)/(la.norm(r)*la.norm(b)))
    print(j,np.round(vals,4))

print("\nLinear-algebra-only MLP products: normalized trace with later QK")
# These are matrix products, not MLP evaluations: there is no ReLU or input.
mats={}
for l in range(3):
    f=W[f"W_fc.{l}"].astype(float)*W[f"ln2_w.{l}"]
    mats[l]=W[f"W_proj.{l}"].astype(float)@f
for l in range(1,4):
    for j in range(6):
        a,b=head(l,j)
        print(f"L{l}H{j}",
              np.round([np.trace(a@mats[m])/(la.norm(a)*la.norm(mats[m]))
                        for m in range(l)],4))
```
