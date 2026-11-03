```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v20.py")
s=open("/work/design_v19.py").read()
# Insert after the ordinary opening gate has been constructed.
idx=s.index('OB[81] = P["pass_bias"]')
extra=r'''
# Stop unnecessary fights only with BOTH a conservative safe-stone
# area lead and two solid eyes witnessed on a symmetric sample.
W[0][2,511]=1
for k in range(1,4):
    W[k][511,511]=1

eye_points=[r*9+c for r in range(0,9,2) for c in range(0,9,2)
            if (r,c)!=(4,4)]
assert len(eye_points)==24
for j,p in enumerate(eye_points):
    u=487+j
    ring=adj[p]+diag[p]
    B[4][u]=1-len(ring)
    for q in ring:
        W[4][unit(0,q),u]+=1
    W[4][unit(0,p),u]-=8
    W[4][unit(1,p),u]-=8

# Two neighbouring thresholds make a clipped, komi-aware lead signal.
W[4][:,486]=0
W[4][:,511]=0
for u,shift in [(511,0),(486,1)]:
    B[4][u]=-46.75-shift
    W[4][511,u]=7.5
    for p in range(81):
        W[4][unit(0,p),u]+=1
        W[4][unit(2,p),u]-=1

# For fewer than two witnessed eyes both gates are zero.
# Otherwise their difference is exactly the clipped lead signal.
for u,source in [(487,511),(488,486)]:
    B[5][u]=-200
    W[5][source,u]=1
    for v in range(487,511):
        W[5][v,u]=100
OW[487,81]+=16
OW[488,81]-=16

# Recompute the empty-board gate directly; its old carry slot was reused.
W[5][:,486]=0
B[5][486]=1
for p in range(81):
    W[5][unit(0,p),486]=-1
    W[5][unit(1,p),486]=-1

'''
s=s[:idx]+extra+s[idx:]
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added a bounded winning-pass gate requiring two solid eyes and an area lead.")
```
