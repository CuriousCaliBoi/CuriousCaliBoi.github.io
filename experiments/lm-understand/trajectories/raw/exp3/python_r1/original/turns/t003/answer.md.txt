```python
import numpy as np
from scipy.linalg import svd, eigvals
from threadpoolctl import threadpool_limits
threadpool_limits(4)

def centered_rows(a):
    a = np.asarray(a, dtype=float)
    return a - a.mean(axis=1, keepdims=True)

A,C,Q,K,V,O = {},{},{},{},{},{}
for l in range(4):
    g = np.asarray(W[f"ln1_w.{l}"],dtype=float)
    for j in range(6):
        s = slice(j*64,(j+1)*64)
        n = f"L{l}H{j}"
        Q[n]=centered_rows(W[f"W_q.{l}"][s]*g)
        K[n]=centered_rows(W[f"W_k.{l}"][s]*g)
        V[n]=centered_rows(W[f"W_v.{l}"][s]*g)
        O[n]=np.asarray(W[f"W_o.{l}"][:,s],dtype=float)
        O[n]=O[n]-O[n].mean(axis=0,keepdims=True)
        A[n]=Q[n].T@K[n]/8
        C[n]=O[n]@V[n]

print("INDUCTION ALGEBRA: trace(A_l C_earlier)/(||A_l||F ||C_earlier||F)")
print("Positive values indicate a possible query-to-preceding-token key match, not measured attention.")
for l in range(1,4):
    earlier=[f"L{a}H{b}" for a in range(l) for b in range(6)]
    print("columns",earlier)
    for j in range(6):
        n=f"L{l}H{j}"
        scores=[np.trace(A[n]@C[e])/np.linalg.norm(A[n])/np.linalg.norm(C[e]) for e in earlier]
        print(n,np.round(scores,4))

print("\nL0 effective Q,K,V singular values (first 32):")
for j in range(6):
    n=f"L0H{j}"
    for label,M in [("Q",Q[n]),("K",K[n]),("V",V[n])]:
        s=np.linalg.svd(M,compute_uv=False)
        print(n,label,np.round(s[:32],3))

bases={}
for j in range(6):
    for label,D in [("Q",Q),("K",K),("V",V)]:
        _,_,vt=svd(D[f"L0H{j}"],full_matrices=False)
        bases[f"{label}{j}"]=vt[:24].T
print("\nAverage squared overlap of leading 24-dimensional L0 subspaces:")
bn=["Q1","K1","Q5","K5","V1","V5"]
print(bn)
print(np.round([[np.linalg.norm(bases[x].T@bases[y])**2/24 for y in bn] for x in bn],3))

print("\nLayer 0 QK product correlations, centered effective matrices:")
a=A["L0H5"]
b=A["L0H1"]
for k in range(1,7):
    m=np.linalg.matrix_power(a,k)
    print("power",k,"cosine with H1",round(np.sum(m*b)/np.linalg.norm(m)/np.linalg.norm(b),4),
          "cosine with H1 transpose",round(np.sum(m*b.T)/np.linalg.norm(m)/np.linalg.norm(b),4))

print("\nTop-key and top-query directions of each head: overlap with L0H4 output subspace (top 4).")
u,s,vt=svd(C["L0H4"],full_matrices=False)
B=u[:,:4]
for l in range(4):
    for j in range(6):
        n=f"L{l}H{j}"
        _,_,vq=svd(Q[n],full_matrices=False)
        _,_,vk=svd(K[n],full_matrices=False)
        print(n,"Q",np.round(np.sum((vq[:4]@B)**2,axis=1),3),
              "K",np.round(np.sum((vk[:4]@B)**2,axis=1),3))
```
