```python
import json
src=open('/work/design_v6.py').read()
src=src.replace("support_dist3=.3125)","support_dist3=.3125, safety_threshold=2.)")
src=src.replace("b(5,D,2-len(adj[q]))","b(5,D,p['safety_threshold']-len(adj[q]))")
open('/work/design_v7.py','w').write(src)
exec(src)
cfg=json.load(open('/work/config_v5.json'))
cfg.update(temperature_scale=3.5,safety_threshold=1.7,safe2=.7,safe3=1.3,
           cap_safety=.85,danger=14.)
config=install(cfg)
json.dump(config,open('/work/config_v7.json','w'),indent=2)
print(config)
```
