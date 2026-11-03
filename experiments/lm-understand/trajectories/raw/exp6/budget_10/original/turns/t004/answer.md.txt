```python
import json, numpy as np
g=json.load(open('/work/pass_1/games.json'))
print(type(g))
print(str(g[0])[:2500])
for i,x in enumerate(g):
    if x['opponent']=='strong':
        print(i,{k:v for k,v in x.items() if k!='moves'})
```
