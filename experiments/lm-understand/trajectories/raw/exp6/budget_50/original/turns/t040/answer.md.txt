```python
import json, numpy as np
source=open("/work/policy_design_v16.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(own_adj=0.8,contact=3.0)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v17.npz",**tensors)
print("Saved v17: prefer supported fighting and avoid unsupported multi-stone contact.")
```