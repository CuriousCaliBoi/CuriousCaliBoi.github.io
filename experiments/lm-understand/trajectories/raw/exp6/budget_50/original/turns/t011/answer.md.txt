```python
import json, numpy as np
source=open("/work/policy_design_v2.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
config=dict(
    own_territory=2.5, territory_threshold=1.5,
    own_adj=0.20, own_diag=0.50, own_two=0.70, own_knight=0.30,
    enemy_adj=0.70, enemy_diag=0.40, enemy_two=0.25,
)
cfg,tensors=ns["build"](save,config)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v4.npz",**tensors)
print("Saved v4: prioritize outward extension and contested boundaries over interior consolidation.")
print(json.dumps(cfg,indent=2))
```