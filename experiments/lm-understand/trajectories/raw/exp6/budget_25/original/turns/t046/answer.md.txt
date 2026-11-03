```python
import json,shutil
shutil.copyfile("/work/design.py","/work/design_v19.py")
s=open("/work/design.py").read()
needle='# Further layers broadcast safety across fully connected segments.\nfor k,color,danger in [(2,1,4),(3,1,3)]:\n    for j,seg in enumerate(segments):'
replacement=r'''
# Stagger the later block certificates. Together the three enemy
# stages cover all 64 possible 2x2 blocks, preserving board symmetries.
def blocks_with_orbits(orbits):
    out=[]
    for r in range(8):
        for c in range(8):
            key=tuple(sorted([abs(2*r-7),abs(2*c-7)]))
            if key in orbits:
                out.append([(r+dr)*9+c+dc for dr in [0,1] for dc in [0,1]])
    return out
third=blocks_with_orbits({(1,3),(5,7),(1,1),(5,5)})
fourth=blocks_with_orbits({(1,5),(1,7),(3,5)})
assert len(third)==len(fourth)==24
assert len({tuple(x) for x in segments+third+fourth})==64

# Further layers broadcast safety across fully connected blocks.
for k,color,danger in [(2,1,4),(3,1,3)]:
    active_segments=third if k==2 else fourth
    for j,seg in enumerate(active_segments):'''
assert needle in s
s=s.replace(needle,replacement)
s=s.replace('for jj,other in enumerate(segments):','for jj,other in enumerate(third):')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v9.json"))
exec(s)
print("Staggered safety certificates cover every 2x2 block.")
```
