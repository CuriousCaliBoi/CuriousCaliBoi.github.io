```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v4.py")
s=open("/work/design.py").read()
s=s.replace('weak_friend=1.0, weak_enemy=2.0,','weak_friend=1.0, weak_enemy=2.0, decisiveness=1.6,')
s=s.replace('for k in range(6):\n    save(', 'OW *= P["decisiveness"]\nOB *= P["decisiveness"]\n\nfor k in range(6):\n    save(')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v3.json"))
exec(s)
print("Increased policy decisiveness, with unchanged move ranking.")
```
