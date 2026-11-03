```python
import numpy as np
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g0=W["ln1_w.0"].astype(float)
q=W["W_q.0"][192:256].astype(float)
k=W["W_k.0"][192:256].astype(float)
v=W["W_v.0"][192:256].astype(float)
o=W["W_o.0"][:,192:256].astype(float)
_,_,qp=np.linalg.svd(q*g0,full_matrices=False)
_,_,vp=np.linalg.svd(v*g0,full_matrices=False)
P=qp[:20].T
T=vp[:20].T
B=o@(v*g0)
U=np.linalg.svd(B,full_matrices=False)[0][:,:20]
print("QK energy captured by candidate position, token and previous-token subspaces")
print("head | P-query P-key | T-query T-key | U-query U-key")
for l in range(4):
    g=W[f"ln1_w.{l}"].astype(float)
    for j in range(6):
        s=slice(64*j,64*(j+1))
        A=(W[f"W_q.{l}"][s]*g).T@(W[f"W_k.{l}"][s]*g)/8
        den=np.linalg.norm(A)**2
        vals=[]
        for Z in [P,T,U]:
            vals += [np.linalg.norm(Z.T@A)**2/den,np.linalg.norm(A@Z)**2/den]
        print("L%dH%d"%(l,j),np.round(vals,3))

print("\nL0H3 raw QK nonzero eigenvalues, descending magnitude")
e=np.linalg.eigvals(k@q.T/8)
e=e[np.argsort(-abs(e))]
print(np.round(e[:40],4))
print("positive-imag phases",np.round(np.sort(np.angle(e[(e.imag>0.01)&(abs(e)>.2)])),4))

F=W["W_fc.0"].astype(float)*W["ln2_w.0"]
print("\nMLP0 current/previous weight coupling (no activations)")
for r in [16,20,24,28]:
    T=vp[:r].T
    X=F@T
    Y=F@B@T
    X-=X.mean(0)
    Y-=Y.mean(0)
    C=X.T@Y
    ss=np.linalg.svd(C,compute_uv=False)
    ev=np.linalg.eigvalsh((C+C.T)/2)
    print("r",r,"sv",np.round(ss[:10],2),
          "sym eig extremes",np.round(np.r_[ev[:5],ev[-5:]],2),
          "trace/norm",round(np.trace(C)/np.linalg.norm(C),3))
```
