```python
import numpy as np
import torch
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T=lambda a: torch.as_tensor(np.asarray(a),dtype=torch.float64)
P=torch.eye(384)-torch.ones((384,384))/384

print("Output-side singular spectra; possible alphabet-sized bottlenecks:")
for l in range(4):
    for name in ["W_proj","W_o"]:
        a=P@T(W[f"{name}.{l}"])
        s=torch.linalg.svdvals(a)
        print(name,l,"first 65",np.round(s[:65].numpy(),3))
        ratios=s[:-1]/s[1:]
        ids=torch.argsort(ratios[:80],descending=True)[:8]
        print("largest early gaps (rank, ratio)",
              [(int(i)+1,round(float(ratios[i]),3)) for i in ids])

a=torch.cat([P@T(W["W_o.3"]),P@T(W["W_proj.3"])],dim=1)
u,s,vh=torch.linalg.svd(a,full_matrices=False)
print("\nCombined final-block outputs first 65 SVs",np.round(s[:65].numpy(),3))

print("\nMLP weight-row norm distributions and low-norm fractions:")
for l in range(4):
    f=T(W[f"W_fc.{l}"])
    o=T(W[f"W_proj.{l}"])
    fn=f.norm(dim=1).numpy()
    on=o.norm(dim=0).numpy()
    print(l,"FC norms",np.round(np.quantile(fn,[0,.1,.25,.5,.75,.9,.99,1]),3),
          "Proj norms",np.round(np.quantile(on,[0,.1,.25,.5,.75,.9,.99,1]),3),
          "FC < .6",round(float((fn<.6).mean()),3))

print("\nL0 positional-versus-value subspace separation:")
g=T(W["ln1_w.0"])
q=(T(W["W_q.0"])*g)@P
k=(T(W["W_k.0"])*g)@P
v=(T(W["W_v.0"])*g)@P
uq,sq,vq=torch.linalg.svd(torch.cat([q,k],dim=0),full_matrices=False)
uv,sv,vv=torch.linalg.svd(v,full_matrices=False)
print("QK input singular spectrum",np.round(sq[:60].numpy(),3))
print("V input singular spectrum",np.round(sv[:60].numpy(),3))
for r in [2,4,8,16,24,28,32,48]:
    z=torch.linalg.svdvals(vq[:r]@vv[:r].T)
    print("rank",r,"subspace overlaps",np.round(z.numpy(),3))
```
