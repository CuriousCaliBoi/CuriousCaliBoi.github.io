```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(enemy_adj=1.3,enemy_diag=0.7,enemy_two=0.4,
           own_adj=0.4,attack=1.4)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v14.npz",**tensors)
print("Saved v14: contest the opponent's boundary earlier instead of conceding central space.")
```