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
        s=slice(64*j,64*(j+1))
        q,k,v=[(T(W[f"{n}.{l}"])[s]*g)@P for n in ["W_q","W_k","W_v"]]
        M[l,j]=q.T@k/8
        B[l,j]=P@T(W[f"W_o.{l}"])[:,s]@v

print("QK spectral structure:")
for l in range(4):
    for j in range(6):
        a=M[l,j]
        u,s,vh=torch.linalg.svd(a)
        ev=torch.linalg.eigvals(a)
        ev=ev[torch.argsort(ev.abs(),descending=True)[:8]]
        overlaps=torch.linalg.svdvals(u[:,:6].T@vh[:6].T)
        print(f"L{l}H{j}",
              "symmetric energy",round(float(((a+a.T)/2).norm().square()/a.norm().square()),3),
              "top6 Q/K-subspace overlaps",np.round(overlaps.numpy(),2),
              "eigenvalues",[(round(float(z.real),3),round(float(z.imag),3)) for z in ev])

u,s,vh=torch.linalg.svd(B[0,4])
r=vh[:3].T
print("\nL0H4 OV top-3 INPUT subspace and other L0 QK maps:")
for j in range(6):
    a=M[0,j]
    print(j,"query/key energy",
          np.round([float((r.T@a).norm().square()/a.norm().square()),
                    float((a@r).norm().square()/a.norm().square())],4),
          "3x3 restriction",np.round((r.T@a@r).numpy(),4))

print("\nDominant effective L0 OV input-subspace similarities (3 dims):")
rs=[torch.linalg.svd(B[0,j]).Vh[:3].T for j in range(6)]
print(np.round([[float((x.T@y).square().sum()/3) for y in rs] for x in rs],3))

print("\nJoint QK covariance spectra:")
for l in range(4):
    c=sum(a.T@a+a@a.T for (ll,j),a in M.items() if ll==l)
    e=torch.linalg.eigvalsh(c).flip(0)
    print(l,np.round((e[:45]/e.sum()).numpy(),4))

print("\nL0 FC input and projection output mean directions:")
f=(T(W["W_fc.0"])*T(W["ln2_w.0"]))@P
o=P@T(W["W_proj.0"])
fn=f/f.norm(dim=1,keepdim=True)
on=o/o.norm(dim=0,keepdim=True)
print("FC row norm quantiles",np.round(np.quantile(f.norm(dim=1).numpy(),[0,.1,.25,.5,.75,.9,1]),3))
print("FC nearest-other-row cosine quantiles",
      np.round(np.quantile((fn@fn.T-torch.eye(1536)*2).max(dim=1).values.numpy(),
                           [0,.1,.25,.5,.75,.9,1]),3))
print("Per-neuron paired input/output cosine quantiles",
      np.round(np.quantile((fn*on.T).sum(1).numpy(),[0,.1,.25,.5,.75,.9,1]),3))
```
