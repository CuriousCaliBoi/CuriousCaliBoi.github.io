```python
import json, numpy as np
source=open("/work/policy_design_v5.py").read()
source=source.replace(
    "    # Layer 4: approximate whole-group atari, self-atari, weak enemies.",
    '''    # The unused opponent-extension channel instead detects exactly
    # an enemy singleton with one liberty.
    for p in range(81):
        j=u(5,p)
        W[2][:,j]=0
        B[2][j]=-len(adj[p])
        W[2][u(1,p),j]=2
        for q in adj[p]:
            W[2][u(0,q),j]+=1
            W[2][u(1,q),j]-=1

    # Layer 4: approximate whole-group atari, self-atari, weak enemies.''')
source=source.replace(
    "    # Layer 5: spatial prior, captures, attack, safe rescue, and",
    '''    # Avoid isolated singleton recaptures with at most one other
    # liberty. These are common ko/snapback repetition traps.
    for p in range(81):
        j=u(5,p)
        W[3][:,j]=0
        B[3][j]=-len(adj[p])
        for q in adj[p]:
            W[3][u(5,q),j]+=2
            W[3][u(0,q),j]-=3
            W[3][u(1,q),j]+=1

    # Layer 5: spatial prior, captures, attack, safe rescue, and''')
source=source.replace(
    '            W[4][u(5,q),j] += cfg["attack"]',
    '        W[4][u(5,p),j] -= cfg.get("repeat_risk",18.0)')
# The replacement above puts a single risk term after the adjacency loop.
source=source.replace("temperature_scale=1.8,",
                      "temperature_scale=1.8,\n    repeat_risk=18.0,")
cfg=json.load(open("/work/policy_config.json"))
cfg.update(capture=12.5, repeat_risk=18.0)
open("/work/policy_design_v6.py","w").write(source)
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v6.npz",**tensors)
print("Saved v6: explicit singleton ko/snapback risk avoidance.")
```