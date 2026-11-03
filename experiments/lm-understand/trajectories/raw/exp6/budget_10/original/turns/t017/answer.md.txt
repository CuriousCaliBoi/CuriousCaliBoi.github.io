```python
import json,numpy as np,collections
g=json.load(open('/work/pass_5/games.json')); boards=np.load('/work/pass_5/boards.npy')
adj=[[j for j in (q-9,q+9,q-1,q+1) if 0<=j<81 and abs(j//9-q//9)+abs(j%9-q%9)==1] for q in range(81)]
def group_info(b):
    info={}
    for q in range(81):
        if b[q]==0 or q in info:continue
        stack=[q];ss={q};ll=set()
        while stack:
            t=stack.pop()
            for v in adj[t]:
                if b[v]==0:ll.add(v)
                elif b[v]==b[q] and v not in ss:ss.add(v);stack.append(v)
        for t in ss:info[t]=(ss,ll)
    return info
def show(b): return '\n'.join(''.join({0:'.',1:'X',-1:'O'}[int(v)] for v in row) for row in np.asarray(b).reshape(9,9))
stats=collections.Counter();bad=[]
for gi,x in enumerate(g):
    if x['opponent']!='strong':continue
    if x['result']<0:
        print('LOSS',gi,x['net_color'],x['margin'],x['end'],x['stones_lost_by_net'])
    color=1 if x['net_color']=='black' else -1
    for pi,m in enumerate(x['moves']):
        if m['by']!='net' or m['move']==81:continue
        before=np.zeros(81,np.int8) if pi==0 else boards[gi,pi-1]
        after=boards[gi,pi];gr=group_info(before);q=m['move']
        caps=sum(before==-color)-sum(after==-color)
        grp,libs=group_info(after)[q]
        stats['moves']+=1
        if len(libs)==1:
            stats['self_atari']+=1
            if caps==0:
                stats['noncapture_self_atari']+=1
                if len(grp)>=3:bad.append((gi,pi,q,len(grp),x['result'],m['top5']))
print(stats)
print('Large group self-ataris:',bad[:12])
for gi,pi,q,n,res,top in bad[:3]:
    print('\n',gi,pi,q,n,res,top)
    print(show(boards[gi,pi-1]))
loss=[i for i,x in enumerate(g) if x['opponent']=='strong' and x['result']<0]
for gi in loss[:2]:
    print('\nGAME',gi)
    x=g[gi]
    for pi,m in enumerate(x['moves']):
        if pi<34 and m['by']=='net':print(pi,m['move'],m['top5'][:3])
        if pi in [15,31,47,len(x['moves'])-1]:print('after',pi,'\n'+show(boards[gi,pi]))
```
