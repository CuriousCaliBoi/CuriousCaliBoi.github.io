```python
import json, collections, numpy as np
for k in [14,15,16,18,19,20,21,22]:
    gs=json.load(open("/work/pass_%d/games.json"%k))
    gs=[g for g in gs if g["opponent"]=="strong"]
    print("pass",k)
    for col in ["black","white"]:
        a=[g for g in gs if g["net_color"]==col]
        first=collections.Counter(next(m["move"] for m in g["moves"] if m["by"]=="opponent") for g in a)
        margins=[g["margin"] for g in a if g["result"]<0]
        print(col,"opponent first",first.most_common(6),"loss margins",margins)
```