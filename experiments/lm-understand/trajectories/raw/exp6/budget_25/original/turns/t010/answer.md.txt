```python
import shutil, json
shutil.copyfile("/work/design.py","/work/design_v3.py")
s=open("/work/design.py").read()
s=s.replace('low_liberty=1.5,','low_liberty=1.5, weak_friend=1.0, weak_enemy=2.0,')
a=s.index('    dest = unit(4,p)',s.index('# Safety propagates'))
b=s.index('# Fourth layer',a)
s=s[:a]+r'''
    # Local liberty pressure, reduced for already connected stones.
    for color,ch in [(0,4),(1,5)]:
        dest=unit(ch,p)
        add(2,dest,unit(color,p),3)
        B[2][dest]=-len(adj[p])
        for q in adj[p]:
            add(2,dest,unit(0,q),1)
            add(2,dest,unit(1,q),1)
            add(2,dest,unit(color,q),-0.5)

''' + s[b:]
a=s.index('    add(3,unit(4,p),unit(4,p),1)')
b=s.index('    # Prefer moves with room',a)
s=s[:a]+r'''
    # Urgency to support pressured stones and reduce enemy liberties.
    for q in adj[p]:
        add(3,unit(4,p),unit(4,q),P["weak_friend"])
        add(3,unit(4,p),unit(5,q),P["weak_enemy"])
''' + s[b:]
s=s.replace('    add(5,unit(3,p),unit(4,p),1)',r'''
    dest=unit(3,p)
    B[5][dest]=1-len(adj[p])
    for q in adj[p]:
        add(5,dest,unit(0,q),1)
    for q in diag[p]:
        add(5,dest,unit(1,q),-0.5 if len(adj[p])==4 else -1)
''')
s=s.replace('add(5,dest,unit(5,p),-P["low_liberty"])',
'''add(5,dest,unit(5,p),-P["low_liberty"])
    add(5,dest,unit(4,p),1)''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v3.json"))
exec(s)
print("Added proactive local-liberty pressure and support.")
print(P)
```
