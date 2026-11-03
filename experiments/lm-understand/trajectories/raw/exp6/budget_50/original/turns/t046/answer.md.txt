```python
import json, numpy as np
source=open("/work/policy_design_v18.py").read()
patch=r'''
    # Smooth influence beyond immediate contact distinguishes contested
    # boundaries from the interiors of larger frameworks.
    for p in range(81):
        for colour,ch in [(0,3),(1,4)]:
            j=u(ch,p)
            W[5][:,j]=0
            B[5][j]=-cfg["territory_threshold"]
            for q,dr,dc in rings[p]:
                weight=float(np.exp(-(dr*dr+dc*dc-1)/
                                    cfg.get("influence_width",3.5)))
                W[5][u(colour,q),j]+=weight
                W[5][u(1-colour,q),j]-=1.2*weight
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v20.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(temperature_scale=2.5,influence_width=3.5)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v20.npz",**tensors)
print("Saved v20: broader territorial influence discourages redundant interior moves.")
```