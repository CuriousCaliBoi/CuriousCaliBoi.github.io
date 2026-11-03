```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v16.py")
s=open("/work/design.py").read()
idx=s.index('# Tengen is a useful universal first move')
extra=r'''
# Conservative endgame stopping: count only stones certified to have
# at least two liberties. Ignore all prospective territory and captures.
# If those stones alone beat every other point plus komi, avoid needless
# invasions and positional-repetition fights.
W[0][2,511]=1
for k in range(1,6):
    W[k][511,511]=1
for u,shift in [(487,0),(488,1)]:
    B[5][u]=-46.75-shift
    W[5][511,u]=7.5
    for p in range(81):
        W[5][unit(0,p),u]+=1
        W[5][unit(2,p),u]-=1
OW[487,81]+=16
OW[488,81]-=16

'''
s=s[:idx]+extra+s[idx:]
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Added a conservative safe-stone, komi-aware winning-pass gate.")
```
