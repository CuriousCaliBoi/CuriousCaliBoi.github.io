```python
import json
src=open('/work/design.py').read()
src=src.replace("safe2=1., safe3=1., cap_safety=1.)",
                "safe2=1., safe3=1., cap_safety=1., crowd=0., temperature_scale=1.)")
src=src.replace("b(5,E,1-len(adj[q]))","b(5,E,2-len(adj[q]))")
src=src.replace("""w(6,E,u(4,q),p['eye'])
        w(6,I,u(4,q),p['isolation'])
        w(6,P,u(5,q),1)""",
"""w(6,E,u(4,q),1); b(6,u(4,q),-1)
        w(6,P,u(5,q),1)
        b(6,u(5,q),100)
        w(6,E,u(5,q),-p['crowd'])
        w(6,I,u(5,q),-p['isolation'])""")
src=src.replace("p['save'],-p['danger'],-1.,1.]",
                "p['save'],-p['danger'],-(p['eye']-2*p['crowd']),1.]")
src=src.replace("a['out.b'][q]=-40.","a['out.b'][q]=-140.")
src=src.replace("return a,p","a['out.W'] *= p['temperature_scale']\n    a['out.b'] *= p['temperature_scale']\n    return a,p")
open('/work/design_v2.py','w').write(src)
exec(src)
config=install(dict(own_adj=2.,opp_adj=.6,crowd=3.,temperature_scale=1.5,opening=3.))
json.dump(config,open('/work/config_v2.json','w'),indent=2)
print(config)
```
