```python
import json, numpy as np
source=open("/work/policy_design_v23.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=dict(
    capture=9.0,rescue=8.0,attack=1.4,self_atari=7.5,
    eye=11.0,connection=0.9,contact=3.0,
    own_territory=3.0,own_territory_threshold=0.5,
    enemy_territory=1.0,territory_threshold=1.5,
    pass_base=-12.0,pass_per_stone=0.10,pass_white=3.35,
    own_adj=0.8,own_diag=0.5,own_two=0.7,own_knight=0.3,
    enemy_adj=1.3,enemy_diag=0.7,enemy_two=0.4,
    temperature_scale=2.5,surrounded_penalty=10.0,
    repeat_risk=80.0,rescue_size=0.4,framework_bonus=4.0,
)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v26.npz",**tensors)
print("Saved v26: restore capture responsiveness and reinforce the third-line framework.")
```