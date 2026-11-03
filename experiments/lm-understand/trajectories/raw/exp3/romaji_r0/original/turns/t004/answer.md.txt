```python
import numpy as np
from scipy.linalg import svd
from threadpoolctl import threadpool_limits

with threadpool_limits(limits=4):
    A, B = {}, {}
    for l in range(4):
        g = W[f"ln1_w.{l}"].astype(float)
        for j in range(6):
            sl = slice(j*64,(j+1)*64)
            q = W[f"W_q.{l}"][sl].astype(float)*g
            k = W[f"W_k.{l}"][sl].astype(float)*g
            v = W[f"W_v.{l}"][sl].astype(float)*g
            q -= q.mean(1,keepdims=True)
            k -= k.mean(1,keepdims=True)
            v -= v.mean(1,keepdims=True)
            A[l,j] = q.T@k/8
            B[l,j] = W[f"W_o.{l}"][:,sl].astype(float)@v
    print("Key-path matching: tr(QK_l @ OV_0)/(||QK_l||F ||OV_0||F)")
    for l in range(1,4):
        for j in range(6):
            a=A[l,j]
            print(f"L{l}H{j}",np.round([np.trace(a@B[0,h])/
                   (np.linalg.norm(a)*np.linalg.norm(B[0,h])) for h in range(6)],4))
    print("\nLargest matching compositions across all preceding heads:")
    for l in range(1,4):
        for j in range(6):
            a=A[l,j]
            scores=[]
            for m in range(l):
                for h in range(6):
                    b=B[m,h]
                    z=np.trace(a@b)/(np.linalg.norm(a)*np.linalg.norm(b))
                    scores.append((z,f"L{m}H{h}"))
            print(f"L{l}H{j}",[(h,round(z,4)) for z,h in sorted(scores,reverse=True)[:4]])

    print("\nL0H3 OV spectrum after LN scale/centering")
    u,s,vt=svd(B[0,3],full_matrices=False)
    print(np.round(s[:64],4))
    print("L0H0 OV spectrum")
    print(np.round(svd(B[0,0],compute_uv=False)[:48],4))

    print("\nMLP0 input-weight Gram coupling between current-token and H3-written subspaces")
    f=W["W_fc.0"].astype(float)*W["ln2_w.0"].astype(float)
    f-=f.mean(1,keepdims=True)
    gram=f.T@f
    for r in (12,16,20,24,28,32):
        basis=vt[:r].T
        t=basis.T@gram@B[0,3]@basis
        z=np.linalg.eigvals(t)
        z=z[np.argsort(abs(z))[::-1]][:10]
        print("rank",r,"eigs",np.round(z,3))

    print("\nLater-head QK on H3's read-to-write circuit (r=24)")
    basis=vt[:24].T
    for l in range(1,4):
        for j in range(6):
            t=basis.T@A[l,j]@B[0,3]@basis
            sy=(t+t.T)/2
            ev=np.linalg.eigvalsh(sy)
            print(f"L{l}H{j}",np.round([
                  np.linalg.norm(t),np.trace(t),
                  np.linalg.norm(sy)**2/(np.linalg.norm(t)**2+1e-30),
                  ev[-1],ev[0]],4))
```
