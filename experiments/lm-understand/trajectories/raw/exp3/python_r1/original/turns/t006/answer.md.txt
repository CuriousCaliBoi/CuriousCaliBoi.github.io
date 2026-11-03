```python
import numpy as np
from scipy.linalg import svd
from threadpoolctl import threadpool_limits
threadpool_limits(4)

g=W["ln1_w.0"].astype(float)
v=np.concatenate([W["W_v.0"][64:128],W["W_v.0"][320:384]]).astype(float)
p=np.concatenate([W[n][s] for n in ["W_q.0","W_k.0"]
                  for s in [slice(64,128),slice(320,384)]]).astype(float)

def basis_from_gradient_rows(m,r):
    _,_,vt=svd(m,full_matrices=False)
    b=vt[:r].T/g[:,None]
    b-=b.mean(axis=0,keepdims=True)
    return np.linalg.qr(b)[0]

Bc=basis_from_gradient_rows(v,28)
Bp=basis_from_gradient_rows(p,32)
print("Mean squared character/position candidate subspace overlap:",
      np.linalg.norm(Bc.T@Bp)**2/28)
print("Energy fractions in candidate character and position input subspaces:")
for j in range(6):
    sl=slice(64*j,64*(j+1))
    for name in ["W_q","W_k","W_v"]:
        m=W[f"{name}.0"][sl].astype(float)*g
        m-=m.mean(axis=1,keepdims=True)
        print(f"L0H{j}",name,
              np.round([np.linalg.norm(m@Bc)**2/np.linalg.norm(m)**2,
                        np.linalg.norm(m@Bp)**2/np.linalg.norm(m)**2],4))
    c=W["W_o.0"][:,sl].astype(float)@(W["W_v.0"][sl].astype(float)*g)
    u,s,vt=svd(c,full_matrices=False)
    print(" OV top four right-singular-vector character / position overlaps:",
          np.round(np.sum((vt[:4]@Bc)**2,axis=1),3),
          np.round(np.sum((vt[:4]@Bp)**2,axis=1),3))

print("\nKey-bias weight vectors across heads:")
keybias={}
Cs={}
for l in range(4):
    gg=W[f"ln1_w.{l}"].astype(float)
    bb=W[f"ln1_b.{l}"].astype(float)
    for j in range(6):
        sl=slice(64*j,64*(j+1))
        q=W[f"W_q.{l}"][sl].astype(float)
        k=W[f"W_k.{l}"][sl].astype(float)*gg
        k-=k.mean(axis=1,keepdims=True)
        keybias[(l,j)]=k.T@(q@bb)/8
        c=W[f"W_o.{l}"][:,sl].astype(float)@(W[f"W_v.{l}"][sl].astype(float)*gg)
        c-=c.mean(axis=0,keepdims=True)
        c-=c.mean(axis=1,keepdims=True)
        Cs[(l,j)]=c

reference=sum(keybias[(1,j)]/np.linalg.norm(keybias[(1,j)]) for j in range(6))
reference/=np.linalg.norm(reference)
for l in range(4):
    for j in range(6):
        z=keybias[(l,j)]
        print(f"L{l}H{j}","bias norm",round(np.linalg.norm(z),4),
              "cosine with common L1 bias",round(z@reference/np.linalg.norm(z),4))

print("\nCopy-path trace concentration on the candidate character subspace:")
for target,source in [((2,1),(0,5)),((3,1),(0,5)),((3,5),(0,5)),
                      ((3,1),(2,2)),((3,5),(2,2))]:
    l,j=target
    sl=slice(64*j,64*(j+1))
    gg=W[f"ln1_w.{l}"].astype(float)
    q=W[f"W_q.{l}"][sl].astype(float)*gg
    k=W[f"W_k.{l}"][sl].astype(float)*gg
    q-=q.mean(axis=1,keepdims=True)
    k-=k.mean(axis=1,keepdims=True)
    m=(q.T@k/8)@Cs[source]
    mc=Bc.T@m@Bc
    z=np.linalg.eigvals(mc)
    print(target,"via",source,"total trace",round(np.trace(m),4),
          "char-subspace trace",round(np.trace(mc),4),
          "char trace/nuclear norm",round(np.trace(mc)/np.linalg.svd(mc,compute_uv=False).sum(),4),
          "top real parts",np.round(np.sort(z.real)[-8:][::-1],4))
```
