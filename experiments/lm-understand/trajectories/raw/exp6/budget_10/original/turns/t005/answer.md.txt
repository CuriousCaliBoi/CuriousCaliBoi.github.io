```python
import numpy as np,json
g=json.load(open('/work/pass_1/games.json'))
boards=np.load('/work/pass_1/boards.npy')
def show(board):
    z=np.asarray(board).reshape(9,9)
    return '\n'.join(''.join({0:'.',1:'X',-1:'O'}[int(v)] for v in row) for row in z)
for gi in [32,33,67]:
    x=g[gi]
    print('\nGAME',gi,x['net_color'])
    for ply,m in enumerate(x['moves']):
        if ply<46 and m['by']=='net':
            print(ply,'move',divmod(m['move'],9),'top',m['top5'][:3])
        if ply in [15,31,47,63,len(x['moves'])-1]:
            print('after',ply,'\n'+show(boards[gi,ply]))
```
