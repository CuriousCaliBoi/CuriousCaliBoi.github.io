```python
import numpy as np
from scipy.linalg import svd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    print("Final-layer projection spectrum")
    up,sp,vp=svd(W["W_proj.3"].astype(float),full_matrices=False)
    print(np.round(sp[:40],3))
    print("Leading output directions: participation ratio, max absolute coordinate, mean-direction cosine")
    for j in range(6):
        u=up[:,j]
        ix=np.argsort(abs(u))[-8:][::-1]
        print(j,np.round([1/(u**4).sum(),abs(u).max(),u.sum()/np.sqrt(384)],4),
              list(zip(ix.tolist(),np.round(u[ix],3).tolist())))
    print("\nFinal-layer output-column cosine quantiles with leading output direction")
    p=W["W_proj.3"].astype(float)
    for j in range(3):
        c=(up[:,j]@p)/np.linalg.norm(p,axis=0)
        print(j,np.round(np.quantile(c,[0,.01,.1,.25,.5,.75,.9,.99,1]),3))

    print("\nFirst-layer MLP coefficient clustering in H3's leading input-weight subspace")
    g=W["ln1_w.0"].astype(float)
    v=W["W_v.0"][192:256].astype(float)*g
    v-=v.mean(1,keepdims=True)
    b=W["W_o.0"][:,192:256].astype(float)@v
    u,s,vt=svd(b,full_matrices=False)
    f=W["W_fc.0"].astype(float)*W["ln2_w.0"].astype(float)
    f-=f.mean(1,keepdims=True)
    x=f@vt[:20].T
    x-=x.mean(0)
    ux,sx,vx=svd(x,full_matrices=False)
    x=ux*np.sqrt(len(x))
    x/=np.linalg.norm(x,axis=1,keepdims=True)
    for k in (8,12,16,20,24,28,32):
        fit=KMeans(n_clusters=k,n_init=10,random_state=42).fit(x)
        sizes=np.bincount(fit.labels_,minlength=k)
        sil=silhouette_score(x,fit.labels_,sample_size=1000,random_state=42)
        print("k",k,"silhouette",round(sil,4),"sizes",np.sort(sizes)[::-1])
    print("\nFirst-layer MLP coefficient row-norm quantiles in current/prior subspaces")
    for r in (16,20,24):
        basis=vt[:r].T
        cur=f@basis
        prev=f@b@basis
        for name,z in (("current",cur),("prior",prev)):
            print(r,name,np.round(np.quantile(np.linalg.norm(z,axis=1),[0,.1,.5,.9,1]),3))

    print("\nL0 output-row norms for low-rank heads and MLP0")
    for j in (1,2,4,5):
        o=W["W_o.0"][:,64*j:64*(j+1)].astype(float)
        rn=np.linalg.norm(o,axis=1)
        ix=np.argsort(rn)[-10:][::-1]
        print("H",j,list(zip(ix.tolist(),np.round(rn[ix],3).tolist())))
    p=W["W_proj.0"].astype(float)
    rn=np.linalg.norm(p,axis=1)
    ix=np.argsort(rn)[-10:][::-1]
    print("MLP0",list(zip(ix.tolist(),np.round(rn[ix],3).tolist())))
```
