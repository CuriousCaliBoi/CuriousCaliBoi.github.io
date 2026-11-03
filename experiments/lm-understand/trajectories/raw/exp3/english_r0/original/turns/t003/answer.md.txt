```python
import numpy as np
from scipy.linalg import svd, svdvals, eigvals
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=3, suppress=True, linewidth=180)

def center_columns(a):
    return a-a.mean(axis=1,keepdims=True)
def center_output(a):
    return a-a.mean(axis=0,keepdims=True)

with threadpool_limits(limits=4):
    A, B = {}, {}
    for l in range(4):
        g=W[f"ln1_w.{l}"]
        for j in range(6):
            s=slice(j*64,(j+1)*64)
            q=center_columns(W[f"W_q.{l}"][s]*g)
            k=center_columns(W[f"W_k.{l}"][s]*g)
            v=center_columns(W[f"W_v.{l}"][s]*g)
            o=center_output(W[f"W_o.{l}"][:,s])
            A[l,j]=q.T@k/8
            B[l,j]=o@v
    s=slice(128,192)
    pos_basis=svd(np.vstack([center_columns(W["W_q.0"][s]*W["ln1_w.0"]),
                            center_columns(W["W_k.0"][s]*W["ln1_w.0"])]),full_matrices=False)[2].T
    vmat=center_columns(W["W_v.0"][s]*W["ln1_w.0"])
    char_basis=svd(vmat,full_matrices=False)[2].T[:,:28]
    print("L0H2 gain-weighted V spectrum",svdvals(vmat)[:40])
    print("POSITION-CANDIDATE OVERLAP WITH V0H2 TOP28:",
          [(r,round(float(np.linalg.norm(pos_basis[:,:r].T@char_basis)**2/28),3)) for r in [16,24,32,40,48,64]])
    p=pos_basis[:,:32]
    print("\nHEAD PRODUCT ENERGY IN CANDIDATE POSITION SPACE")
    for l in range(4):
        for j in range(6):
            a=A[l,j]
            den=np.linalg.norm(a)**2
            print(f"L{l}H{j}", "query",round(float(np.linalg.norm(p.T@a)**2/den),3),
                  "key",round(float(np.linalg.norm(a@p)**2/den),3),
                  "both",round(float(np.linalg.norm(p.T@a@p)**2/den),3))
    print("\nCOMPOSITION WITH EACH L0 OV: tr(A @ B) / (||A||F ||B||F)")
    for l in range(1,4):
        for j in range(6):
            a=A[l,j]
            scores=[np.trace(a@B[0,k])/(np.linalg.norm(a)*np.linalg.norm(B[0,k])) for k in range(6)]
            scores_rev=[np.trace(a.T@B[0,k])/(np.linalg.norm(a)*np.linalg.norm(B[0,k])) for k in range(6)]
            print(f"L{l}H{j}", "key-path",np.array(scores),"query-path",np.array(scores_rev))
    print("\nCOMPOSITION SPECTRA WITH L0H2 OV")
    for l in range(1,4):
        for j in range(6):
            c=A[l,j]@B[0,2]
            ss=svdvals(c)
            cc=char_basis.T@c@char_basis
            sc=svdvals(cc)
            es=eigvals(cc)
            print(f"L{l}H{j}",
                  "trace",round(float(np.trace(c)),3),
                  "trace/nuclear",round(float(np.trace(c)/ss.sum()),3),
                  "char trace/nuclear",round(float(np.trace(cc)/sc.sum()),3),
                  "char positive-real eig",int(np.sum(es.real>0)), "char eig top",es[np.argsort(abs(es))[-5:][::-1]])
```
