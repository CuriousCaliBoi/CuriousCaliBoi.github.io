```python
import numpy as np
from scipy.linalg import fractional_matrix_power
from threadpoolctl import threadpool_limits
threadpool_limits(4)

for scaled in [False,True]:
    g=W["ln1_w.0"].astype(float) if scaled else np.ones(384)
    As=[]
    for j in range(6):
        s=slice(64*j,64*(j+1))
        As.append((W["W_q.0"][s]*g).T@(W["W_k.0"][s]*g)/8)
    print("\nScaled" if scaled else "\nUnscaled","QK kernel power comparisons")
    ref=As[3]/np.linalg.norm(As[3],2)
    powers=[np.eye(384)]
    for z in range(8):
        powers.append(powers[-1]@ref)
    for j in range(6):
        print("L0H%d cos powers 0..8"%j,np.round([
            np.sum(As[j]*P)/(np.linalg.norm(As[j])*np.linalg.norm(P)) for P in powers],3))
    q=W["W_q.0"][192:256].astype(float)*g
    k=W["W_k.0"][192:256].astype(float)*g
    _,s,P=np.linalg.svd(np.vstack([q,k]),full_matrices=False)
    for r in [16,24,32]:
        Z=P[:r].T
        # Whitening of a weight Gram matrix, not a network normalization.
        H=(Z.T@(q.T@q+k.T@k)@Z)/16
        ev,U=np.linalg.eigh(H)
        wh=U@np.diag(1/np.sqrt(ev))@U.T
        M=[wh@Z.T@A@Z@wh for A in As]
        u,sv,vt=np.linalg.svd(M[3])
        R=u@vt
        print("rank",r,"polar power comparison")
        for j in [0,1,2,4,5]:
            vals=[]
            for lag in range(9):
                z=np.linalg.matrix_power(R,lag)
                vals.append(np.sum(M[j]*z)/(np.linalg.norm(M[j])*np.linalg.norm(z)))
            print("H",j,np.round(vals,3))
```
