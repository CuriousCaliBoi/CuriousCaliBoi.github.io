```python
exec(open("/work/analysis_helpers.py").read())
games=json.load(open("/work/pass_5/games.json"))
boards=np.load("/work/pass_5/boards.npy")
for color in ["black","white"]:
    gg=[g for g in games if g["opponent"]=="strong" and g["net_color"]==color]
    print(color, "margins", sorted(g["margin"] for g in gg))
for i,g in [(i,g) for i,g in enumerate(games) if g["opponent"]=="strong" and g["net_color"]=="black" and g["result"]<0][:5]:
    print("\nGAME",i,"margin",g["margin"],"end",g["end"],"captures",g["stones_captured_by_net"],"lost",g["stones_lost_by_net"])
    print(show(boards[i,len(g["moves"])-1]))
    print("Opening",[(m["by"],m["move"]) for m in g["moves"][:24]])
    print("Last",g["moves"][-6:])
```
