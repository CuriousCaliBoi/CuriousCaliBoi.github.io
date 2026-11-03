```python
import json, numpy as np, collections
games=json.load(open("/work/pass_1/games.json"))
boards=np.load("/work/pass_1/boards.npy")
N=[[] for _ in range(81)]
for p in range(81):
    r,c=divmod(p,9)
    N[p]=[rr*9+cc for rr,cc in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)]
          if 0<=rr<9 and 0<=cc<9]
def groups(b):
    seen=set(); out=[]
    for p in range(81):
        if not b[p] or p in seen: continue
        stones={p}; stack=[p]; seen.add(p); libs=set()
        while stack:
            q=stack.pop()
            for z in N[q]:
                if b[z]==0: libs.add(z)
                elif b[z]==b[p] and z not in seen:
                    seen.add(z); stones.add(z); stack.append(z)
        out.append((int(b[p]),stones,libs))
    return out
def show(b):
    print("\n".join("".join(".XO"[{0:0,1:1,-1:2}[int(x)]] for x in row)
                    for row in b.reshape(9,9)))
stats=collections.Counter()
examples=[]
for gi,g in enumerate(games):
    if g["opponent"]!="strong": continue
    me=1 if g["net_color"]=="black" else -1
    for t,m in enumerate(g["moves"]):
        before=boards[gi,t-1] if t else np.zeros(81,dtype=np.int8)
        after=boards[gi,t]
        if m["by"]=="net":
            caps=collections.Counter()
            for col,st,libs in groups(before):
                if col==-me and len(libs)==1:
                    caps[next(iter(libs))]+=len(st)
            if caps:
                stats["capture_available"]+=1
                if m["move"] in caps: stats["capture_taken"]+=1
                elif not any(a in caps for a,p in m["top5"]):
                    stats["capture_absent_top5"]+=1
        else:
            lost=int(np.sum((before==me)&(after!=me)))
            if lost>=3:
                stats["loss_events_3plus"]+=1
                prev=g["moves"][t-1] if t else None
                preprev=boards[gi,t-2] if t>=2 else np.zeros(81,dtype=np.int8)
                threatened=[(len(st),sorted(libs)) for col,st,libs in groups(preprev)
                            if col==me and len(libs)==1]
                examples.append((lost,gi,t,prev,threatened,preprev.copy()))
print(dict(stats))
for lost,gi,t,prev,threatened,b in sorted(examples,reverse=True,key=lambda x:x[0])[:8]:
    print("\nCAPTURED",lost,"game",gi,"ply",t,"our previous move",prev,
          "prior own ataris",threatened)
    show(b)
```