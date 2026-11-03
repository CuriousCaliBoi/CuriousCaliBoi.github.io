```python
import numpy as np
import torch
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384
M,B={},{}

for l in range(4):
    g=T(W[f"ln1_w.{l}"])
    for j in range(6):
        sl=slice(64*j,64*(j+1))
        q,k,v=[(T(W[f"{n}.{l}"])[sl]*g)@P for n in ["W_q","W_k","W_v"]]
        M[l,j]=q.T@k/8
        B[l,j]=P@T(W[f"W_o.{l}"])[:,sl]@v

print("Directional composition: key trace(M B), query trace(M B.T), each divided by ||M||||B||.")
print("A substantially key-specific positive match is more suggestive of an induction circuit.")
for l in range(1,4):
    for j in range(6):
        a=M[l,j]
        rows=[]
        for p in range(l):
            for h in range(6):
                b=B[p,h]
                den=a.norm()*b.norm()
                key=float(torch.trace(a@b)/den)
                query=float(torch.trace(a@b.T)/den)
                rows.append((key-query,key,query,p,h))
        rows.sort(reverse=True)
        print(f"L{l}H{j}",[(f"L{p}H{h}",round(k,4),round(q,4),round(d,4))
                            for d,k,q,p,h in rows[:3]])

print("\nL0 QK energy in a value-defined candidate character subspace:")
g=T(W["ln1_w.0"])
v1=(T(W["W_v.0"])[64:128]*g)@P
v5=(T(W["W_v.0"])[320:384]*g)@P
c=v1.T@v1+v5.T@v5
ev,u=torch.linalg.eigh(c)
u=u.flip(1)
for r in [16,24,32]:
    z=u[:,:r]
    print("subspace dimension",r)
    for j in range(6):
        a=M[0,j]
        den=a.norm().square()
        qe=float((z.T@a).norm().square()/den)
        ke=float((a@z).norm().square()/den)
        both=float((z.T@a@z).norm().square()/den)
        print(j,"query/key/both",np.round([qe,ke,both],4))

print("\nL1 attention query-bias key directions: pairwise cosine.")
kb=[]
for j in range(6):
    sl=slice(64*j,64*(j+1))
    q=T(W["W_q.1"])[sl]
    k=(T(W["W_k.1"])[sl]*T(W["ln1_w.1"]))@P
    v=k.T@(q@T(W["ln1_b.1"]))/8
    kb.append(v/v.norm())
print(np.round(torch.stack(kb).numpy()@torch.stack(kb).numpy().T,3))
```
