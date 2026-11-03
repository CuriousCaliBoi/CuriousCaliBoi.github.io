```python
import json, numpy as np
source=open("/work/policy_design_v18.py").read()
patch=r'''
    # Value additional territory at the contested boundary more than
    # safe consolidation inside an existing sphere of influence.
    for p in range(81):
        B[5][u(3,p)]=-cfg.get("own_territory_threshold",0.5)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v22.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(own_territory=3.0,own_territory_threshold=0.5)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v22.npz",**tensors)
print("Saved v22: greater territorial ambition at contested boundaries.")
```