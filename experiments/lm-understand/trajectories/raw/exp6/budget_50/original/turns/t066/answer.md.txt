```python
import json, numpy as np
source=open("/work/policy_design_v23.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=json.load(open("/work/policy_config.json"))
cfg["framework_bonus"]=2.0
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
json.dump(cfg,open("/work/candidate_A_config.json","w"),indent=2)
np.savez("/work/candidate_A.npz",**tensors)
print("Restored candidate A for independent validation.")
print("Parameters:",sum(a.size for a in tensors.values()))
print("Finite tensors:",all(np.isfinite(a).all() for a in tensors.values()))
```