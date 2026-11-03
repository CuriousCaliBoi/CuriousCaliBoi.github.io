```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # Opening line preferences should not make first-line endgame
    # points artificially unattractive. Flatten them as the board fills.
    start=cfg.get("endgame_start",12.0)
    finish=cfg.get("endgame_finish",52.0)
    for g,threshold in [(489,start),(490,finish)]:
        W[0][:,g]=0
        B[0][g]=-threshold/(finish-start)
        for p in range(81):
            W[0][3*p,g]=1/(finish-start)
            W[0][3*p+1,g]=1/(finish-start)
        for k in range(1,6):
            W[k][g,g]=1
    for p in range(81):
        r,c=divmod(p,9)
        prior=line_prior[min(r,8-r)]+line_prior[min(c,8-c)]
        delta=cfg.get("endgame_prior",2.0)-prior
        OW[489,p]+=delta
        OW[490,p]-=delta
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v15.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(endgame_start=12.0,endgame_finish=52.0,endgame_prior=2.0)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v15.npz",**tensors)
print("Saved v15: opening geometry transitions to uniform point value in the endgame.")
```