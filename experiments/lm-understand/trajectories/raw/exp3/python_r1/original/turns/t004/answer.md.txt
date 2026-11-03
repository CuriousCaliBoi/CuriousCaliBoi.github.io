```python
import numpy as np
from scipy.linalg import svd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_mutual_info_score
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g1 = W["ln1_w.0"].astype(float)
g2 = W["ln2_w.0"].astype(float)
v1 = W["W_v.0"][64:128].astype(float)
v5 = W["W_v.0"][320:384].astype(float)
o5 = W["W_o.0"][:,320:384].astype(float)
fc = W["W_fc.0"].astype(float)*g2

for j in range(6):
    s = np.linalg.svd(W["W_v.0"][64*j:64*(j+1)].astype(float),compute_uv=False)
    print("L0H%d raw V spectrum:"%j,np.round(s[:40],3))

# These are weight subspaces and products, not token representations or activations.
_,s,vt = svd(np.concatenate([v1,v5]),full_matrices=False)
print("Joint raw V1,V5 spectrum:",np.round(s[:50],3))
B = vt[:28].T / g1[:,None]
B -= B.mean(axis=0,keepdims=True)
B,_ = np.linalg.qr(B)
C5 = o5 @ (v5*g1)
C5 -= C5.mean(axis=0,keepdims=True)

current = fc@B
preceding = fc@C5@B
def whiten_columns(x, rank=27):
    x=x-x.mean(axis=0,keepdims=True)
    u,s,vt=svd(x,full_matrices=False)
    return u[:,:rank]*np.sqrt(x.shape[0]),s

labels=[]
for title,x in [("current-weight coefficients",current),("preceding-weight coefficients",preceding)]:
    z,s=whiten_columns(x)
    print("\n",title,"spectrum",np.round(s,3))
    zn=z/(np.linalg.norm(z,axis=1,keepdims=True)+1e-12)
    for nc in [5,10,20,28,35,50]:
        km=KMeans(n_clusters=nc,n_init=10,random_state=0).fit(zn)
        sil=silhouette_score(zn,km.labels_,sample_size=1000,random_state=0)
        centers=km.cluster_centers_
        cos=np.sum(zn*centers[km.labels_],axis=1)/(np.linalg.norm(centers[km.labels_],axis=1)+1e-12)
        print("K",nc,"silhouette",round(sil,4),"median member-center cosine",round(np.median(cos),4),
              "sizes",np.sort(np.bincount(km.labels_))[::-1])
        if nc==28:
            labels.append(km.labels_)
            near=(centers/np.linalg.norm(centers,axis=1,keepdims=True))@(
                centers/np.linalg.norm(centers,axis=1,keepdims=True)).T
            pairs=sorted([(near[a,b],a,b) for a in range(nc) for b in range(a)],reverse=True)
            print("closest cluster pairs:",[(round(c,3),a,b) for c,a,b in pairs[:15]])
print("\nMutual information between the two 28-way weight clusterings:",
      adjusted_mutual_info_score(labels[0],labels[1]))
print("Cross-cluster count matrix:")
table=np.zeros((28,28),dtype=int)
np.add.at(table,(labels[0],labels[1]),1)
for row in table:
    print(" ".join(map(str,row)))
```
