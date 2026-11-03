```python
import numpy as np
import scipy.linalg as la
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from threadpoolctl import threadpool_limits
threadpool_limits(4)

d=W["ln1_w.0"].astype(float)
v=W["W_v.0"][128:192].astype(float)*d
o=W["W_o.0"][:,128:192].astype(float)
B=o@v
F=W["W_fc.0"].astype(float)*W["ln2_w.0"]
G=F@B
u,s,vt=la.svd(G-G.mean(axis=0),full_matrices=False)
print("Singular values of centered W_fc.0 D_ln2.0 B_L0H2:")
print(np.round(s[:50],4))

# Clustering weight rows, not activations or model inputs.
for r in [20,24,27,32]:
    X=(G-G.mean(axis=0))@vt[:r].T
    X/=np.sqrt(s[:r])[None,:]
    X/=np.maximum(la.norm(X,axis=1,keepdims=True),1e-12)
    km=KMeans(n_clusters=r+1,n_init=10,random_state=0).fit(X)
    sizes=np.bincount(km.labels_,minlength=r+1)
    coh=np.array([la.norm(X[km.labels_==i].mean(axis=0)) for i in range(r+1)])
    sil=silhouette_score(X,km.labels_,sample_size=1000,random_state=0)
    print("rank",r,"clusters",r+1,"silhouette",round(sil,4),
          "mean_cohesion",round(np.average(coh,weights=sizes),4))
    print("sizes descending",np.sort(sizes)[::-1])

print("\nEffective QK symmetric eigenvalue masses, no input evaluation:")
for l in range(4):
    d=W[f"ln1_w.{l}"].astype(float)
    for j in range(6):
        sl=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][sl].astype(float)*d
        k=W[f"W_k.{l}"][sl].astype(float)*d
        a=q.T@k
        ev=la.eigvalsh((a+a.T)/2)
        pos=ev[ev>0].sum()
        neg=-ev[ev<0].sum()
        print(f"L{l}H{j}", "positive",round(pos,3),"negative",round(neg,3),
              "signed_mass_fraction",round((pos-neg)/(pos+neg),4))
```
