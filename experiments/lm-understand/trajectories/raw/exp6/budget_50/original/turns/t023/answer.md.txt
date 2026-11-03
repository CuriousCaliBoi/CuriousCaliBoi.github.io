```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # On an empty 9x9 board, take the central star point. This feature
    # switches off exactly after either player places the first stone.
    W[0][:,489]=0
    B[0][489]=1
    for p in range(81):
        W[0][3*p,489]=-1
        W[0][3*p+1,489]=-1
    for k in range(1,6):
        W[k][489,489]=1
    OW[489,40]+=cfg.get("opening_center",8.0)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v9.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(opening_center=8.0,pass_lead=0.0,
           black_territory_threshold=1.5,white_territory_threshold=1.5)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v9.npz",**tensors)
print("Saved v9: claim the center on the first move; retain v7's middlegame policy.")
```