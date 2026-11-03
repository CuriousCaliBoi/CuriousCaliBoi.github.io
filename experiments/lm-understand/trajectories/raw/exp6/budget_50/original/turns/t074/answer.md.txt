```python
import json, hashlib, numpy as np

names = ["L%d.%s"%(k,t) for k in range(1,7) for t in ["W","b"]]
names += ["out.W","out.b"]
tensors = {n:load(n) for n in names}
reference = np.load("/work/candidate_A.npz")
assert all(np.array_equal(tensors[n],reference[n]) for n in names)
assert all(np.isfinite(a).all() for a in tensors.values())

# Static symmetry checks on weights only; no network evaluation.
errors=[]
for reflect in [False,True]:
    for turns in range(4):
        perm=[]
        for p in range(81):
            r,c=divmod(p,9)
            if reflect: c=8-c
            for _ in range(turns): r,c=c,8-r
            perm.append(9*r+c)
        perm=np.array(perm)
        ip=np.array([3*perm[p]+ch for p in range(81) for ch in range(3)])
        hp=np.concatenate([81*ch+perm for ch in range(6)]+[np.arange(486,512)])
        op=np.r_[perm,81]
        err=0.0
        for k in range(1,7):
            w=tensors["L%d.W"%k]; bb=tensors["L%d.b"%k]
            rp=ip if k==1 else hp
            err=max(err,float(np.max(np.abs(w[np.ix_(rp,hp)]-w))))
            err=max(err,float(np.max(np.abs(bb[hp]-bb))))
        err=max(err,float(np.max(np.abs(tensors["out.W"][np.ix_(hp,op)]-tensors["out.W"]))))
        err=max(err,float(np.max(np.abs(tensors["out.b"][op]-tensors["out.b"]))))
        errors.append(err)

black=np.load("/work/pass_36/logits.npy")
white=np.load("/work/pass_37/logits.npy")
print("Checkpoint unchanged:", True)
print("Eight board-symmetry weight errors:", errors)
print("Colour-swapped placement-logit error:",float(np.max(np.abs(black[:,:81]-white[:,:81]))))
print("White pass-logit increments:",np.round(white[:,81]-black[:,81],6).tolist())
print("Nonzero weights/biases:",sum(np.count_nonzero(a) for a in tensors.values()))
digest=hashlib.sha256()
for n in names:
    digest.update(n.encode())
    digest.update(tensors[n].tobytes())
print("Checkpoint SHA256:",digest.hexdigest())
json.dump({"checkpoint":digest.hexdigest(),"validation_passes":[28,31,32,33,34,35]},
          open("/work/final_validation_manifest.json","w"),indent=2)
```