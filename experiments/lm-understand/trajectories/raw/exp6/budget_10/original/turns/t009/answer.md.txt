```python
import json
src=open('/work/design_v2.py').read()
src=src.replace("temperature_scale=1.)","temperature_scale=1., defend=0., first_center=0.)")
src=src.replace("w(1,2,487,1)",
"""w(1,2,487,1)
    b(1,488,1)
    for q in range(81):
        w(1,3*q,488,-1)
        w(1,3*q+1,488,-1)""")
src=src.replace("w(k,486,486,1); w(k,487,487,1)",
                "w(k,486,486,1); w(k,487,487,1); w(k,488,488,1)")
src=src.replace("w(5,486,P,p['opening']*central)",
"""w(5,486,P,p['opening']*central)
        if q==40: w(5,488,P,p['first_center'])""")
src=src.replace("w(5,u(3,t),P,-p['attack'])",
"""w(5,u(3,t),P,-p['attack'])
            w(5,u(4,t),P,p['defend'])
            w(5,u(2,t),P,-p['defend'])""")
open('/work/design_v3.py','w').write(src)
exec(src)
config=install(dict(own_adj=2.,opp_adj=1.5,crowd=3.,temperature_scale=1.5,
                    opening=3.,defend=1.,first_center=20.))
json.dump(config,open('/work/config_v3.json','w'),indent=2)
print(config)
```
