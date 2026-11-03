```python
import numpy as np
import torch
from scipy.linalg import eig
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
g=T(W["ln1_w.0"])
m={}
for j in [1,5]:
    sl=slice(64*j,64*(j+1))
    q=(T(W["W_q.0"])[sl]*g)@P
    k=(T(W["W_k.0"])[sl]*g)@P
    m[j]=q.T@k/8
c=sum(a@a.T+a.T@a for a in m.values())
_,u=torch.linalg.eigh(c)
u=u.flip(1)

print("Relative-shift diagnostic using only generalized eigenvectors of QK weight products.")
print("For shared rotational modes, phase(H1) approximately k*phase(H5) would suggest a lag ratio k.")
for r in [12,16,20,24,28,32,40]:
    z=u[:,:r]
    a=(z.T@m[1]@z).numpy()
    b=(z.T@m[5]@z).numpy()
    ev,vec=eig(b.T,b)
    rows=[]
    for i,x in enumerate(ev):
        if not np.isfinite(x) or x.imag<=1e-5 or abs(abs(x)-1)>.12:
            continue
        v=vec[:,i]
        av=a@v
        atv=a.T@v
        overlap=np.vdot(av,atv)/(np.linalg.norm(av)*np.linalg.norm(atv)+1e-15)
        rows.append((float(np.angle(x)),float(np.angle(overlap)),float(abs(overlap))))
    print("\nrank",r,"(H5 phase,H1 phase,mode agreement)",np.round(rows,3).tolist())
    if rows:
        p,q,w=np.array(rows).T
        print("phase agreement for H1/H5 lag ratios -3,-2,-1,1,2,3,4:",
              [(k,round(float(np.average(np.cos(q-k*p),weights=w**4)),3))
               for k in [-3,-2,-1,1,2,3,4]])
```
