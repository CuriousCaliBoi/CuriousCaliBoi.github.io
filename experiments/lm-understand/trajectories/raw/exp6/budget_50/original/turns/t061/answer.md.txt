```python
import json, numpy as np
g=json.load(open("/work/pass_28/games.json"))
b=np.load("/work/pass_28/boards.npy")
for i in [44,84]:
    x=g[i]; t=len(x["moves"])-1
    print("\nGAME",i,"colour",x["net_color"],"last moves",x["moves"][-10:])
    for j in range(t-4,t+1):
        print("ply",j,"action",x["moves"][j]["move"])
        print("\n".join("".join({0:".",1:"X",-1:"O"}[int(z)] for z in row)
                        for row in b[i,j].reshape(9,9)))
```