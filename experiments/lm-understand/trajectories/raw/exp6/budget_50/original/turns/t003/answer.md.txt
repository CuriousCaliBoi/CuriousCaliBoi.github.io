```python
import os, json, numpy as np
path = "/work/pass_1"
games = json.load(open(path+"/games.json"))
print(type(games), len(games))
if isinstance(games, dict):
    print(games.keys())
else:
    print(json.dumps(games[0], indent=2)[:6500])
boards = np.load(path+"/boards.npy")
valid = np.load(path+"/valid.npy")
print("board shapes", boards.shape, valid.shape)
print("files", os.listdir(path))
if isinstance(games, list):
    for i,g in enumerate(games):
        if g.get("opponent") == "strong" and g.get("result") == -1:
            print("LOSS",i,{k:v for k,v in g.items() if k!="moves"})
            b = boards[i, np.flatnonzero(valid[i])[-1]].reshape(9,9)
            print("\n".join("".join({0:".",1:"X",-1:"O"}[int(x)] for x in row) for row in b))
            if i > 45:
                break
```