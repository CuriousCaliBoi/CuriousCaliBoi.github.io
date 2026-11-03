```python
import numpy as np
import torch
from sklearn.cluster import DBSCAN
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
g=T(W["ln1_w.0"])
vs={}
bs={}
for j in [1,5]:
    sl=slice(64*j,64*(j+1))
    vs[j]=(T(W["W_v.0"])[sl]*g)@P
    bs[j]=P@T(W["W_o.0"])[:,sl]@vs[j]
_,u=torch.linalg.eigh(sum(v.T@v for v in vs.values()))
u=u.flip(1)
f=(T(W["W_fc.0"])*T(W["ln2_w.0"]))@P
active=np.linalg.norm(W["W_fc.0"],axis=1)>.8
ids=np.flatnonzero(active)

print("Static MLP read-direction alignments for current / H5-value / H1-value channels.")
print("These are products of weight matrices, with no inputs or nonlinearities.")
for r in [20,28,40]:
    z=u[:,:r]
    arr=[(a@z).numpy()[active] for a in [f,f@bs[5],f@bs[1]]]
    norms=[np.linalg.norm(a,axis=1) for a in arr]
    nn=[a/(n[:,None]+1e-12) for a,n in zip(arr,norms)]
    cs=np.stack([(nn[0]*nn[1]).sum(1),(nn[0]*nn[2]).sum(1),
                 (nn[1]*nn[2]).sum(1)],1)
    print("\nrank",r)
    print("Channel norm quantiles",np.round([np.quantile(n,[.1,.5,.9]) for n in norms],3))
    print("Pair cosine quantiles",np.round(np.quantile(cs,[.01,.1,.5,.9,.99],axis=0),3))
    for threshold in [.5,.65,.8]:
        mask=cs.min(1)>threshold
        print("all-three pair cosines >",threshold,"count",int(mask.sum()))
    order=np.argsort(cs.min(1))[::-1][:15]
    print("best same-direction neurons (index, 3 cosines, 3 norms):")
    for i in order:
        print(int(ids[i]),np.round(cs[i],3).tolist(),
              np.round([n[i] for n in norms],3).tolist())
    if r==28:
        selected=np.flatnonzero(cs.min(1)>.5)
        if len(selected):
            sim=nn[0][selected]@nn[0][selected].T
            print("Similarities among strongest repeated-direction candidates:")
            print(np.round(sim[:20,:20],2))
        for a,b,label in [(0,1,"current/H5"),(0,2,"current/H1"),(1,2,"H5/H1")]:
            # Permutation baseline for row correspondence.
            rng=np.random.default_rng(0)
            baseline=np.sum(nn[a]*nn[b][rng.permutation(len(ids))],axis=1)
            actual=np.sum(nn[a]*nn[b],axis=1)
            print(label,"actual/random mean",
                  round(float(actual.mean()),4),round(float(baseline.mean()),4),
                  "actual/random fraction > .65",
                  round(float((actual>.65).mean()),4),round(float((baseline>.65).mean()),4))
```
