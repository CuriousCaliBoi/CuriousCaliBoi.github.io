```python
import json, numpy as np
source=open("/work/policy_design_v23.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=json.load(open("/work/policy_config.json"))
cfg["repeat_risk"]=80.0
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v24.npz",**tensors)
print("Saved v24: isolated singleton recapture risk now dominates all local tactical bonuses.")
print("This avoids treating several nearby weak stones as justification for a repetition-prone recapture.")
```