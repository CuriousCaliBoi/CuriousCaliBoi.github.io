```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # Defend vulnerable groups before their final liberty is taken.
    # The feature is graded: strongest in atari, weaker with nearby
    # evidence of additional liberties.
    for p in range(81):
        j=u(2,p)
        W[3][:,j]=0
        B[3][j]=0
        W[3][u(0,p),j]=3
        W[3][u(2,p),j]=-1
        for q in adj[p]:
            W[3][u(2,q),j]-=0.5
        W[4][u(4,p),u(4,p)]=-12
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v10.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(rescue=2.2,opening_center=0.0)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v10.npz",**tensors)
print("Saved v10: graded preventive defense, with suicidal rescues still suppressed.")
```