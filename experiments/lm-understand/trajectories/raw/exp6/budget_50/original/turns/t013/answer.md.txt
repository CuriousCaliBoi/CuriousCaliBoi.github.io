```python
import json, numpy as np
source=open("/work/policy_design_v2.py").read()
source=source.replace(
    "    # Global counts and colour are carried separately.",
    '''    # A zero-liberty indicator lets the next layer distinguish a
    # duplicated single liberty around a bent chain from independent ones.
    for p in range(81):
        for colour in range(2):
            j=u(4+colour,p)
            W[0][:,j]=0
            B[0][j]=-len(adj[p])
            W[0][3*p+colour,j]=1
            for q in adj[p]:
                W[0][3*q,j]+=1
                W[0][3*q+1,j]+=1

    # Global counts and colour are carried separately.''')
source=source.replace(
    '            W[1][u(4+colour,p),u(4+colour,p)] = 1',
    '''            W[1][u(4+colour,p),j] -= 1

            # Independent supplementary safety certificate. A shared
            # liberty of two neighbours must lie diagonally from p.
            j=u(4+colour,p)
            B[1][j]=-21-len(diag[p])
            W[1][u(colour,p),j]=20
            for q in [p]+adj[p]:
                W[1][u(2+colour,q),j]+=1
            for q in diag[p]:
                W[1][u(0,q),j]+=1
                W[1][u(1,q),j]+=1''')
source=source.replace(
    '                W[2][u(2+colour,q),j] += 1',
    '''                W[2][u(2+colour,q),j] += 1
                W[2][u(4+colour,q),j] += 1''')
open("/work/policy_design_v5.py","w").write(source)
open("/work/policy_design.py","w").write(source)
cfg=json.load(open("/work/policy_config.json"))
ns={}
exec(compile(source,"/work/policy_design.py","exec"),ns)
cfg,tensors=ns["build"](save,cfg)
json.dump(cfg,open("/work/policy_config.json","w"),indent=2)
np.savez("/work/policy_v5.npz",**tensors)
print("Saved v5: safety certificates that do not mistake duplicated liberties for two eyes.")
```