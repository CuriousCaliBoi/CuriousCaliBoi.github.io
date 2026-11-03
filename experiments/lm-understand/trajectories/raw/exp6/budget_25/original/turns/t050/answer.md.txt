```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v21.py")
s=open("/work/design_v19.py").read()
idx=s.index('OB[81] = P["pass_bias"]')
extra=r'''
# Two witnessed solid enemy eyes warn against treating a large living
# string as capturable merely because its liberties are far apart.
eye_points=[r*9+c for r in range(0,9,2) for c in range(0,9,2)]
for j,p in enumerate(eye_points):
    u=487+j
    ring=adj[p]+diag[p]
    B[4][u]=1-len(ring)
    for q in ring:
        W[4][unit(1,q),u]+=1
    W[4][unit(0,p),u]-=8
    W[4][unit(1,p),u]-=8

B[5][487]=1
for v in range(487,512):
    W[5][v,487]=-1
for p in range(81):
    # Positive capture evidence, disabled when two solid eyes are seen.
    u=unit(0,p)
    W[5][:,u]=0
    B[5][u]=4
    for q in adj[p]:
        W[5][unit(3,q),u]+=1
    for v in range(487,512):
        W[5][v,u]-=4
    OW[u,p]=P["capture"]
    OW[487,p]-=4*P["capture"]
    OB[p]-=P["capture"]

'''
s=s[:idx]+extra+s[idx:]
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added a two-solid-enemy-eyes safeguard against false capture urgency.")
```
