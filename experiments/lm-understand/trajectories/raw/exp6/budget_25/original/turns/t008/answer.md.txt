```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v2.py")
s=open("/work/design.py").read()
s=s.replace('seed_shared_liberty=1.0,','seed_shared_liberty=1.0, positional_scale=2.0, low_liberty=1.5,')
s=s.replace('    add(3,unit(5,p),unit(4,p),1)',r'''
    # Prefer moves with room to grow, not just moves that evade atari.
    dest=unit(5,p)
    B[3][dest]=3-len(adj[p])
    for q in adj[p]:
        add(3,dest,unit(0,q),-1)
        add(3,dest,unit(1,q),1)
        add(3,dest,unit(2,q),2)
        add(3,dest,unit(3,q),-3)
''')
s=s.replace('add(5,dest,unit(5,p),-1.5)','add(5,dest,unit(5,p),-P["low_liberty"])')
s=s.replace('OB[p] = -20 + positional','OB[p] = -20 + P["positional_scale"]*positional')
open("/work/design.py","w").write(s)
overrides=dict(friend_adj=1.4,enemy_adj=0.5,friend_diag=0.6,
               friend_jump=0.25,friend_knight=0.1,
               crowd=2.0,rescue=6.0,self_atari=9.0)
open("/work/params_v3.json","w").write(json.dumps(overrides))
exec(s)
print(P)
```
