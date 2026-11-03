```python
import json,numpy as np
exec(open("/work/analysis_helpers.py").read())
gs=json.load(open("/work/pass_9/games.json")); bs=np.load("/work/pass_9/boards.npy")
for i,g in enumerate(gs):
    if g["end"]!="repetition": continue
    print("\nGAME",i,g["opponent"],g["net_color"],"result",g["result"],"margin",g["margin"])
    print(show(bs[i,len(g["moves"])-2]))
    print(g["moves"][-7:])
```
