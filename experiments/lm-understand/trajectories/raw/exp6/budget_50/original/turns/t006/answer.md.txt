```python
import numpy as np
path="/work/pass_2/"
X=np.load(path+"inputs.npy").reshape(-1,81,3)
logits=np.load(path+"logits.npy")
acts=[np.load(path+"act_L%d.npy"%k) for k in range(1,7)]
for n, candidates in enumerate([[79,75,76],[37,78,71],[0,55,52]]):
    print("\nPOSITION",n)
    for p in candidates:
        print("move",divmod(p,9),"logit",float(logits[n,p]))
        for k in range(6):
            print(" L",k+1, np.round(acts[k][n,:486].reshape(6,81)[:,p],3).tolist())
        r,c=divmod(p,9)
        nn=[rr*9+cc for rr,cc in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)] if 0<=rr<9 and 0<=cc<9]
        print("adjacent stone features:",
              [(q,X[n,q,:2].astype(int).tolist(),
                np.round(acts[3][n,:486].reshape(6,81)[:,q],2).tolist()) for q in nn])
```