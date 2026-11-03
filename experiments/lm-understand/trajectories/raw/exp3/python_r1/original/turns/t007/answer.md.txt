```python
import numpy as np
from scipy.linalg import svdvals
from threadpoolctl import threadpool_limits
threadpool_limits(4)

A,C,bias={},{},{}
for l in range(4):
    g=W[f"ln1_w.{l}"].astype(float)
    b=W[f"ln1_b.{l}"].astype(float)
    for j in range(6):
        s=slice(64*j,64*(j+1))
        q0=W[f"W_q.{l}"][s].astype(float)
        k0=W[f"W_k.{l}"][s].astype(float)
        q=q0*g
        k=k0*g
        v=W[f"W_v.{l}"][s].astype(float)*g
        q-=q.mean(axis=1,keepdims=True)
        k-=k.mean(axis=1,keepdims=True)
        v-=v.mean(axis=1,keepdims=True)
        o=W[f"W_o.{l}"][:,s].astype(float)
        o-=o.mean(axis=0,keepdims=True)
        n=(l,j)
        A[n]=q.T@k/8
        C[n]=o@v
        bias[n]=k.T@(q0@b)/8

reference=sum(bias[(1,j)]/np.linalg.norm(bias[(1,j)]) for j in range(6))
reference/=np.linalg.norm(reference)
print("Final compact weight-only audit:")
print("head  ||A||F  ||C||F  A_stable_rank  C_top4_energy  keybias_norm  common_bias_cos")
for l in range(4):
    for j in range(6):
        n=(l,j)
        sa=svdvals(A[n],check_finite=False)
        sc=svdvals(C[n],check_finite=False)
        print(f"L{l}H{j}",*[
            round(float(x),4) for x in [
                np.linalg.norm(A[n]),np.linalg.norm(C[n]),
                np.sum(sa*sa)/(sa[0]**2),
                np.sum(sc[:4]**2)/np.sum(sc**2),
                np.linalg.norm(bias[n]),
                bias[n]@reference/np.linalg.norm(bias[n])]])

print("\nCoordinate-permutation controls for proposed copy-path products:")
rng=np.random.default_rng(123)
paths=[((2,1),(0,5)),((3,1),(0,5)),((3,5),(0,5)),
       ((3,1),(2,2)),((3,5),(2,2))]
for target,source in paths:
    a=A[target]; c=C[source]
    denom=np.linalg.norm(a)*np.linalg.norm(c)
    observed=np.sum(a*c.T)/denom
    controls=[]
    for _ in range(400):
        p=rng.permutation(384)
        controls.append(np.sum(a*c[np.ix_(p,p)].T)/denom)
    controls=np.array(controls)
    print("target",target,"source",source,
          "observed",round(observed,5),
          "null_mean",round(controls.mean(),5),
          "null_std",round(controls.std(),5),
          "null_max",round(controls.max(),5))

a=A[(0,5)]
b=A[(0,1)]
print("\nPositional-product cosines:",
      "cos(A01,A05)",round(np.sum(b*a)/np.linalg.norm(b)/np.linalg.norm(a),5),
      "cos(A01,A05^2)",round(np.sum(b*(a@a))/np.linalg.norm(b)/np.linalg.norm(a@a),5))
sa=svdvals(A[(0,4)],check_finite=False)
# Only an operator-norm bound, not evaluation on an input.
print("L0H4 operator-norm bound on variation across unmasked key scores:",
      round(2*384*sa[0]+2*np.sqrt(384)*np.linalg.norm(bias[(0,4)]),5))
print("All computations above are parameter decompositions/products; no network layer was evaluated.")
```
