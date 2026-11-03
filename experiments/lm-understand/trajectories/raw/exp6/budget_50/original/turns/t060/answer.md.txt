```python
import json, collections
g=json.load(open("/work/pass_28/games.json"))
print(collections.Counter((x["opponent"],x["end"],x["result"]) for x in g))
for i,x in enumerate(g):
    if x["end"]=="repetition":
        print(i,x["net_color"],x["result"],x["margin"],x["moves"][-4:])
```