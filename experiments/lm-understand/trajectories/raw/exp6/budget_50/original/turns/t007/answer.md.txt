```python
import json, numpy as np
p="/work/policy_design.py"
s=open(p).read()
s=s.replace('temperature_scale=1.0,','temperature_scale=1.8,\n    surrounded_penalty=10.0,')
s=s.replace(
    '    # Layer 6: combine tactics',
    '''    # Empty points surrounded by friendly stones are normally already
    # owned. Preserve them even when diagonal enemies make them false eyes.
    for p in range(81):
        j = u(5,p)
        B[4][j] = 1-len(adj[p])
        for q in adj[p]:
            W[4][u(0,q),j] = 1

    # Layer 6: combine tactics''')
s=s.replace(
    'W[5][u(4,p),j] = cfg["rescue"]',
    'W[5][u(4,p),j] = cfg["rescue"]\n        W[5][u(5,p),j] = -cfg["surrounded_penalty"]')
open(p,"w").write(s)
ns={}
exec(compile(s,p,"exec"),ns)
cfg,tensors=ns["build"](save)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v2.npz",**tensors)
print("Saved v2: protect all friendly surrounds and sharpen the analytic policy.")
```