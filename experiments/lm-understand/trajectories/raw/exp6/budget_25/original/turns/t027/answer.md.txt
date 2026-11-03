```python
import json,numpy as np
exec(open("/work/analysis_helpers.py").read())
gs=json.load(open("/work/pass_9/games.json")); bs=np.load("/work/pass_9/boards.npy")
g=gs[54]; i=54
for t in range(89,len(g["moves"])):
    print("\n",g["moves"][t])
    print(show(bs[i,t]))
```
