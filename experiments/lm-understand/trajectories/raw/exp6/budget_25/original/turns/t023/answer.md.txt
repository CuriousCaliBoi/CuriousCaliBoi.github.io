```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v9.py")
s=open("/work/design.py").read()
s=s.replace('    add(5,dest,unit(5,p),-P["low_liberty"])',r'''
    # Extend from healthy strings rather than from stones in trouble.
    for offsets, strength in [(DI,0.3),(JU,0.5),(KN,0.2)]:
        for q in points(p,offsets):
            add(5,dest,unit(0,q),strength)
            add(5,dest,unit(2,q),-strength)
    add(5,dest,unit(5,p),-P["low_liberty"])''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added healthy-string influence for diagonal, one-space, and knight extensions.")
```
