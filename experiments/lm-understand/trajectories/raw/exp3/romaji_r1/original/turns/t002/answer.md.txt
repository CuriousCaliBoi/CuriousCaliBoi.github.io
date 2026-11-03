```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

for l in range(4):
    print("\nLAYER",l)
    for name in ["W_q","W_k","W_v","W_o","W_fc","W_proj"]:
        a=W[f"{name}.{l}"].astype(float)
        sv=np.linalg.svd(a,compute_uv=False)
        print(name,"sv12",np.round(sv[:12],3),
              "energy ranks 1,5,10,28,64",np.round([np.sum(sv[:r]**2)/np.sum(sv**2) for r in [1,5,10,28,64]],3))
    g=W[f"ln1_w.{l}"].astype(float)
    b=W[f"ln1_b.{l}"].astype(float)
    for j in range(6):
        s=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][s].astype(float)
        k=W[f"W_k.{l}"][s].astype(float)
        v=W[f"W_v.{l}"][s].astype(float)
        o=W[f"W_o.{l}"][:,s].astype(float)
        e=np.linalg.eigvals((k*g)@(q*g).T/8)
        e=e[np.argsort(-abs(e))]
        A=(q*g).T@(k*g)/8
        keybias=(q@b)@(k*g)/8
        u,sv,vt=np.linalg.svd(A,full_matrices=False)
        print("L%dH%d"%(l,j),"QK eig12",np.round(e[:12],3),
              "keybias_norm=%.3f"%np.linalg.norm(keybias),
              "keybias_topright=%.3f"%(keybias@vt[0]/(np.linalg.norm(keybias)+1e-12)))
    print("LN1 largest bias coords", sorted(enumerate(b),key=lambda z:-abs(z[1]))[:8])

print("\nFIRST-LAYER HEAD QK AND OV COSINES")
As=[];Bs=[]
for j in range(6):
    s=slice(64*j,64*(j+1)); g=W["ln1_w.0"]
    As.append((W["W_q.0"][s]*g).T@(W["W_k.0"][s]*g)/8)
    Bs.append(W["W_o.0"][:,s]@(W["W_v.0"][s]*g))
for label,mat in [("QK",As),("OV",Bs)]:
    print(label)
    print(np.round([[np.sum(a*b)/(np.linalg.norm(a)*np.linalg.norm(b)) for b in mat] for a in mat],3))
```
