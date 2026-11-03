```python
import numpy as np
from scipy.linalg import svd, svdvals
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=4, suppress=True, linewidth=180)

with threadpool_limits(limits=4):
    A,B={},{}
    for l in range(4):
        g=W[f"ln1_w.{l}"]
        for j in range(6):
            s=slice(64*j,64*(j+1))
            q=W[f"W_q.{l}"][s]*g
            k=W[f"W_k.{l}"][s]*g
            v=W[f"W_v.{l}"][s]*g
            o=W[f"W_o.{l}"][:,s]
            q=q-q.mean(1,keepdims=True)
            k=k-k.mean(1,keepdims=True)
            v=v-v.mean(1,keepdims=True)
            o=o-o.mean(0,keepdims=True)
            A[l,j]=q.T@k/8
            B[l,j]=o@v
    print("STRONGEST EARLIER-HEAD KEY-SIDE COMPOSITIONS")
    for l in range(1,4):
        for j in range(6):
            a=A[l,j]
            vals=[]
            for m in range(l):
                for k in range(6):
                    b=B[m,k]
                    val=np.trace(a@b)/(np.linalg.norm(a)*np.linalg.norm(b))
                    vals.append((float(val),f"L{m}H{k}"))
            print(f"L{l}H{j}",sorted(vals,reverse=True)[:5])

    print("\nL3H0 AND L3H1 COMPOSITION DETAILS")
    for j in [0,1]:
        for m in range(3):
            for k in range(6):
                c=A[3,j]@B[m,k]
                ss=svdvals(c)
                print(f"L3H{j} <- L{m}H{k}",
                      "trace/nuclear",round(float(np.trace(c)/ss.sum()),4),
                      "trace",round(float(np.trace(c)),4))

    print("\nL0 OV OUTPUT COORDINATE CONCENTRATION")
    for j in range(6):
        b=B[0,j]
        en=(b*b).sum(1)
        ids=np.argsort(en)[-10:][::-1]
        print(f"L0H{j}","top coords",ids,"energy fractions",en[ids]/en.sum())

    print("\nBIAS-DERIVED KEY DIRECTIONS: TOP COORDINATES")
    for l in range(1,4):
        for j in range(6):
            s=slice(64*j,64*(j+1))
            g=W[f"ln1_w.{l}"]
            kb=(W[f"W_k.{l}"][s]*g).T@(W[f"W_q.{l}"][s]@W[f"ln1_b.{l}"])/8
            kb-=kb.mean()
            ids=np.argsort(abs(kb))[-5:][::-1]
            print(f"L{l}H{j}",list(zip(ids.tolist(),np.round(kb[ids],4).tolist())),
                  "top5 energy",round(float(np.sum(kb[ids]**2)/np.sum(kb**2)),3))
```
