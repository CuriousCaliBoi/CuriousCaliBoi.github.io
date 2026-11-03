```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v10.py")
s=open("/work/design_v9.py").read()
a=s.index('    # Local liberty pressure')
b=s.index('# Fourth layer',a)
s=s[:a]+r'''
    # Long-range safety messages travel only through proven same-colour
    # bridges: a stone and ALL its neighbours must have that colour.
    # Every Manhattan-distance-two endpoint is then connected to it.
    ring2=points(p,DI+JU)
    for color,ach,ch in [(0,2,4),(1,4,5)]:
        dest=unit(ch,p)
        B[2][dest]=-len(adj[p])-1
        add(2,dest,unit(color,p),1)
        for q in adj[p]:
            add(2,dest,unit(color,q),1)
        for q in ring2:
            add(2,dest,unit(color,q),1/16)
            add(2,dest,unit(ach,q),-1/16)

''' + s[b:]
a=s.index('# Fourth layer')
b=s.index('# Sixth layer',a)
s=s[:a]+r'''
# Fourth layer: ordinary propagation plus certified dense bridges.
for p in range(81):
    for ch in (0,1):
        carry(3,ch,p)
    for color,dch,tch in [(0,2,4),(1,3,5)]:
        dest=unit(dch,p)
        add(3,dest,unit(dch,p),1)
        add(3,dest,unit(tch,p),-4096)
        for q in adj[p]:
            add(3,dest,unit(color,q),-1)
            add(3,dest,unit(dch,q),1)
            add(3,dest,unit(tch,q),-4096)
        dest=unit(tch,p)
        B[3][dest]=-len(adj[p])-1
        add(3,dest,unit(color,p),1)
        for q in adj[p]:
            add(3,dest,unit(color,q),1)
        for q in points(p,DI+JU):
            add(3,dest,unit(color,q),1/16)
            add(3,dest,unit(dch,q),-1/16)
            add(3,dest,unit(tch,q),1/16)

# Fifth layer completes long-range propagation and prepares action features.
for p in range(81):
    for ch in (0,1):
        carry(4,ch,p)
    for color,dch,tch in [(0,2,4),(1,3,5)]:
        dest=unit(dch,p)
        add(4,dest,unit(dch,p),1)
        add(4,dest,unit(tch,p),-4096)
        for q in adj[p]:
            add(4,dest,unit(color,q),-1)
            add(4,dest,unit(dch,q),1)
            add(4,dest,unit(tch,q),-4096)

    # Proactive pressure on enemy stones with few local liberties.
    dest=unit(4,p)
    B[4][dest]=-len(adj[p])
    add(4,dest,unit(1,p),3)
    for q in adj[p]:
        add(4,dest,unit(0,q),1)
        add(4,dest,unit(1,q),0.5)

    dest=unit(5,p)
    B[4][dest]=1
    for q in adj[p]:
        add(4,dest,unit(0,q),-1)
        add(4,dest,unit(2,q),1)
        add(4,dest,unit(4,q),-4096)

''' + s[b:]
s=s.replace('    add(5,dest,unit(4,p),1)',
'''    for q in adj[p]:
        add(5,dest,unit(4,q),P["weak_enemy"])''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added certified two-step safety propagation through dense strings.")
```
