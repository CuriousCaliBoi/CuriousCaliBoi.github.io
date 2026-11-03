```python
import numpy as np
from scipy.linalg import svd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    p=W["W_proj.3"].astype(float)
    u,s,vt=svd(p,full_matrices=False)
    print("Final MLP projection-column clustering (weight vectors only)")
    for r in (20,24,28):
        z=(u[:,:r].T@p).T
        zn=np.linalg.norm(z,axis=1)
        keep=zn>np.quantile(zn,.25)
        z=z[keep]/zn[keep,None]
        for k in (20,24,28):
            km=KMeans(n_clusters=k,n_init=20,random_state=42).fit(z)
            print("r",r,"k",k,"silhouette",
                  round(silhouette_score(z,km.labels_,sample_size=1000,random_state=42),4),
                  "sizes",np.sort(np.bincount(km.labels_))[::-1])

    print("\nL3H3 induction composition versus other heads, with rotated-weight null controls")
    def qk(l,j):
        g=W[f"ln1_w.{l}"].astype(float)
        sl=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][sl].astype(float)*g
        k=W[f"W_k.{l}"][sl].astype(float)*g
        q-=q.mean(1,keepdims=True)
        k-=k.mean(1,keepdims=True)
        return q.T@k/8
    def ov(l,j):
        g=W[f"ln1_w.{l}"].astype(float)
        sl=slice(64*j,64*(j+1))
        v=W[f"W_v.{l}"][sl].astype(float)*g
        v-=v.mean(1,keepdims=True)
        return W[f"W_o.{l}"][:,sl].astype(float)@v
    b=ov(0,3)
    _,_,vb=svd(b,full_matrices=False)
    bas=vb[:24].T
    rng=np.random.default_rng(42)
    for j in range(6):
        a=qk(3,j)
        t=bas.T@a@b@bas
        sy=(t+t.T)/2
        ev=np.linalg.eigvalsh(sy)
        signed=np.trace(t)/np.linalg.norm(t)
        c=bas.T@a
        d=b@bas
        null=[]
        for _ in range(300):
            perm=rng.permutation(384)
            signs=rng.choice([-1.,1.],384)
            tn=(c[:,perm]*signs)@d
            null.append(np.trace(tn)/(np.linalg.norm(tn)+1e-30))
        print("L3H"+str(j),"trace/norm",round(signed,3),
              "symmetric positive/negative eigenvalue sums",
              np.round([ev[ev>0].sum(),ev[ev<0].sum()],4),
              "null mean/sd",np.round([np.mean(null),np.std(null)],3),
              "null max",round(max(null),3))
```
