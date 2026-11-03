```python
import json, shutil, numpy as np
shutil.copyfile("/work/design.py","/work/design_v22.py")
final_source=open("/work/design_v19.py").read()
open("/work/design.py","w").write(final_source)
open("/work/final_design.py","w").write(final_source)
overrides=json.load(open("/work/params_v9.json"))
open("/work/final_parameters.json","w").write(json.dumps(overrides,indent=2))
exec(final_source)

# Audit tensors only; no policy evaluation is performed here.
total=0
for name in saved():
    a=load(name)
    assert np.isfinite(a).all(), name
    total+=a.size
    print(name, a.shape, "nonzero", np.count_nonzero(a),
          "max_abs", float(np.max(np.abs(a))))
assert total==1480274
print("Final network restored and saved; all 1,480,274 parameters are finite.")
```
