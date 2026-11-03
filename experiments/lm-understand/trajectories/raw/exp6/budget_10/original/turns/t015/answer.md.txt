```python
import json
src=open('/work/design_v4.py').read()
src=src.replace("triangle=0.)","triangle=0., capture_guard=0.)")
src=src.replace("w(5,u(3,t),D,-p['cap_safety'])","# Captures are accounted for after their reliability gate, in layer 6.")
src=src.replace("if wm: w(5,u(0,t),P,wm)",
"""guard_weight={1:1.,2:1.,3:.5}.get(d,0.)*p['capture_guard']
            if guard_weight:
                w(5,u(1,t),C,-guard_weight)
                w(5,u(3,t),C,guard_weight)
            if wm: w(5,u(0,t),P,wm)""")
src=src.replace("w(6,D,u(3,q),1)",
                "w(6,D,u(3,q),1); w(6,C,u(3,q),-p['cap_safety'])")
open('/work/design_v5.py','w').write(src)
exec(src)
cfg=json.load(open('/work/config_v4.json'))
cfg['capture_guard']=.2
config=install(cfg)
json.dump(config,open('/work/config_v5.json','w'),indent=2)
print(config)
```
