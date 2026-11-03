```python
import json,numpy as np,collections
g=json.load(open('/work/pass_4/games.json')); boards=np.load('/work/pass_4/boards.npy')
def show(b): return '\n'.join(''.join({0:'.',1:'X',-1:'O'}[int(v)] for v in row) for row in np.asarray(b).reshape(9,9))
for i,x in enumerate(g):
    if x['result']<0:
        print(i,x['opponent'],x['net_color'],x['margin'],x['end'],
              'caps/lost',x['stones_captured_by_net'],x['stones_lost_by_net'])
print('\nREPETITION DETAILS')
for gi,x in enumerate(g):
    if x['end']!='repetition':continue
    n=len(x['moves'])
    print('\nGAME',gi,x['result'],x['net_color'],x['margin'])
    for pi in range(max(0,n-5),n):
        print(x['moves'][pi])
        print(show(boards[gi,pi]))
    if gi>30:break
```
