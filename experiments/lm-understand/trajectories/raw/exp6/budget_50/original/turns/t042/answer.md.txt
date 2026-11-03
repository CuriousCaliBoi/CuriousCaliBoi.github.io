```python
import json, numpy as np
source=open("/work/policy_design_v16.py").read()
patch=r'''
    # Pack colour one layer earlier, freeing a channel for short-range
    # weakness. Capture certainty still uses the longer safety field.
    for p in range(81):
        j=u(0,p)
        W[2][:,j]=0
        B[2][j]=0.5
        W[2][u(0,p),j]=0.5
        W[2][u(1,p),j]=-0.5

        j=u(1,p)
        W[2][:,j]=0
        B[2][j]=0
        W[2][u(3,p),j]=1

        j=u(0,p)
        W[3][:,j]=0
        B[3][j]=0
        W[3][u(0,p),j]=1

        j=u(1,p)
        W[3][:,j]=0
        B[3][j]=3
        W[3][u(0,p),j]=-20
        W[3][u(1,p),j]=-1
        for q in adj[p]:
            W[3][u(1,q),j]-=0.5

        j=u(2,p)
        W[3][:,j]=0
        size=cfg.get("rescue_size",0.4)
        B[3][j]=1-0.5*size-20
        W[3][u(0,p),j]=20
        for q in adj[p]:
            W[3][u(0,q),j]+=size
        for q in [p]+adj[p]:
            W[3][u(2,q),j]-=10

        j=u(3,p)
        W[3][:,j]=0
        B[3][j]=1
        W[3][u(0,p),j]=-20
        for q in [p]+adj[p]:
            W[3][u(3,q),j]-=1

        j=u(5,p)
        W[3][:,j]=0
        B[3][j]=0
        for q in adj[p]:
            W[3][u(5,q),j]+=2
            W[3][u(0,q),j]-=2
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v18.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v18.npz",**tensors)
print("Saved v18: separate short-range attack pressure from longer-range capture certification.")
```