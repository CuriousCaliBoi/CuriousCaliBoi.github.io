```python
import json, numpy as np, collections
for k in [1,3,4,5,6]:
    gs=json.load(open("/work/pass_%d/games.json"%k))
    print("\nPASS",k)
    for op in sorted(set(g["opponent"] for g in gs)):
        a=[g for g in gs if g["opponent"]==op]
        print(op,dict(collections.Counter((g["end"],g["result"]) for g in a)),
              "loss margins",[g["margin"] for g in a if g["result"]<0])
gs=json.load(open("/work/pass_6/games.json"))
bs=np.load("/work/pass_6/boards.npy")
for i,g in enumerate(gs):
    if g["end"]=="repetition" and g["result"]<0:
        print("\nREPETITION",i,"colour",g["net_color"],"margin",g["margin"])
        print(json.dumps(g["moves"][-16:]))
        t=len(g["moves"])-1
        b=bs[i,t-1]
        print("\n".join("".join({0:".",1:"X",-1:"O"}[int(v)] for v in row)
                        for row in b.reshape(9,9)))
        if i>40: break
```