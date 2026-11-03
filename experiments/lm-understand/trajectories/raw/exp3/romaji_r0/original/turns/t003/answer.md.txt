```python
import numpy as np
from scipy.linalg import svd, eigvals
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    g = W["ln1_w.0"].astype(float)
    A, B, decomps = [], [], []
    for j in range(6):
        sl = slice(64*j,64*(j+1))
        q = W["W_q.0"][sl].astype(float)*g
        k = W["W_k.0"][sl].astype(float)*g
        v = W["W_v.0"][sl].astype(float)*g
        q -= q.mean(1,keepdims=True)
        k -= k.mean(1,keepdims=True)
        v -= v.mean(1,keepdims=True)
        A.append(q.T@k/8)
        B.append(W["W_o.0"][:,sl].astype(float)@v)
        decomps.append(svd(A[-1], full_matrices=False))
    print("Layer 0 scaled QK: symmetric-energy fraction, positive/negative eigenvalue sums of symmetric part")
    for j,a in enumerate(A):
        sym = (a+a.T)/2
        ev = np.linalg.eigvalsh(sym)
        z = eigvals(a)
        z = z[np.argsort(abs(z))[::-1]][:24]
        print("H", j, np.round([np.linalg.norm(sym)**2/np.linalg.norm(a)**2,
                               ev[ev>0].sum(),ev[ev<0].sum()],4))
        print("eigenvalues:", np.round(z,4))

    print("\nFraction of each OV's squared norm captured by QK H3 right/left subspaces")
    u,s,vt = decomps[3]
    for r in (4,8,16,24,32,48):
        print("rank", r,
              "key", np.round([np.linalg.norm(b@vt[:r].T)**2/np.linalg.norm(b)**2 for b in B],3),
              "query", np.round([np.linalg.norm(b@u[:,:r])**2/np.linalg.norm(b)**2 for b in B],3))

    print("\nOwn-head QK/OV subspace overlaps (r=1,4,8,16,24):")
    for j in range(6):
        u,s,vt=decomps[j]
        _,sb,vb=svd(B[j],full_matrices=False)
        vals=[]
        for r in (1,4,8,16,24):
            vals.append([np.linalg.norm(u[:,:r].T@vb[:r].T)**2/r,
                         np.linalg.norm(vt[:r]@vb[:r].T)**2/r])
        print("H",j,np.round(vals,3))

    print("\nLayer 0 cross-head subspace overlap: top 8 query and key directions")
    for which in ("query","key"):
        bases=[z[0][:,:8] if which=="query" else z[2][:8].T for z in decomps]
        print(which, np.round([[np.linalg.norm(a.T@b)**2/8 for b in bases] for a in bases],3))

    print("\nQK H3 singular-vector pair cosines:")
    u,s,vt=decomps[3]
    print(np.round(np.diag(vt[:32]@u[:,:32]),3))
    print("SV",np.round(s[:40],4))
    print("\nL0 LN scale largest and smallest coordinates:")
    for ix in (np.argsort(g)[-24:][::-1],np.argsort(g)[:24]):
        print(list(zip(ix.tolist(),np.round(g[ix],4).tolist())))
```
