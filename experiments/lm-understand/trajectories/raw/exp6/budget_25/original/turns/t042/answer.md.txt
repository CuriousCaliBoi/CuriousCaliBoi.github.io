```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v17.py")
s=open("/work/design_v14.py").read()
a=s.index('    # Local liberty pressure')
b=s.index('# Fourth layer',a)
s=s[:a]+r'''
    # Shared friendly/enemy contact supports blocking, hane and connection.
    # min(own-contact, enemy-contact) is reconstructed in the next layer.
    dest=unit(4,p)
    for q in adj[p]:
        add(2,dest,unit(0,q),1)
        add(2,dest,unit(1,q),-1)
    dest=unit(5,p)
    add(2,dest,unit(1,p),3)
    B[2][dest]=-len(adj[p])
    for q in adj[p]:
        add(2,dest,unit(0,q),1)
        add(2,dest,unit(1,q),0.5)

''' + s[b:]
a=s.index('    # Urgency to support')
b=s.index('    # Binary access',a)
s=s[:a]+r'''
    B[3][unit(4,p)]=20
    add(3,unit(4,p),unit(4,p),-1.5)
    for q in adj[p]:
        add(3,unit(4,p),unit(0,q),1.5)
        add(3,unit(4,p),unit(5,q),P["weak_enemy"])

''' + s[b:]
s=s.replace('    B[5][dest] = 20','    B[5][dest] = 0')
# The carried pressure/contact channel already contains the +20 offset.
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added explicit mixed-contact blocking/hane/connection preference.")
```
