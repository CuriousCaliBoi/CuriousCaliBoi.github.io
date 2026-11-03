```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # Komi-aware territorial ambition: Black needs more than half the
    # board, while White can consolidate a more modest share.
    for p in range(81):
        B[5][u(3,p)]=-cfg.get("black_territory_threshold",0.75)
        W[5][488,u(3,p)]=(
            cfg.get("black_territory_threshold",0.75)
            -cfg.get("white_territory_threshold",1.5))

    # Passing is safer when materially ahead, riskier when behind.
    lead=cfg.get("pass_lead",0.10)
    OW[486,81]+=lead
    OW[487,81]-=lead
    OB[81]-=7.5*lead
    OW[488,81]+=15.0*lead
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v8.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(black_territory_threshold=0.75,white_territory_threshold=1.5,pass_lead=0.10)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v8.npz",**tensors)
print("Saved v8: komi-aware expansion and material-aware passing.")
```