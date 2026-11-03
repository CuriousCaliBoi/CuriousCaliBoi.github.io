```python
import json, numpy as np
source=open("/work/policy_design_v18.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=json.load(open("/work/policy_config.json"))
cfg["temperature_scale"]=4.0
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v19.npz",**tensors)
print("Saved v19: sharpen the policy while retaining symmetry among equally valued moves.")
```