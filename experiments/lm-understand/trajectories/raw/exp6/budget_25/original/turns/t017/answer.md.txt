```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v6.py")
s=open("/work/design.py").read()
s=s.replace('decisiveness=1.6,','decisiveness=1.6, group_pressure=1.0,')
s=s.replace('        add(2,dest,unit(color,p),3)\n        B[2][dest]=-len(adj[p])',
'''        add(2,dest,unit(color,p),7)
        B[2][dest]=-len(adj[p])-4''')
s=s.replace('            add(2,dest,unit(color,q),-0.5)',
'''            add(2,dest,unit(color,q),-0.5)
            add(2,dest,unit(2 if color==0 else 4,q),P["group_pressure"])''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v3.json"))
overrides.update(weak_friend=2.0,weak_enemy=2.5)
open("/work/params_v7.json","w").write(json.dumps(overrides))
exec(s)
print("Pressure features now account for vulnerable connected neighbours.")
print(P)
```
