```python
import numpy as np
from scipy.linalg import svd, svdvals, eigvalsh
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=4, suppress=True, linewidth=180)

def cent(a):
    return a-a.mean(0,keepdims=True)-a.mean(1,keepdims=True)+a.mean()

with threadpool_limits(limits=4):
    print("DIRECT POSITION-REGISTER WEIGHTS")
    for name in ["ln1_w.0","ln2_w.0","ln1_w.1","ln1_b.1","ln1_w.2","ln1_b.2","ln1_w.3","ln1_b.3"]:
        print(name, {i:round(float(W[name][i]),5) for i in [72,78,103,222,360]})

    print("\nCOPY-CIRCUIT ROBUSTNESS TO ALGEBRAIC CONVENTIONS")
    for gains in [False,True]:
        g0=W["ln1_w.0"] if gains else np.ones(384)
        g3=W["ln1_w.3"] if gains else np.ones(384)
        b=cent((W["W_o.0"][:,128:192]@W["W_v.0"][128:192])*g0)
        value_read=W["W_v.0"][128:192]*g0
        value_read-=value_read.mean(1,keepdims=True)
        basis=svd(value_read,full_matrices=False)[2].T
        for j in [0,1,2,3,4,5]:
            s=slice(64*j,64*(j+1))
            a=cent((W["W_q.3"][s]*g3).T@(W["W_k.3"][s]*g3)/8)
            c=a@b
            vals=[]
            for rank in [16,20,24,28,32]:
                u=basis[:,:rank]
                cr=u.T@c@u
                vals.append(float(np.trace(cr)/svdvals(cr).sum()))
            print("gains",gains,f"L3H{j}","restricted trace/nuclear at ranks16,20,24,28,32",np.round(vals,4))

    print("\nLATE CONTENT-SPACE DIMENSION CHECK")
    for name,mat in [
        ("W_proj.3",W["W_proj.3"]),
        ("L3H1 W_o",W["W_o.3"][:,64:128]),
        ("L3H5 W_o",W["W_o.3"][:,320:384])
    ]:
        ss=svdvals(mat)
        print(name,"singular values 19..36",ss[18:36])

    print("\nHEAD READ/WRITE ALIGNMENT WITH THREE SHARED REGISTERS")
    for l in range(4):
        g=W[f"ln1_w.{l}"]
        for j in range(6):
            s=slice(64*j,64*(j+1))
            q=W[f"W_q.{l}"][s]*g
            k=W[f"W_k.{l}"][s]*g
            a=cent(q.T@k/8)
            qb=W[f"W_q.{l}"][s]@W[f"ln1_b.{l}"]
            kb=k.T@qb/8
            kb-=kb.mean()
            reg=[72,78,222]
            print(f"L{l}H{j}",
                  "QK key-register fraction",round(float(np.sum(a[:,reg]**2)/np.sum(a*a)),3),
                  "bias key-register fraction",round(float(np.sum(kb[reg]**2)/np.sum(kb*kb)),3),
                  "key bias norm",round(float(np.linalg.norm(kb)),3))
```
