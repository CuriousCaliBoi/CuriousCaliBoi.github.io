```python
import json, numpy as np
source=open("/work/policy_design_v7.py").read()
patch=r'''
    # Topological pressure: an empty point between enemy stones that
    # lack diagonal support can separate their groups.
    for p in range(81):
        j=u(5,p)
        W[5][:,j]=0
        B[5][j]=-1
        for q in adj[p]:
            W[5][u(1,q),j]+=1
        for q in diag[p]:
            W[5][u(1,q),j]-=1
        OW[j,p]=cfg.get("cut",1.5)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v11.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(rescue=6.0,connection=1.8,surrounded_penalty=17.0,cut=1.5)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v11.npz",**tensors)
print("Saved v11: stronger own connections and pressure on unsupported enemy cuts.")
```