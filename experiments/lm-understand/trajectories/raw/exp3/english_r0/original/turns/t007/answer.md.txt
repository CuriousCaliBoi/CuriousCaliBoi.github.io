```python
import numpy as np
from scipy.linalg import svd
from threadpoolctl import threadpool_limits
np.set_printoptions(precision=4, suppress=True, linewidth=160)

with threadpool_limits(limits=4):
    print("EARLY READ-SUBSPACE SEPARATION")
    for gained in [False,True]:
        g=W["ln1_w.0"] if gained else np.ones(384)
        posmat=np.vstack([W["W_q.0"][128:192]*g,W["W_k.0"][128:192]*g])
        valmat=W["W_v.0"][128:192]*g
        posmat-=posmat.mean(1,keepdims=True)
        valmat-=valmat.mean(1,keepdims=True)
        p=svd(posmat,full_matrices=False)[2][:32].T
        t=svd(valmat,full_matrices=False)[2][:24].T
        print("gains",gained,"position/value overlap",np.linalg.norm(p.T@t)**2/24)
        for j in range(6):
            s=slice(j*64,(j+1)*64)
            b=(W["W_o.0"][:,s]@W["W_v.0"][s])*g
            b=b-b.mean(1,keepdims=True)
            q=W["W_q.0"][s]*g
            k=W["W_k.0"][s]*g
            q=q-q.mean(1,keepdims=True)
            k=k-k.mean(1,keepdims=True)
            u,ss,vh=svd(q.T@k/8,full_matrices=False)
            dirs={"QK_left1":u[:,0],"QK_right1":vh[0],
                  "OV_row222":b[222],"OV_row78":b[78],"OV_row72":b[72]}
            vals=[]
            for name,z in dirs.items():
                z=z/np.linalg.norm(z)
                vals.append((name,round(float(np.linalg.norm(p.T@z)**2),3),
                             round(float(np.linalg.norm(t.T@z)**2),3)))
            print(f"L0H{j}","direction, pos-overlap, value-overlap:",vals)
    print("\nL0 SHARED-REGISTER READ-DIRECTION SIMILARITY")
    for coord in [72,78,222]:
        reads=[]
        for j in [0,1,3,4,5]:
            s=slice(j*64,(j+1)*64)
            row=W["W_o.0"][coord,s]@W["W_v.0"][s]
            reads.append(row/np.linalg.norm(row))
        z=np.stack(reads)
        print("coord",coord,"heads [0,1,3,4,5]\n",z@z.T)
```
