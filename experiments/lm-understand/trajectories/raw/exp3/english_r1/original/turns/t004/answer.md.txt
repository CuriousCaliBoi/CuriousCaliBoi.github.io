```python
import numpy as np
import scipy.linalg as la
from threadpoolctl import threadpool_limits
threadpool_limits(4)

A,B,Rkey = {},{},{}
for l in range(4):
    d=W[f"ln1_w.{l}"].astype(float)
    z=W[f"ln1_b.{l}"].astype(float)
    for j in range(6):
        sl=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][sl].astype(float)
        k=W[f"W_k.{l}"][sl].astype(float)
        v=W[f"W_v.{l}"][sl].astype(float)
        o=W[f"W_o.{l}"][:,sl].astype(float)
        A[l,j]=(q*d).T@(k*d)
        B[l,j]=o@(v*d)
        Rkey[l,j]=(k*d).T@(q@z)

# Common write subspace of the four similar first-layer OV matrices.
common=np.concatenate([B[0,j] for j in [0,1,4,5]],axis=1)
u,s,vt=la.svd(common,full_matrices=False)
print("Shared L0H0/H1/H4/H5 OV singular values:",np.round(s[:20],4))
clock=u[:,:2]
print("Fraction of each L0 OV's squared norm in shared top-2 write subspace:")
for j in range(6):
    print(j,round(la.norm(clock.T@B[0,j])**2/la.norm(B[0,j])**2,4))

print("\nLater QK energy on shared top-2 write subspace and bias-key alignment")
print("head: query_fraction key_fraction key_bias_fraction key_bias_coordinates")
for l in range(1,4):
    for j in range(6):
        a=A[l,j]
        r=Rkey[l,j]
        print(f"L{l}H{j}",
              np.round([la.norm(clock.T@a)**2/la.norm(a)**2,
                        la.norm(a@clock)**2/la.norm(a)**2,
                        la.norm(clock.T@r)**2/la.norm(r)**2],4),
              np.round(clock.T@r,3))

# A character-channel candidate: right singular subspace of L0H2 OV.
u2,s2,vt2=la.svd(B[0,2],full_matrices=False)
print("\nL0H2 gain-weighted OV singular values:",np.round(s2[:40],4))
T=vt2[:27].T
print("Projected compositions on L0H2's top-27 read subspace:")
print("head: trace(A Bprev) projected_trace symmetric_fraction positive/negative_sym_eigenmass")
for l in [1,2,3]:
    for j in range(6):
        a=A[l,j]
        m=T.T@a@B[0,2]@T
        sym=(m+m.T)/2
        es=la.eigvalsh(sym)
        print(f"L{l}H{j}",
              np.round([np.trace(a@B[0,2]),np.trace(m),
                        la.norm(sym)/la.norm(m),
                        es[es>0].sum(),-es[es<0].sum()],4))

print("\nUnweighted L0H2 V singular values:")
print(np.round(la.svdvals(W["W_v.0"][128:192].astype(float)),4))
```
