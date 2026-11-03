```python
import json
src=open('/work/design_v5.py').read()
src=src.replace("capture_guard=0.)",
                "capture_guard=0., support_adj=1.25, support_dist2=.75, support_dist3=.3125)")
src=src.replace("w(5,u(0,t),I,-1.25*iw)",
"""support={1:p['support_adj'],2:p['support_dist2'],3:p['support_dist3']}.get(d,0.)
                w(5,u(0,t),I,-support)""")
open('/work/design_v6.py','w').write(src)
exec(src)
cfg=json.load(open('/work/config_v5.json'))
cfg.update(support_adj=2.5,support_dist2=.35,support_dist3=.1,isolation_threshold=1.8)
config=install(cfg)
json.dump(config,open('/work/config_v6.json','w'),indent=2)
print(config)
```
