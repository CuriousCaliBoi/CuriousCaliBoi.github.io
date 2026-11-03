```python
import numpy as np
import torch
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
T = lambda a: torch.as_tensor(np.asarray(a), dtype=torch.float64)
P = torch.eye(384) - torch.ones((384,384))/384
M, B = {}, {}

print("Effective linear maps include LayerNorm gain and mean-centering only.")
print("No normalization of inputs, attention, or MLP evaluation is performed.")
for l in range(4):
    g = T(W[f"ln1_w.{l}"])
    b = T(W[f"ln1_b.{l}"])
    for j in range(6):
        s = slice(j*64,(j+1)*64)
        q, k, v = [T(W[f"{name}.{l}"])[s] for name in ["W_q","W_k","W_v"]]
        o = T(W[f"W_o.{l}"])[:,s]
        qe, ke, ve = (q*g)@P, (k*g)@P, (v*g)@P
        a, c = qe.T@ke/8, P@o@ve
        M[l,j], B[l,j] = a,c
        sv = torch.linalg.svdvals(a)
        cs = torch.linalg.svdvals(c)
        keybias = ke.T@(q@b)/8
        print(f"L{l}H{j}",
              "QK_F/top/r90/tr",
              np.round([float(a.norm()),float(sv[0]),
                        int(torch.searchsorted(sv.square().cumsum(0),.9*sv.square().sum()))+1,
                        float(torch.trace(a))],4),
              "QK_svs", np.round(sv[:6].numpy(),3),
              "OV_F/tr",np.round([float(c.norm()),float(torch.trace(c))],3),
              "key_bias_norm",round(float(keybias.norm()),4))

print("\nWithin-layer QK cosine matrices:")
for l in range(4):
    print("L",l)
    print(np.round([[float((M[l,i]*M[l,j]).sum()/(M[l,i].norm()*M[l,j].norm()))
                     for j in range(6)] for i in range(6)],3))

print("\nKey-composition trace cosine: trace(QK_later @ OV_earlier)/(norms)")
for l in range(1,4):
    for j in range(6):
        a=M[l,j]
        scores=[]
        for p in range(l):
            for h in range(6):
                c=B[p,h]
                z=float(torch.trace(a@c)/(a.norm()*c.norm()))
                scores.append((z,f"L{p}H{h}"))
        scores.sort(reverse=True)
        print(f"L{l}H{j}", "highest",[(n,round(z,4)) for z,n in scores[:4]],
              "lowest",[(n,round(z,4)) for z,n in scores[-2:]])

print("\nL0 gain extremes and corresponding linear-map column norms:")
g=np.asarray(W["ln1_w.0"])
idx=np.r_[np.argsort(g)[:12],np.argsort(g)[-12:]]
for i in idx:
    print(int(i), "g1/g2",round(float(g[i]),4),round(float(W["ln2_w.0"][i]),4),
          "q/k/v/fc", np.round([np.linalg.norm(W[n+".0"][:,i])
                                 for n in ["W_q","W_k","W_v","W_fc"]],3))

print("\nLinear MLP weight products (not MLP evaluations):")
for l in range(4):
    a=P@T(W[f"W_proj.{l}"])@(T(W[f"W_fc.{l}"])*T(W[f"ln2_w.{l}"]))@P
    ev=torch.linalg.eigvals(a)
    print(l,"Frob/trace",round(float(a.norm()),3),round(float(torch.trace(a)),3),
          "eig real min/max",round(float(ev.real.min()),3),round(float(ev.real.max()),3))
```
