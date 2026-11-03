```python
import numpy as np
import torch
torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)

def t(a):
    return torch.as_tensor(np.asarray(a), dtype=torch.float64)

def spec(a):
    s = torch.linalg.svdvals(a)
    energy = s.square()
    rank90 = int(torch.searchsorted(torch.cumsum(energy, 0), .9 * energy.sum())) + 1
    return float(torch.linalg.norm(a)), float(s[0]), float(energy.sum()/energy[0]), rank90

print("All calculations below are on weights, not network activations.")
for l in range(4):
    print("\nLAYER", l)
    for name in ["ln1_w", "ln1_b", "ln2_w", "ln2_b"]:
        a = np.asarray(W[f"{name}.{l}"])
        print(name, "mean/std/min/max/norm",
              np.round([a.mean(), a.std(), a.min(), a.max(), np.linalg.norm(a)], 4))
    for name in ["W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"]:
        print(name, "Frob/topSV/stableRank/rank90",
              tuple(round(x, 3) if isinstance(x, float) else x
                    for x in spec(t(W[f"{name}.{l}"]))))

print("\nHEADS: raw QK = Q.T @ K / 8; OV = O @ V")
print("QK: Frob, topSV, stableRank, rank90, trace, symmetric min/max eigenvalue")
print("OV: Frob, topSV, stableRank, rank90, trace, largest-real eigenvalues")
for l in range(4):
    for j in range(6):
        sl = slice(64*j, 64*(j+1))
        q = t(W[f"W_q.{l}"])[sl]
        k = t(W[f"W_k.{l}"])[sl]
        v = t(W[f"W_v.{l}"])[sl]
        o = t(W[f"W_o.{l}"])[:, sl]
        a = q.T @ k / 8
        b = o @ v
        ae = torch.linalg.eigvalsh((a+a.T)/2)
        be = torch.linalg.eigvals(v @ o)
        idx = torch.argsort(be.real, descending=True)[:4]
        print(f"L{l}H{j}",
              "QK", tuple(round(x, 3) if isinstance(x, float) else x for x in spec(a)),
              "tr", round(float(torch.trace(a)), 3),
              "sym", np.round([float(ae[0]), float(ae[-1])], 3),
              "OV", tuple(round(x, 3) if isinstance(x, float) else x for x in spec(b)),
              "tr", round(float(torch.trace(b)), 3),
              "eig", [(round(float(be[z].real), 3), round(float(be[z].imag), 3)) for z in idx])
```
