```python
import numpy as np
from scipy.linalg import svd
from scipy.stats import skew, kurtosis
from sklearn.decomposition import FastICA
from sklearn.metrics import adjusted_mutual_info_score
from threadpoolctl import threadpool_limits
import warnings
warnings.filterwarnings("ignore")
threadpool_limits(4)

g1=W["ln1_w.0"].astype(float)
g2=W["ln2_w.0"].astype(float)
F=W["W_fc.0"].astype(float)*g2
vs=[W["W_v.0"][64*j:64*(j+1)].astype(float) for j in [1,5]]
_,s,vt=svd(np.concatenate(vs),full_matrices=False)
Cs=[]
for j in [5,1]:
    c=W["W_o.0"][:,64*j:64*(j+1)].astype(float)@(
        W["W_v.0"][64*j:64*(j+1)].astype(float)*g1)
    c-=c.mean(axis=0,keepdims=True)
    Cs.append(c)

for variant in ["divide_gain","raw","multiply_gain"]:
    B=vt[:28].T.copy()
    if variant=="divide_gain": B/=g1[:,None]
    if variant=="multiply_gain": B*=g1[:,None]
    B-=B.mean(axis=0,keepdims=True)
    B,_=np.linalg.qr(B)
    matrices=[F@B]+[F@c@B for c in Cs]
    matrices=[m/np.linalg.norm(m-m.mean(axis=0)) for m in matrices]
    X=np.concatenate(matrices)
    ica=FastICA(n_components=27,whiten="unit-variance",max_iter=3000,tol=1e-5,random_state=0)
    Z=ica.fit_transform(X)
    signs=np.sign(skew(Z,axis=0))
    signs[signs==0]=1
    Z*=signs
    ku=kurtosis(Z,axis=0)
    sk=skew(Z,axis=0)
    print("\nICA of weight coefficients:",variant)
    print("skew:",np.round(sk,2))
    print("excess kurtosis:",np.round(ku,2))
    for block in range(3):
        z=Z[1536*block:1536*(block+1)]
        top=np.argmax(z,axis=1)
        print(["current","H5-composed","H1-composed"][block],
              "top-component counts",np.bincount(top,minlength=27))
    if variant=="divide_gain":
        zz=[Z[1536*i:1536*(i+1)] for i in range(3)]
        # Cross-component co-occurrence among unusually large weight coefficients.
        # This is a decomposition of the parameters, not evaluation of network neurons.
        highs=[z>2.0 for z in zz]
        co=highs[0].T.astype(int)@highs[1].astype(int)
        print("Current vs H5-composed coefficient co-occurrences (>2 standardized units):")
        for a in range(27):
            best=np.argsort(-co[a])[:6]
            print(a,"current_count",int(highs[0][:,a].sum()),
                  "prev_count",int(highs[1][:,a].sum()),
                  "partners",[(int(b),int(co[a,b])) for b in best])

X=W["W_proj.3"].astype(float).T
ica=FastICA(n_components=28,whiten="unit-variance",max_iter=3000,tol=1e-5,random_state=0)
Z=ica.fit_transform(X)
print("\nLast-projection independent-component excess kurtosis:",
      np.round(np.sort(kurtosis(Z,axis=0))[::-1],2))
print("Last-projection independent-component absolute skew:",
      np.round(np.sort(np.abs(skew(Z,axis=0)))[::-1],2))
```
