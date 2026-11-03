```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v7.py")
s=open("/work/design_v6.py").read()
s=s.replace('    # Capture and rescue urgency.\n    for q in adj[p]:\n        add(5,unit(0,p),unit(3,q),1)\n        add(5,unit(1,p),unit(2,q),1)',
'''    # Saturated tactical bonuses avoid counting the same string repeatedly.
    B[5][unit(0,p)]=1
    B[5][unit(1,p)]=1
    for q in adj[p]:
        add(5,unit(0,p),unit(3,q),-1)
        add(5,unit(1,p),unit(2,q),-1)''')
s=s.replace('P["capture"], P["rescue"], -P["self_atari"]',
            '-P["capture"], -P["rescue"], -P["self_atari"]')
s=s.replace('OB[p] = -20 + P["positional_scale"]*positional',
            'OB[p] = -20 + P["capture"] + P["rescue"] + P["positional_scale"]*positional')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v3.json"))
overrides.update(self_atari=16.0)
open("/work/params_v8.json","w").write(json.dumps(overrides))
exec(s)
print("Saturated tactical urgency; strongly reject non-capturing self-atari.")
```
