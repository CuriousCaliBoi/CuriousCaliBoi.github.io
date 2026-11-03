```python
import json
src=open('/work/design_v3.py').read()
src=src.replace("first_center=0.)","first_center=0., triangle=0.)")
# White was unused. Reuse its global slot for the empty-board indicator,
# leaving 24 final-layer-4 units for symmetric central shape features.
src=src.replace("w(1,2,487,1)\n    b(1,488,1)","b(1,487,1)")
src=src.replace("w(1,3*q,488,-1)","w(1,3*q,487,-1)")
src=src.replace("w(1,3*q+1,488,-1)","w(1,3*q+1,487,-1)")
src=src.replace("; w(k,488,488,1)","")
src=src.replace("w(5,488,P,p['first_center'])","w(5,487,P,p['first_center'])")
src=src.replace("    line=[-1.2",'''    central_points=[q for q,(r,c) in enumerate(xy) if 2<=r<=6 and 2<=c<=6 and q!=40]
    shape_units={q:488+i for i,q in enumerate(central_points)}
    for q,j in shape_units.items():
        r,c=xy[q]
        b(4,j,-2)
        for t in adj[q]: w(4,u(0,t),j,1)
        for dr,dc in [(-1,-1),(-1,1),(1,-1),(1,1)]:
            w(4,u(0,(r+dr)*9+c+dc),j,1)
    line=[-1.2''')
src=src.replace("central=max(0.",'''if q in shape_units: w(5,shape_units[q],P,-p['triangle'])
        central=max(0.''')
open('/work/design_v4.py','w').write(src)
exec(src)
config=install(dict(own_adj=2.,opp_adj=1.5,crowd=3.,temperature_scale=2.5,
                    opening=3.,defend=1.,first_center=20.,triangle=1.5))
json.dump(config,open('/work/config_v4.json','w'),indent=2)
print(config)
```
