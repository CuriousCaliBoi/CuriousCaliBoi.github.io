```python
import numpy as np
import torch
from sklearn.cluster import KMeans
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
g=T(W["ln1_w.0"])
vv={}
for j in [1,5]:
    vv[j]=(T(W["W_v.0"])[64*j:64*(j+1)]*g)@P
    print("V effective head",j,"singular values",np.round(torch.linalg.svdvals(vv[j])[:45].numpy(),3))
a=torch.linalg.svd(vv[1],full_matrices=False).Vh
b=torch.linalg.svd(vv[5],full_matrices=False).Vh
print("\nCommon L0H1/L0H5 value-input subspaces:")
for r in [12,20,24,28,32,40,48,64]:
    print(r,np.round(torch.linalg.svdvals(a[:r]@b[:r].T).numpy(),3))

# Analyze trained first-MLP rows after restriction to a weight-derived subspace.
f=(T(W["W_fc.0"])*T(W["ln2_w.0"]))@P
active=np.linalg.norm(W["W_fc.0"],axis=1)>.8
c=vv[1].T@vv[1]+vv[5].T@vv[5]
e,u=torch.linalg.eigh(c)
u=u.flip(1)
print("\nJoint value-input eigenvalues",np.round(e.flip(0)[:50].numpy(),3))
for r in [20,24,28,32]:
    z=(f@u[:,:r]).numpy()[active]
    norms=np.linalg.norm(z,axis=1)
    z=z/(norms[:,None]+1e-12)
    sim=z@z.T
    np.fill_diagonal(sim,-1)
    print("\nProjected FC0 rank",r,"active",len(z),
          "nearest-row cosine quantiles",
          np.round(np.quantile(sim.max(1),[.1,.25,.5,.75,.9]),3))
    for k in [20,24,28,32]:
        km=KMeans(n_clusters=k,n_init=10,random_state=1).fit(z)
        counts=np.bincount(km.labels_,minlength=k)
        coherence=np.linalg.norm(km.cluster_centers_,axis=1)
        print("k",k,"average coherence",round(float(np.average(coherence,weights=counts)),3),
              "cluster sizes",sorted(counts.tolist(),reverse=True),
              "coherence",np.round(np.sort(coherence),2))

print("\nFinal MLP output-column geometry in top 28 output directions:")
o=P@T(W["W_proj.3"])
u,s,vh=torch.linalg.svd(o,full_matrices=False)
z=vh[:28].T.numpy()
z=z/(np.linalg.norm(z,axis=1,keepdims=True)+1e-12)
for k in [20,24,28,32,40]:
    km=KMeans(n_clusters=k,n_init=10,random_state=1).fit(z)
    counts=np.bincount(km.labels_,minlength=k)
    coherence=np.linalg.norm(km.cluster_centers_,axis=1)
    print("k",k,"average coherence",round(float(np.average(coherence,weights=counts)),3),
          "cluster sizes",sorted(counts.tolist(),reverse=True),
          "coherence",np.round(np.sort(coherence),2))
```
