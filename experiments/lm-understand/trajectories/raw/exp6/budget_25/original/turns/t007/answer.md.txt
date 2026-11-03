```python
exec(open("/work/analysis_helpers.py").read())
games=json.load(open("/work/pass_2/games.json"))
boards=np.load("/work/pass_2/boards.npy")
stats={}
examples=[]
for i,g in enumerate(games):
    col=1 if g["net_color"]=="black" else -1
    for t,m in enumerate(g["moves"]):
        if m["by"]!="net": continue
        b=np.zeros(81,dtype=int) if t==0 else boards[i,t-1]
        gs=groups(b)
        endangered=[(len(st),next(iter(li))) for c,st,li in gs if c==col and len(li)==1]
        caps=[(len(st),next(iter(li))) for c,st,li in gs if c==-col and len(li)==1]
        if endangered and g["opponent"]=="strong":
            moved=m["move"]; biggest=max(endangered)
            if biggest[0]>=4 and moved!=biggest[1]:
                after=groups(boards[i,t])
                still=[(len(st),list(li)) for c,st,li in after if c==col and len(li)==1 and biggest[1] in li]
                if still: examples.append((biggest[0],i,t,biggest,m["move"],m["top5"]))
print("Missed large ataris",len(examples))
for size,i,t,big,move,top in sorted(examples,reverse=True)[:10]:
    g=games[i]
    print("\nGame",i,g["net_color"],g["result"],"ply",t,"atari",big,"move",move,"top",top)
    print(show(boards[i,t-1]))
    print("groups",[(c,len(st),sorted(li)) for c,st,li in groups(boards[i,t-1]) if len(li)<=2])
print("\nLoss endings:")
from collections import Counter
print(Counter((g["opponent"],g["end"]) for g in games if g["result"]<0))
```
