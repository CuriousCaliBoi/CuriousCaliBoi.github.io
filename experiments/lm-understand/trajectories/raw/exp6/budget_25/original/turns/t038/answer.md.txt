```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v15.py")
s=open("/work/design_v14.py").read()
s=s.replace('        add(2,dest,unit(color,p),3)\n        B[2][dest]=-len(adj[p])',
'''        add(2,dest,unit(color,p),7)
        B[2][dest]=-len(adj[p])-4''')
s=s.replace('            add(2,dest,unit(color,q),-0.5)',
'''            add(2,dest,unit(color,q),-0.5)
            # Only healthy neighbours reduce a stone's local urgency.
            add(2,dest,unit(2 if color==0 else 4,q),0.5)''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Local urgency now discounts healthy support, not endangered string-mates.")
```
