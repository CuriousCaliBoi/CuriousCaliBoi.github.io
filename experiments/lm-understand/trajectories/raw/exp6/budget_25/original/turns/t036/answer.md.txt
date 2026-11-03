```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v14.py")
overrides=json.load(open("/work/params_v9.json"))
overrides["decisiveness"]=2.5
open("/work/params_v15.json","w").write(json.dumps(overrides))
exec(open("/work/design.py").read())
print("Made the certified tactical/shape policy more decisive.")
```
