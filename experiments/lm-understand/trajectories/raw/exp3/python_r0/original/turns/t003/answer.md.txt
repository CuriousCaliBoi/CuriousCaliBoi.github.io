```python
import numpy as np
import torch
from sklearn.cluster import KMeans
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a), dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
M,B={},{}

for l in range(4):
    g=T(W[f"ln1_w.{l}"])
    for j in range(6):
        s=slice(j*64,(j+1)*64)
        q,k,v=[(T(W[f"{n}.{l}"])[s]*g)@P for n in ["W_q","W_k","W_v"]]
        o=P@T(W[f"W_o.{l}"])[:,s]
        M[l,j]=q.T@k/8
        B[l,j]=o@v

print("L0 effective OV singular spectra (first 32):")
for j in range(6):
    print(j,np.round(torch.linalg.svdvals(B[0,j])[:32].numpy(),3))
print("\nL0H5 symmetric-QK eigenvalues, descending:")
e=torch.linalg.eigvalsh((M[0,5]+M[0,5].T)/2).flip(0)
print(np.round(e[:45].numpy(),4))
print("Smallest:",np.round(e[-15:].numpy(),4))

print("\nQK energy reading leading 3 OUTPUT directions of each L0 OV:")
U={}
for j in range(6):
    U[j]=torch.linalg.svd(B[0,j],full_matrices=False).U[:,:3]
for l in range(1,4):
    for j in range(6):
        a=M[l,j]
        print(f"L{l}H{j}",
              "query",np.round([float((u.T@a).norm().square()/a.norm().square())
                                for u in U.values()],3),
              "key",np.round([float((a@u).norm().square()/a.norm().square())
                              for u in U.values()],3))

print("\nSelected key-composition spectra, on weight products only:")
for later,earlier in [((2,1),(0,5)),((3,1),(2,2)),((3,5),(2,2)),
                      ((1,4),(0,4)),((2,2),(0,1)),((2,2),(1,2))]:
    a=M[later]@B[earlier]
    ev=torch.linalg.eigvals(a)
    se=torch.linalg.eigvalsh((a+a.T)/2)
    sv=torch.linalg.svdvals(a)
    print(later,earlier,"trace/Frob/nuclear",
          np.round([float(torch.trace(a)),float(a.norm()),float(sv.sum())],4),
          "sym_positive_fraction",round(float(se.clamp(min=0).sum()/se.abs().sum()),4),
          "eig_top_real",np.round(torch.sort(ev.real,descending=True).values[:12].numpy(),4))

print("\nFirst MLP row-weight geometry:")
f=(T(W["W_fc.0"])*T(W["ln2_w.0"]))@P
u,s,vh=torch.linalg.svd(f,full_matrices=False)
print("effective FC0 singular values (first 65)",np.round(s[:65].numpy(),3))
# Whitening and clustering weight rows, not evaluating neurons.
for r in [24,32,48]:
    z=u[:,:r].numpy()
    z=z/(np.linalg.norm(z,axis=1,keepdims=True)+1e-12)
    for k in [20,24,28,32,40]:
        km=KMeans(n_clusters=k,n_init=5,random_state=0).fit(z)
        centers=km.cluster_centers_
        norms=np.linalg.norm(centers,axis=1)
        counts=np.bincount(km.labels_,minlength=k)
        print("rank",r,"k",k,"mean within-cluster cosine",
              round(float(np.average(norms,weights=counts)),3),
              "coherent clusters (centroid norm > .65)",
              sorted([(int(counts[i]),round(float(norms[i]),3))
                      for i in range(k) if norms[i]>.65],reverse=True))
```
