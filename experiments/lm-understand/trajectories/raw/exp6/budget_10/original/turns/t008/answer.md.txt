```python
import json,numpy as np
g=json.load(open('/work/pass_2/games.json')); boards=np.load('/work/pass_2/boards.npy')
def show(b): return '\n'.join(''.join({0:'.',1:'X',-1:'O'}[int(v)] for v in row) for row in np.asarray(b).reshape(9,9))
loss=[i for i,x in enumerate(g) if x['opponent']=='strong' and x['result']<0]
print('Strong losses',[(i,g[i]['margin'],g[i]['end'],g[i]['stones_lost_by_net']) for i in loss])
for gi in loss[:3]:
    x=g[gi]
    print('\nGAME',gi,x['net_color'])
    for ply,m in enumerate(x['moves']):
        if ply<38 and m['by']=='net': print(ply,m['move'],m['top5'][:3])
        if ply in [15,31,47,63,len(x['moves'])-1]: print('after',ply,'\n'+show(boards[gi,ply]))
for gi,x in enumerate(g):
    if x['end']=='repetition':
        print('\nREPETITION',gi,x['result'],x['net_color'],x['margin'])
        for m in x['moves'][-9:]: print(m)
        print(show(boards[gi,len(x['moves'])-4]))
        break
```
