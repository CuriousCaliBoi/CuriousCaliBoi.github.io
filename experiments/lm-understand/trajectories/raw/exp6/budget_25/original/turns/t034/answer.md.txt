```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v13.py")
s=open("/work/design_v12.py").read()
s=s.replace('for k,color,danger in [(2,1,4),(3,0,2)]:',
            'for k,color,danger in [(2,1,4),(3,1,3)]:')
needle='        reach=set(seg)\n        for p in seg:\n            reach.update(adj[p])\n        outdanger=3 if color==1 else 2'
replacement='''        if k==3:
            # Intersecting certified segments belong to the same string.
            for jj,other in enumerate(segments):
                if set(seg).intersection(other):
                    W[k][487+jj,u]+=1/128
        reach=set(seg)
        for p in seg:
            reach.update(adj[p])
        outdanger=3 if color==1 else 2'''
assert needle in s
s=s.replace(needle,replacement)
# A message can now be as small as (1/16)/128.
s=s.replace('W[k+1][u,unit(outdanger,p)]-=32',
            'W[k+1][u,unit(outdanger,p)]-=4096')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Extended enemy-string safety through intersecting certified segments.")
```
