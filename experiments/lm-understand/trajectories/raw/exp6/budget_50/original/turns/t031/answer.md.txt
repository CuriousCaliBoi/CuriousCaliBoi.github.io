```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
open("/work/policy_design.py","w").write(source)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg=dict(
    capture=9.0,rescue=6.0,attack=1.15,self_atari=7.5,
    eye=11.0,connection=0.9,contact=1.4,
    own_territory=2.5,enemy_territory=1.0,territory_threshold=1.5,
    pass_base=-12.0,pass_per_stone=0.10,pass_white=3.35,
    own_adj=0.20,own_diag=0.50,own_two=0.70,own_knight=0.30,
    enemy_adj=0.70,enemy_diag=0.40,enemy_two=0.25,
    temperature_scale=2.5,surrounded_penalty=10.0,repeat_risk=18.0,
)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v13.npz",**tensors)
print("Saved v13: more decisive shape choices and greater endgame persistence as Black.")
```