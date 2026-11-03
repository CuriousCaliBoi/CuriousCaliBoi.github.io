```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # An endangered stone with several friendly connections is more
    # likely to represent a substantial group than an isolated stone.
    for p in range(81):
        j=u(2,p)
        W[3][:,j]=0
        B[3][j]=-4
        W[3][u(0,p),j]=5
        for q in adj[p]:
            W[3][u(0,q),j]+=cfg.get("rescue_size",0.4)
        for q in [p]+adj[p]:
            W[3][u(2,q),j]-=10
        W[4][u(4,p),u(4,p)]=-12
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v16.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(rescue=8.0,rescue_size=0.4)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v16.npz",**tensors)
print("Saved v16: prioritize saving connected groups over harvesting isolated enemy stones.")
```