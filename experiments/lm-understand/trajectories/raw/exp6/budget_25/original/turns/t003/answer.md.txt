```python
import json, numpy as np
g=json.load(open("/work/pass_1/games.json"))
print(type(g))
if isinstance(g,dict):
    print(g.keys())
else:
    print("Games",len(g))
    print(json.dumps(g[0],indent=1)[:10000])
```
