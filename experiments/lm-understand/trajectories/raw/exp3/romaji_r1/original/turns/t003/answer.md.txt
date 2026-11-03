```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

print("Last MLP output singular values:")
for l in [0,3]:
    sv=np.linalg.svd(W[f"W_proj.{l}"].astype(float),compute_uv=False)
    print("L",l,np.round(sv[:48],4))

print("\nL0 head singular-vector coordinate structure")
As=[];Bs=[]
g=W["ln1_w.0"].astype(float)
for j in range(6):
    s=slice(64*j,64*(j+1))
    q=W["W_q.0"][s].astype(float); k=W["W_k.0"][s].astype(float)
    A=(q*g).T@(k*g)/8
    B=W["W_o.0"][:,s].astype(float)@(W["W_v.0"][s].astype(float)*g)
    As.append(A); Bs.append(B)
    ua,sa,va=np.linalg.svd(A,full_matrices=False)
    ub,sb,vb=np.linalg.svd(B,full_matrices=False)
    print("L0H%d"%j)
    for label,z in [("QK left1",ua[:,0]),("QK right1",va[0]),("OV left1",ub[:,0]),("OV right1",vb[0]),("OV left2",ub[:,1])]:
        ix=np.argsort(-abs(z))[:8]
        print(label,list(zip(ix.tolist(),np.round(z[ix],3).tolist())))
    print("unscaled QK sv",np.round(np.linalg.svd(q.T@k/8,compute_uv=False)[:12],3))

print("\nKey-bias similarities within layers (weight-only affine coefficients)")
for l in range(1,4):
    g=W[f"ln1_w.{l}"].astype(float); b=W[f"ln1_b.{l}"].astype(float)
    R=[]
    for j in range(6):
        s=slice(j*64,(j+1)*64)
        r=(W[f"W_q.{l}"][s]@b)@(W[f"W_k.{l}"][s]*g)/8
        R.append(r/np.linalg.norm(r))
    print("L",l,np.round(np.array(R)@np.array(R).T,2))
    for j,r in enumerate(R):
        ix=np.argsort(-abs(r))[:6]
        print("H",j,"top coords",list(zip(ix.tolist(),np.round(r[ix],3).tolist())),
              "OV0 output align",np.round([r@np.linalg.svd(B,full_matrices=False)[0][:,0] for B in Bs],3))
```
