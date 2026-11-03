```python
import json, numpy as np, collections
g=json.load(open("/work/pass_9/games.json"))
b=np.load("/work/pass_9/boards.npy")
print("Loss breakdown",dict(collections.Counter((x["net_color"],x["end"]) for x in g
                                             if x["opponent"]=="strong" and x["result"]<0)))
for i,x in enumerate(g):
    if x["opponent"]!="strong" or x["result"]>0 or x["net_color"]!="black":
        continue
    print("\nGAME",i,"margin",x["margin"],"lost",x["stones_lost_by_net"],
          "captured",x["stones_captured_by_net"],"end",x["end"])
    for t in [19,39,59,len(x["moves"])-1]:
        if t>=len(x["moves"]): continue
        print("after",t+1)
        bb=b[i,t].reshape(9,9)
        print("\n".join("".join({0:".",1:"X",-1:"O"}[int(z)] for z in row) for row in bb))
    print("last net moves",[m for m in x["moves"][-10:] if m["by"]=="net"])
    if i>=10: break
```