```python
import json, numpy as np
source=open("/work/policy_design_v22.py").read()
patch=r'''
    # A third-line framework is economical on 9x9: it can limit a
    # central group while retaining room for eyes on the outside.
    for p in range(81):
        r,c=divmod(p,9)
        if max(abs(r-4),abs(c-4))==2:
            OB[p]+=cfg.get("framework_bonus",2.0)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v23.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg["framework_bonus"]=2.0
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v23.npz",**tensors)
print("Saved v23: a symmetric third-line framework prior.")
```