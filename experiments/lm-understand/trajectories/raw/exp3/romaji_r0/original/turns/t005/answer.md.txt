```python
import numpy as np
from scipy.linalg import svd, eigh
from threadpoolctl import threadpool_limits

def orth(a, tol=1e-8):
    u,s,_=svd(a,full_matrices=False)
    return u[:,s>s[0]*tol]

with threadpool_limits(limits=4):
    A,B,C={},{},{}
    for l in range(4):
        g=W[f"ln1_w.{l}"].astype(float)
        b=W[f"ln1_b.{l}"].astype(float)
        for j in range(6):
            sl=slice(j*64,(j+1)*64)
            q=W[f"W_q.{l}"][sl].astype(float)
            k=W[f"W_k.{l}"][sl].astype(float)
            v=W[f"W_v.{l}"][sl].astype(float)*g
            qg=q*g; kg=k*g
            qg-=qg.mean(1,keepdims=True)
            kg-=kg.mean(1,keepdims=True)
            v-=v.mean(1,keepdims=True)
            A[l,j]=qg.T@kg/8
            B[l,j]=W[f"W_o.{l}"][:,sl].astype(float)@v
            C[l,j]=(q@b)@kg/8

    up,sp,vp=svd(A[0,3],full_matrices=False)
    ut,st,vt=svd(B[0,3],full_matrices=False)
    pos=orth(np.column_stack([up[:,:24],vp[:24].T]))
    tok=orth((np.eye(384)-pos@pos.T)@vt[:20].T)
    writes=orth(np.column_stack([svd(B[0,j],full_matrices=False)[0][:,:3]
                                for j in (1,2,4,5)]))
    print("Basis dimensions: position candidate, token candidate, low-rank L0 writes",
          pos.shape[1],tok.shape[1],writes.shape[1])
    print("QK squared-energy fractions in query/key subspaces; then bias-key fraction")
    for l in range(4):
        for j in range(6):
            a=A[l,j]; c=C[l,j]
            vals=[]
            for basis in (pos,tok,writes):
                vals.extend([np.linalg.norm(basis.T@a)**2/np.linalg.norm(a)**2,
                             np.linalg.norm(a@basis)**2/np.linalg.norm(a)**2,
                             np.linalg.norm(c@basis)**2/(np.linalg.norm(c)**2+1e-30)])
            print(f"L{l}H{j}",np.round(vals,3))

    print("\nLayer 1 and 2 key-bias coefficient cosines")
    cs=np.array([C[l,j]/np.linalg.norm(C[l,j]) for l in (1,2) for j in range(6)])
    print(np.round(cs@cs.T,3))
    print("Largest coordinates of mean normalized L1 key-bias coefficient")
    c=cs[:6].mean(0)
    ix=np.argsort(abs(c))[-16:][::-1]
    print(list(zip(ix.tolist(),np.round(c[ix],4).tolist())))

    print("\nPosition-subspace operator correlations with powers of L0H3")
    p=pos
    a=p.T@A[0,3]@p
    metric=(a@a.T+a.T@a)/2
    ev,evc=eigh(metric)
    keep=ev>ev.max()*0.01
    z=evc[:,keep]/ev[keep]**0.25
    a=z.T@a@z
    powers=[np.eye(a.shape[0])]
    for n in range(1,7):
        powers.append(powers[-1]@a)
    for j in range(6):
        aj=z.T@(p.T@A[0,j]@p)@z
        scores=[np.vdot(aj,x)/(np.linalg.norm(aj)*np.linalg.norm(x)) for x in powers]
        print("H",j,np.round(scores,3))

    print("\nMLP0 coefficient coupling in H3 read subspace (generalized eigenvalues)")
    f=W["W_fc.0"].astype(float)*W["ln2_w.0"].astype(float)
    f-=f.mean(1,keepdims=True)
    for r in (16,20,24,28):
        basis=vt[:r].T
        f0=f@basis
        f1=f@B[0,3]@basis
        for centered in (False,True):
            x=f0-f0.mean(0) if centered else f0
            y=f1-f1.mean(0) if centered else f1
            reg=np.linalg.solve(x.T@x+0.01*np.eye(r),x.T@y)
            ev=np.linalg.eigvals(reg)
            ev=ev[np.argsort(abs(ev))[::-1]][:8]
            print("r",r,"centered",centered,np.round(ev,3))
```
