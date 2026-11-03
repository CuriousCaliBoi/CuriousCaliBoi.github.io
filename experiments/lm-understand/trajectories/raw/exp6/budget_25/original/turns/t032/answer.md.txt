```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v12.py")
s=open("/work/design.py").read()
idx=s.index('# Tengen is a useful universal first move')
extra=r'''
# Corner/edge snapback and cyclic-capture guard.
# A singleton capture is dangerous if the resulting string has no
# other empty neighbour and no connection to a healthy friendly string.
corner_points=set()
for r0,c0,dr,dc in [(0,0,1,1),(0,8,1,-1),(8,0,-1,1),(8,8,-1,-1)]:
    for a,b in [(0,0),(1,0),(0,1),(1,1),(2,0),(0,2)]:
        corner_points.add((r0+dr*a)*9+c0+dc*b)
corner_points=sorted(corner_points)
assert len(corner_points)==24
slot={p:487+j for j,p in enumerate(corner_points)}
for p,u in slot.items():
    W[4][unit(3,p),u]=1
    for q in adj[p]:
        W[4][unit(1,q),u]-=1

for p,u in slot.items():
    B[5][u]=-4-4*len(adj[p])
    W[5][unit(5,p),u]+=4
    for q in adj[p]:
        W[5][unit(0,q),u]+=4
        W[5][unit(1,q),u]+=4
        W[5][unit(3,q),u]-=2
        if q in slot:
            W[5][slot[q],u]+=3
    OW[u,p]-=14

'''
s=s[:idx]+extra+s[idx:]
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added local snapback/cyclic-capture guards in all four corners.")
```
