```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v5.py")
s=open("/work/design.py").read()
marker='OB[81] = P["pass_bias"]'
s=s.replace(marker,r'''
# Tengen is a useful universal first move on the small board.
# This gate is active only on the completely empty board.
B[0][486]=1
for p in range(81):
    W[0][3*p,486]=-1
    W[0][3*p+1,486]=-1
for k in range(1,6):
    W[k][486,486]=1
OW[486,40]=8

''' + marker)
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v3.json"))
exec(s)
print("Added an empty-board-only tengen opening gate.")
```
