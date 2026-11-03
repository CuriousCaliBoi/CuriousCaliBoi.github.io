```python
import numpy as np
from scipy.linalg import svdvals
from threadpoolctl import threadpool_limits
threadpool_limits(4)

def summary(a):
    a = np.asarray(a, dtype=np.float64)
    return (float(np.linalg.norm(a)), float(a.mean()), float(a.std()), float(a.min()), float(a.max()))

def spectral(a):
    s = svdvals(np.asarray(a, dtype=np.float64), check_finite=False)
    e = s*s
    return [float(s[0]), float(e[:1].sum()/e.sum()), float(e[:4].sum()/e.sum()),
            float(e[:16].sum()/e.sum()), float(e.sum()/e[0])]

print("Keys:", sorted(W))
for l in range(4):
    print("\nLAYER", l)
    for name in ["ln1_w", "ln1_b", "ln2_w", "ln2_b"]:
        print(name, "norm,mean,std,min,max:", np.round(summary(W[f"{name}.{l}"]), 5))
    for name in ["W_q", "W_k", "W_v", "W_o", "W_fc", "W_proj"]:
        a = W[f"{name}.{l}"]
        print(name, "Frobenius:", round(float(np.linalg.norm(a)), 4),
              "smax,energy1,energy4,energy16,stable_rank:", np.round(spectral(a), 4))

print("\nHEADS: raw weight products only; no inputs or forward passes")
print("QK = diag(ln1_w) Q.T K diag(ln1_w); OV = O V diag(ln1_w)")
print("Fields: QK[Frob,smax,E1,E4,E16,stable_rank,symmetry,trace/Frob]; OV[same]; QK bias norms")
for l in range(4):
    g = np.asarray(W[f"ln1_w.{l}"], dtype=np.float64)
    b = np.asarray(W[f"ln1_b.{l}"], dtype=np.float64)
    for j in range(6):
        sl = slice(64*j,64*(j+1))
        q = np.asarray(W[f"W_q.{l}"][sl],dtype=np.float64)
        k = np.asarray(W[f"W_k.{l}"][sl],dtype=np.float64)
        v = np.asarray(W[f"W_v.{l}"][sl],dtype=np.float64)
        o = np.asarray(W[f"W_o.{l}"][:,sl],dtype=np.float64)
        a = (q*g).T @ (k*g) / 8
        c = o @ (v*g)
        def stats(m):
            f = np.linalg.norm(m)
            return np.array([f]+spectral(m)+[
                np.sum(m*m.T)/(f*f), np.trace(m)/f])
        biases = [np.linalg.norm((k*g).T @ (q@b)/8),
                  np.linalg.norm((q*g).T @ (k@b)/8)]
        print(f"L{l}H{j}", "QK", np.round(stats(a),4),
              "OV", np.round(stats(c),4), "bias", np.round(biases,4))
```
