```python
import numpy as np
import scipy.linalg as la
from threadpoolctl import threadpool_limits
threadpool_limits(4)

d=W["ln1_w.0"].astype(float)
A,B={},{}
for j in range(6):
    sl=slice(64*j,64*(j+1))
    q=W["W_q.0"][sl].astype(float)*d
    k=W["W_k.0"][sl].astype(float)*d
    v=W["W_v.0"][sl].astype(float)*d
    o=W["W_o.0"][:,sl].astype(float)
    A[j]=q.T@k
    B[j]=o@v

# Compare weight matrices with powers of the orthogonal polar factor
# of L0H2's QK matrix. These are matrix alignments, not attention scores.
q=W["W_q.0"][128:192].astype(float)*d
k=W["W_k.0"][128:192].astype(float)*d
c=q.T@q+k.T@k
ev,U=la.eigh(c)
ix=np.argsort(ev)[::-1]
ev,U=ev[ix],U[:,ix]
for r in [16,20,24,32]:
    Z=U[:,:r]/np.sqrt(ev[:r])[None,:]
    t=Z.T@A[2]@Z
    rot,_=la.polar(t)
    print("\nrank",r,"whitened L0H2 singular values",np.round(la.svdvals(t),3))
    print("Alignment with polar-factor powers, columns -4..4:")
    for j in [0,1,3,4,5]:
        m=Z.T@A[j]@Z
        vals=[np.sum(m*np.linalg.matrix_power(rot,p))/
              (la.norm(m)*np.sqrt(r)) for p in range(-4,5)]
        print(f"L0H{j}",np.round(vals,4))

print("\nShared first-layer read subspace and positional-circuit overlap")
stack=np.concatenate([B[j] for j in [0,1,4,5]],axis=0)
_,s,vt=la.svd(stack,full_matrices=False)
print("Shared-read singular values",np.round(s[:10],4))
a_u,a_s,a_vt=la.svd(A[2],full_matrices=False)
P=la.orth(np.column_stack([a_u[:,:20],a_vt[:20].T]))
for i in range(4):
    v=vt[i]
    print("read direction",i,"energy in L0H2 QK subspace",
          round(la.norm(P.T@v)**2,4))

# Check the induction-like composition without choosing one particular rank.
a=(W["W_q.3"][64:128].astype(float)*W["ln1_w.3"]).T @ (
    W["W_k.3"][64:128].astype(float)*W["ln1_w.3"])
_,_,vt=la.svd(B[2],full_matrices=False)
print("\nL3H1 x L0H2 induction-like composition, subspace-rank sensitivity")
for r in [16,20,24,27,32,40,64]:
    T=vt[:r].T
    m=T.T@a@B[2]@T
    e=la.eigvalsh((m+m.T)/2)
    print(r,"trace",round(np.trace(m),4),
          "positive_mass",round(e[e>0].sum(),4),
          "negative_mass",round(-e[e<0].sum(),4),
          "symmetry_fraction",round(la.norm((m+m.T)/2)/la.norm(m),4))
```
