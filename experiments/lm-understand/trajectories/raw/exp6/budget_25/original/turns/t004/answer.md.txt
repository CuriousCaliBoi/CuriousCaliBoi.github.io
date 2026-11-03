```python
import json, numpy as np
games=json.load(open("/work/pass_1/games.json"))
boards=np.load("/work/pass_1/boards.npy")
AD=[[(r+dr)*9+c+dc for dr,dc in [(1,0),(-1,0),(0,1),(0,-1)]
     if 0<=r+dr<9 and 0<=c+dc<9] for r in range(9) for c in range(9)]
def groups(b):
    seen=set(); out=[]
    for p in range(81):
        if not b[p] or p in seen: continue
        col=int(b[p]); stack=[p]; stones=set([p]); libs=set(); seen.add(p)
        while stack:
            u=stack.pop()
            for v in AD[u]:
                if b[v]==0: libs.add(v)
                elif b[v]==col and v not in seen:
                    seen.add(v); stones.add(v); stack.append(v)
        out.append((col,stones,libs))
    return out
def show(b):
    return "\n".join("".join(".XO"[{0:0,1:1,-1:2}[int(v)]] for v in b[r*9:(r+1)*9]) for r in range(9))
open("/work/analysis_helpers.py","w").write('import numpy as np\nAD='+repr(AD)+'\n'+
    '''def groups(b):
    seen=set(); out=[]
    for p in range(81):
        if not b[p] or p in seen: continue
        col=int(b[p]); stack=[p]; stones={p}; libs=set(); seen.add(p)
        while stack:
            u=stack.pop()
            for v in AD[u]:
                if b[v]==0: libs.add(v)
                elif b[v]==col and v not in seen:
                    seen.add(v); stones.add(v); stack.append(v)
        out.append((col,stones,libs))
    return out
def show(b):
    return "\\n".join("".join({0:".",1:"X",-1:"O"}[int(v)] for v in b[r*9:(r+1)*9]) for r in range(9))
''')
losses=[(i,g) for i,g in enumerate(games) if g["opponent"]=="strong" and g["result"]<0]
for i,g in losses[:5]:
    print("\nGAME",i,"net",g["net_color"],"margin",g["margin"],"end",g["end"])
    col=1 if g["net_color"]=="black" else -1
    events=[]
    for t,m in enumerate(g["moves"]):
        if t==0 or m["by"]!="opponent": continue
        lost=int(np.sum(boards[i,t-1]==col)-np.sum(boards[i,t]==col))
        if lost>=4:
            events.append((lost,t))
    for lost,t in sorted(events,reverse=True)[:2]:
        print("LOST",lost,"at",t,"opponent move",g["moves"][t]["move"])
        s=max(0,t-3)
        print("Board before own move",s+1,"\n"+show(boards[i,s]))
        print("Sequence",g["moves"][s+1:t+1])
        print("Own groups then",[(len(st),sorted(li)) for c,st,li in groups(boards[i,s]) if c==col])
```
