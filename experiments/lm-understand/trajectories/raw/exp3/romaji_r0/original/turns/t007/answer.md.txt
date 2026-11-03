```python
import numpy as np
from scipy.linalg import svd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    g=W["ln1_w.0"].astype(float)
    v=W["W_v.0"][192:256].astype(float)*g
    v-=v.mean(1,keepdims=True)
    b=W["W_o.0"][:,192:256].astype(float)@v
    u,s,vt=svd(b,full_matrices=False)
    basis=vt[:20].T
    f=W["W_fc.0"].astype(float)*W["ln2_w.0"].astype(float)
    f-=f.mean(1,keepdims=True)
    cur=f@basis
    prev=f@b@basis
    nc=np.linalg.norm(cur,axis=1)
    npv=np.linalg.norm(prev,axis=1)
    print("Numbers of neurons above current/prior coefficient-norm thresholds")
    for t in (.2,.4,.6,.8,1.0):
        print(t,int((nc>t).sum()),int((npv>t).sum()),int(((nc>t)&(npv>t)).sum()))
    print("\nClustering high-signal current coefficient rows, cosine geometry")
    mask=nc>.5
    x=cur[mask]
    x=x/np.linalg.norm(x,axis=1,keepdims=True)
    for k in (8,12,16,20,24,28,32):
        km=KMeans(n_clusters=k,n_init=20,random_state=0).fit(x)
        print(k,"silhouette",round(silhouette_score(x,km.labels_),4),
              "sizes",np.sort(np.bincount(km.labels_))[::-1])

    print("\nJoint current/prior coefficient clustering")
    mc=nc>.5
    mp=npv>.4
    xc=cur[mc]/nc[mc,None]
    xp=prev[mp]/npv[mp,None]
    xx=np.vstack([xc,xp])
    for k in (16,20,24,28):
        km=KMeans(n_clusters=k,n_init=20,random_state=0).fit(xx)
        centers=km.cluster_centers_
        centers=centers/np.linalg.norm(centers,axis=1,keepdims=True)
        lc=np.argmax((cur/nc[:,None])@centers.T,axis=1)
        lp=np.argmax((prev/npv[:,None])@centers.T,axis=1)
        keep=mc&mp
        counts=np.zeros((k,k))
        np.add.at(counts,(lp[keep],lc[keep]),1)
        adj=counts+counts.T
        deg=adj.sum(1)
        normal=adj/np.sqrt(np.maximum(deg[:,None]*deg[None,:],1))
        ev,vec=np.linalg.eigh(normal)
        signs=vec[:,0]>0
        cross=adj[signs][:,~signs].sum()*2/(adj.sum()+1e-30)
        print("k",k,"silhouette",round(silhouette_score(xx,km.labels_),4),
              "min eigs",np.round(ev[:4],3),"bipartite-cut fraction",round(cross,3),
              "partition sizes",int(signs.sum()),int((~signs).sum()))
        if k==24:
            print("current cluster sizes",np.bincount(lc[mc],minlength=k))
            print("prior cluster sizes",np.bincount(lp[mp],minlength=k))
            print("joint counts, rows=prior coefficient cluster, columns=current coefficient cluster")
            print(counts.astype(int))
```
