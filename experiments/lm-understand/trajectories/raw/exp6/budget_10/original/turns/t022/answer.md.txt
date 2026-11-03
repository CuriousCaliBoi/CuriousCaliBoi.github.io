```python
import json
src=open('/work/design_v7.py').read()
src=src.replace("safety_threshold=2.)",
                "safety_threshold=2., pass_deficit=0., deficit_cap=16.)")
src=src.replace("""b(1,487,1)
    for q in range(81):
        w(1,3*q,487,-1)
        w(1,3*q+1,487,-1)""","w(1,2,487,1)")
src=src.replace("if q==40: w(5,487,P,p['first_center'])","# Empty-board opening bonus is applied in layer 6.")
src=src.replace("    line=[-1.2",'''    # Reconstruct the empty-board flag after the positional phase signal.
    w(5,486,486,30); b(5,486,-29)
    # A conservative late-game score proxy, used only to discourage
    # resignation-by-passing while apparently behind.
    b(5,487,7.5)
    w(5,487,487,-15)
    for t in range(81):
        w(5,u(1,t),487,1)
        w(5,u(0,t),487,-1)
    w(6,487,487,1)
    w(6,487,488,1); b(6,488,-p['deficit_cap'])
    line=[-1.2''')
src=src.replace("w(6,P,u(5,q),1)",
"""w(6,P,u(5,q),1)
        if q==40: w(6,486,u(5,q),p['first_center'])""")
src=src.replace("a['out.b'][81]=p['pass_bias']",
"""a['out.b'][81]=p['pass_bias']
    a['out.W'][487,81]=-p['pass_deficit']
    a['out.W'][488,81]=p['pass_deficit']""")
open('/work/design_v8.py','w').write(src)
exec(src)
cfg=json.load(open('/work/config_v5.json'))
cfg.update(pass_deficit=.5,deficit_cap=16.)
config=install(cfg)
json.dump(config,open('/work/config_v8.json','w'),indent=2)
print(config)
```
