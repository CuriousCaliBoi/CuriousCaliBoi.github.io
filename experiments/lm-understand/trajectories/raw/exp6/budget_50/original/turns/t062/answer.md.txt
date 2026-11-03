```python
import json, numpy as np
source=open("/work/policy_design_v23.py").read()
patch=r'''
    # Compress the two material counts into one total, leaving 24
    # auxiliary units for stronger edge self-atari certification.
    for k in range(6):
        W[k][:,486:]=0
        B[k][486:]=0
        if k:
            W[k][486:,:]=0
    OW[486:,:]=0
    for p in range(81):
        W[0][3*p,486]=1
        W[0][3*p+1,486]=1
    W[0][2,487]=1
    for k in range(1,6):
        W[k][486,486]=1
        W[k][487,487]=1
    OW[486,81]=cfg["pass_per_stone"]
    OW[487,81]=cfg["pass_white"]

    edge_points=[]
    for p in range(81):
        r,c=divmod(p,9)
        if r in [0,8] and c in [0,1,2,4,6,7,8]:
            edge_points.append(p)
        elif c in [0,8] and r in [1,2,4,6,7]:
            edge_points.append(p)
    assert len(edge_points)==24
    for i,p in enumerate(edge_points):
        g=488+i
        # Exact singleton captures, rather than approximate group danger.
        for q in adj[p]:
            W[3][u(5,q),g]+=1

        # Multiple threatened contacts can justify a larger capture.
        B[4][g]=-1
        for q in adj[p]:
            W[4][u(3,q),g]+=1

        j=u(3,p)
        W[4][:,j]=0
        B[4][j]=0
        W[4][u(4,p),j]=1
        W[4][g,j]=-2

        W[5][u(3,p),g]=1
        W[5][g,g]=-2
        W[5][u(3,p),u(0,p)]=0
        OW[g,p]=-cfg.get("edge_self_atari",32.0)
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v25.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(repeat_risk=80.0,edge_self_atari=32.0)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v25.npz",**tensors)
print("Saved v25: exact small-capture evidence guards against false edge captures and self-atari cycles.")
```