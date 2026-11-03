```python
import numpy as np
import torch
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
g=T(W["ln1_w.0"])
v,b={},{}
for j in [1,5]:
    sl=slice(64*j,64*(j+1))
    v[j]=(T(W["W_v.0"])[sl]*g)@P
    b[j]=P@T(W["W_o.0"])[:,sl]@v[j]
_,u=torch.linalg.eigh(sum(x.T@x for x in v.values()))
z=u.flip(1)[:,:28]
f=(T(W["W_fc.0"])*T(W["ln2_w.0"]))@P
active=T(np.linalg.norm(W["W_fc.0"],axis=1)>.8).bool()
a=[(x@z)[active] for x in [f,f@b[5],f@b[1]]]
a=[x/x.norm(dim=1,keepdim=True) for x in a]
c=[]
print("Cross-covariance spectra of normalized MLP weight read-directions:")
for i,j in [(0,1),(0,2),(1,2)]:
    m=a[i].T@a[j]/len(a[i])
    c.append(m)
    se=torch.linalg.eigvalsh((m+m.T)/2)
    sv=torch.linalg.svdvals(m)
    print((i,j),"trace",round(float(torch.trace(m)),4),
          "SV",np.round(sv[:12].numpy(),4),
          "sym eigenvalues",np.round(se.numpy(),4))
print("\nCosines between the three symmetric cross-covariance matrices:")
cs=[(x+x.T)/2 for x in c]
print(np.round([[float((x*y).sum()/(x.norm()*y.norm())) for y in cs] for x in cs],3))
alt=cs[0]+cs[2]-cs[1]
e,u=torch.linalg.eigh(alt)
print("Alternation-contrast eigenvalues",np.round(e.numpy(),4))
for i in range(4):
    d=u[:,i]
    print("mode",i,"per-pair quadratic coefficients",
          np.round([float(d@m@d) for m in cs],4))
```
