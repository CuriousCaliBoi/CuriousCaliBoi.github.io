```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import FastICA
from scipy.stats import kurtosis
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g=W["ln1_w.0"].astype(float)
V=W["W_v.0"][192:256].astype(float)*g
B=W["W_o.0"][:,192:256].astype(float)@V
T=np.linalg.svd(V,full_matrices=False)[2][:24].T
F=W["W_fc.0"].astype(float)*W["ln2_w.0"]
X=F@T
Y=F@B@T
X-=X.mean(0); Y-=Y.mean(0)
Z=np.vstack([X,Y])
cov=Z.T@Z/len(Z)
ev,U=np.linalg.eigh(cov)
wh=U@np.diag(1/np.sqrt(ev+1e-6))@U.T
Z=Z@wh
Z/=np.linalg.norm(Z,axis=1,keepdims=True)
print("Clustering ONLY first-MLP weight projections onto current/previous value subspaces")
for nc in [16,20,24,28]:
    km=KMeans(n_clusters=nc,n_init=20,random_state=7).fit(Z)
    centers=km.cluster_centers_
    print("clusters",nc,"mean within-cluster cosine",round(np.mean(np.linalg.norm(centers,axis=1)),3),
          "counts",np.sort(np.bincount(km.labels_,minlength=nc))[::-1])
    if nc==24:
        tab=np.zeros((nc,nc),int)
        for a,b in zip(km.labels_[:1536],km.labels_[1536:]):
            tab[a,b]+=1
        expected=tab.sum(1)[:,None]*tab.sum(0)[None,:]/tab.sum()
        R=(tab-expected)/np.sqrt(expected+1)
        print("pair-table standardized residual singular values",np.round(np.linalg.svd(R,compute_uv=False)[:12],2))
        ij=np.dstack(np.unravel_index(np.argsort(R.ravel())[-20:][::-1],R.shape))[0]
        print("largest pair enrichments (arbitrary cluster labels):",
              [(int(a),int(b),int(tab[a,b]),round(float(expected[a,b]),1),round(float(R[a,b]),2)) for a,b in ij])

print("\nLast-MLP output spectrum: adjacent ratios")
sv=np.linalg.svd(W["W_proj.3"].astype(float),compute_uv=False)
print([(i+1,round(sv[i],3),round(sv[i]/sv[i+1],3)) for i in range(18,32)])
print("top24 energy",np.sum(sv[:24]**2)/np.sum(sv**2),"top28 energy",np.sum(sv[:28]**2)/np.sum(sv**2))
```
