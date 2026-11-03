```python
import numpy as np
# The colour plane is broadcast over all 81 points. Reading it at one
# fixed point is functionally invariant, although its raw weight row is not.
errors=[]
for reflect in [False,True]:
    for turns in range(4):
        perm=[]
        for p in range(81):
            r,c=divmod(p,9)
            if reflect: c=8-c
            for _ in range(turns): r,c=c,8-r
            perm.append(9*r+c)
        perm=np.asarray(perm)
        hp=np.concatenate([81*ch+perm for ch in range(6)]+[np.arange(486,512)])
        op=np.r_[perm,81]
        w=load("L1.W")
        stone_rows=np.array([3*p+ch for p in range(81) for ch in [0,1]])
        rotated_rows=np.array([3*perm[p]+ch for p in range(81) for ch in [0,1]])
        err=float(np.max(np.abs(w[np.ix_(rotated_rows,hp)]-w[stone_rows])))
        colour_weights=w[2::3].sum(axis=0)
        err=max(err,float(np.max(np.abs(colour_weights[hp]-colour_weights))))
        for k in range(1,7):
            bb=load("L%d.b"%k)
            err=max(err,float(np.max(np.abs(bb[hp]-bb))))
            if k>1:
                ww=load("L%d.W"%k)
                err=max(err,float(np.max(np.abs(ww[np.ix_(hp,hp)]-ww))))
        ww=load("out.W"); bb=load("out.b")
        err=max(err,float(np.max(np.abs(ww[np.ix_(hp,op)]-ww))),
                float(np.max(np.abs(bb[op]-bb))))
        errors.append(err)
assert max(errors)==0
print("Exact symmetry on all valid broadcast-colour inputs:",errors)
print("No weights changed.")
```