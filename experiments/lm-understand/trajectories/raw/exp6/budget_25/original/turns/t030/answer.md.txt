```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v11.py")
s=open("/work/design_v9.py").read()
marker='# Tengen is a useful universal first move'
idx=s.index(marker)
extra=r'''
# The unused units certify connectivity along complete straight strings.
# A straight occupied segment has no duplicated boundary liberties.
segments=[]
for r in [0,2,4,6,8]:
    segments += [[r*9+c for c in range(5)], [r*9+c for c in range(4,9)]]
for c in [0,2,4,6,8]:
    segments += [[r*9+c for r in range(5)], [r*9+c for r in range(4,9)]]
for r in [1,7]:
    segments.append([r*9+c for c in range(2,7)])
for c in [1,7]:
    segments.append([r*9+c for r in range(2,7)])
assert len(segments)==24

# First layer seeds enemy strings with two distinct liberties.
for j,seg in enumerate(segments):
    u=487+j
    boundary=[q for p in seg for q in adj[p] if q not in seg]
    assert len(boundary)==len(set(boundary))
    B[0][u]=len(boundary)-1-16*len(seg)
    for p in seg:
        W[0][3*p+1,u]+=16
    for q in boundary:
        W[0][3*q,u]-=1
        W[0][3*q+1,u]-=1
    for p in seg:
        W[1][u,unit(4,p)]-=16

# Second layer seeds own strings in the same way.
for j,seg in enumerate(segments):
    u=487+j
    boundary=[q for p in seg for q in adj[p] if q not in seg]
    B[1][u]=len(boundary)-1-16*len(seg)
    for p in seg:
        W[1][unit(0,p),u]+=16
    for q in boundary:
        W[1][unit(0,q),u]-=1
        W[1][unit(1,q),u]-=1
    reach=set(seg)
    for p in seg:
        reach.update(adj[p])
    for p in reach:
        W[2][u,unit(2,p)]-=16

# Further layers broadcast safety across fully connected segments.
for k,color,danger in [(2,1,4),(3,0,2)]:
    for j,seg in enumerate(segments):
        u=487+j
        B[k][u]=-len(seg)
        for p in seg:
            W[k][unit(color,p),u]+=1+1/16
            W[k][unit(danger,p),u]-=1/16
        reach=set(seg)
        for p in seg:
            reach.update(adj[p])
        outdanger=3 if color==1 else 2
        for p in reach:
            W[k+1][u,unit(outdanger,p)]-=32

'''
s=s[:idx]+extra+s[idx:]
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added exact straight-string liberty and connectivity certificates.")
```
