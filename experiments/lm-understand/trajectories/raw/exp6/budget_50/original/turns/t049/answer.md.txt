```python
import json, numpy as np
source=open("/work/policy_design_v18.py").read()
patch=r'''
    # Four-four openings balance central influence with access to a
    # corner, without committing to direct contact at the centre.
    W[0][:,489]=0
    B[0][489]=1
    for p in range(81):
        W[0][3*p,489]=-1
        W[0][3*p+1,489]=-1
    for k in range(1,6):
        W[k][489,489]=1
    for p in [30,32,48,50]:
        OW[489,p]+=cfg.get("opening_four_four",6.0)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v21.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(opening_four_four=6.0,temperature_scale=2.5)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v21.npz",**tensors)
print("Saved v21: symmetric four-four opening choices.")
```