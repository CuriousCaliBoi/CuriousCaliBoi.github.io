```python
import numpy as np
from scipy.linalg import svd, svdvals
from sklearn.cluster import KMeans
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=3, suppress=True, linewidth=180)

with threadpool_limits(limits=4):
    print("L0H2 FACTOR SPECTRA")
    for name, a in [
        ("Q",W["W_q.0"][128:192]),("K",W["W_k.0"][128:192]),
        ("V",W["W_v.0"][128:192]),("O",W["W_o.0"][:,128:192])
    ]:
        print(name,svdvals(a))
    print("\nLATE PROJECTION SPECTRA")
    for l in range(4):
        a=W[f"W_proj.{l}"]
        ss=svdvals(a)
        print("layer",l,"top 50",ss[:50],
              "energy top 16/24/28/32/64/128",
              np.array([np.sum(ss[:r]**2)/np.sum(ss**2) for r in [16,24,28,32,64,128]]))
    print("\nL0 EFFECTIVE MLP INPUT VS EARLY VALUE SUBSPACES")
    f=W["W_fc.0"]*W["ln2_w.0"]
    f=f-f.mean(1,keepdims=True)
    b=(W["W_o.0"][:,128:192]@W["W_v.0"][128:192])*W["ln1_w.0"]
    b=b-b.mean(0,keepdims=True)-b.mean(1,keepdims=True)+b.mean()
    print("F spectrum",svdvals(f)[:50])
    print("F @ B02 spectrum",svdvals(f@b)[:50])
    print("\nL0 MLP ROW COSINE CLUSTERING (weight directions, not activations)")
    for label, a in [("F",f),("F_B02",f@b)]:
        u,ss,vh=svd(a,full_matrices=False)
        z=u[:,:32]*ss[:32]
        norms=np.linalg.norm(z,axis=1)
        z=z/np.maximum(norms[:,None],1e-10)
        sim=z@z.T
        np.fill_diagonal(sim,-2)
        print(label, "nearest cosine quantiles",np.quantile(sim.max(1),[0,.1,.25,.5,.75,.9,1]))
        for n in [16,20,24,28,32]:
            km=KMeans(n_clusters=n,n_init=5,random_state=0,max_iter=200).fit(z)
            counts=np.bincount(km.labels_,minlength=n)
            print(label,"clusters",n,"inertia",round(km.inertia_,2),"counts",np.sort(counts)[::-1])
    print("\nSHARED LOW-RANK L1 QK STRUCTURE")
    mats=[]
    kb=[]
    for j in range(6):
        s=slice(64*j,64*(j+1))
        q,k=W["W_q.1"][s]*W["ln1_w.1"],W["W_k.1"][s]*W["ln1_w.1"]
        q=q-q.mean(1,keepdims=True)
        k=k-k.mean(1,keepdims=True)
        mats.append(q.T@k/8)
        kb.append(k.T@(W["W_q.1"][s]@W["ln1_b.1"])/8)
    def cos_table(a):
        a=np.array([x.ravel() for x in a])
        a=a/np.linalg.norm(a,axis=1,keepdims=True)
        return a@a.T
    print("QK cosines\n",cos_table(mats))
    print("key-bias cosines\n",cos_table(kb))
```
