```python
import numpy as np
import torch
from scipy.linalg import eig
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384

print("Final MLP output weights after linear regression on input weights.")
print("This is weight-space regression only, not evaluation of an MLP.")
f=T(W["W_fc.3"])
o=P@T(W["W_proj.3"])
alpha=-float((o*f.T).sum()/f.square().sum())
print("Best scalar cancellation coefficient",round(alpha,5))
u,s,vh=torch.linalg.svd(f,full_matrices=False)
for method in ["scalar","regress"]:
    if method=="scalar":
        r=o+alpha*(P@f.T)
    else:
        r=o-(o@u)@u.T
    sv=torch.linalg.svdvals(r)
    print(method,"first 55 singular values",np.round(sv[:55].numpy(),3))
    ratios=sv[:-1]/sv[1:]
    ids=torch.argsort(ratios[15:45],descending=True)[:8]+15
    print("gaps",[(int(i)+1,round(float(ratios[i]),3)) for i in ids])

g=T(W["ln1_w.0"])
m={}
for j in [1,5]:
    sl=slice(64*j,64*(j+1))
    q=(T(W["W_q.0"])[sl]*g)@P
    k=(T(W["W_k.0"])[sl]*g)@P
    m[j]=q.T@k/8
c=sum(a@a.T+a.T@a for a in m.values())
ee,uu=torch.linalg.eigh(c)
uu=uu.flip(1)

print("\nShared QK subspace: congruence-invariant phase diagnostics.")
for r in [8,12,16,20,24,28]:
    z=uu[:,:r]
    a=(z.T@m[1]@z).numpy()
    b=(z.T@m[5]@z).numpy()
    print("rank",r)
    for label,x,y in [("H1 versus transpose",a,a.T),
                       ("H5 versus transpose",b,b.T),
                       ("H1 versus H5",a,b)]:
        ev=eig(x,y,right=False)
        good=ev[np.isfinite(ev)]
        positive=good[good.imag>1e-5]
        positive=positive[np.argsort(np.angle(positive))]
        print(label,[(round(float(np.angle(v)),3),round(float(abs(v)),3)) for v in positive])
```
