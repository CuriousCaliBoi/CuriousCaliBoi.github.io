```python
import json, numpy as np
source=open("/work/policy_design_v5.py").read()
source=source.replace(
    "    # Layer 4: approximate whole-group atari, self-atari, weak enemies.",
    '''    # Exact one-stone capture detector in a previously unused channel.
    for p in range(81):
        j=u(5,p)
        W[2][:,j]=0
        B[2][j]=-len(adj[p])
        W[2][u(1,p),j]=2
        for q in adj[p]:
            W[2][u(0,q),j]+=1
            W[2][u(1,q),j]-=1

    # Layer 4: approximate whole-group atari, self-atari, weak enemies.''')
patch=r'''
    # At layer 4, encode own/empty/enemy as 1, 1/2, 0. This frees
    # a full channel for repetition-risk detection without losing attack.
    for p in range(81):
        old_weak=W[3][:,u(5,p)].copy()
        old_bias=B[3][u(5,p)]
        W[3][:,u(1,p)]=old_weak
        B[3][u(1,p)]=old_bias
        W[3][:,u(0,p)]=0
        B[3][u(0,p)]=0.5
        W[3][u(0,p),u(0,p)]=0.5
        W[3][u(1,p),u(0,p)]=-0.5

        j=u(5,p)
        W[3][:,j]=0
        B[3][j]=-len(adj[p])
        for q in adj[p]:
            W[3][u(5,q),j]+=2
            W[3][u(0,q),j]-=3
            W[3][u(1,q),j]+=1

        # Decode the board for the final shape layer.
        for ch,sign,bias in [(0,2,-1),(1,-2,1)]:
            j=u(ch,p)
            W[4][:,j]=0
            B[4][j]=bias
            W[4][u(0,p),j]=sign

        # Tactical score only here; move the spatial prior to layer 6.
        j=u(2,p)
        W[4][:,j]=0
        B[4][j]=100
        for q in adj[p]:
            W[4][u(3,q),j]+=cfg["capture"]
            W[4][u(1,q),j]+=cfg["attack"]
        W[4][u(5,p),j]-=cfg.get("repeat_risk",18.0)

        j=u(5,p)
        W[4][:,j]=0
        B[4][j]=1-2*len(adj[p])
        for q in adj[p]:
            W[4][u(0,q),j]=2

        j=u(0,p)
        r,c=divmod(p,9)
        B[5][j]=line_prior[min(r,8-r)]+line_prior[min(c,8-c)]
        for q,dr,dc in rings[p]:
            if dr+dc==1:
                a,b=cfg["own_adj"],cfg["enemy_adj"]
            elif dr==dc==1:
                a,b=cfg["own_diag"],cfg["enemy_diag"]
            elif dr+dc==2:
                a,b=cfg["own_two"],cfg["enemy_two"]
            elif sorted([dr,dc])==[1,2]:
                a,b=cfg["own_knight"],0.0
            else:
                continue
            W[5][u(0,q),j]+=a
            W[5][u(1,q),j]+=b
'''
source=source.replace('    OW *= cfg["temperature_scale"]',
                      patch+'\n    OW *= cfg["temperature_scale"]')
open("/work/policy_design_v7.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
cfg.update(capture=9.0,repeat_risk=18.0)
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v7.npz",**tensors)
print("Saved v7: packed colour channel preserves weak-group attacks while avoiding ko/snapback traps.")
```