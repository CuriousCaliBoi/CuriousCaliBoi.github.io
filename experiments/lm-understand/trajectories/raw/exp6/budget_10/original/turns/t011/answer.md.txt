```python
import numpy as np,json,collections
g=json.load(open('/work/pass_3/games.json')); boards=np.load('/work/pass_3/boards.npy')
adj=[[j for j in (q-9,q+9,q-1,q+1) if 0<=j<81 and abs(j//9-q//9)+abs(j%9-q%9)==1] for q in range(81)]
def groups(b):
    info={}
    for q in range(81):
        if b[q]==0 or q in info: continue
        stack=[q]; stones={q}; libs=set()
        while stack:
            t=stack.pop()
            for v in adj[t]:
                if b[v]==0: libs.add(v)
                elif b[v]==b[q] and v not in stones: stones.add(v);stack.append(v)
        for t in stones: info[t]=(stones,libs)
    return info
bad=[]; stats=collections.Counter()
for gi,x in enumerate(g):
    if x['opponent']!='strong':continue
    color=1 if x['net_color']=='black' else -1
    for pi,m in enumerate(x['moves']):
        if m['by']!='net' or m['move']==81:continue
        before=np.zeros(81,np.int8) if pi==0 else boards[gi,pi-1]
        after=boards[gi,pi]; gr=groups(before);q=m['move']
        caps=sum(before==-color)-sum(after==-color)
        save=any(before[t]==color and len(gr[t][1])==1 for t in adj[q])
        atari_after=groups(after).get(q,(set(),set()))[1]
        stats['moves']+=1
        if len(atari_after)==1:
            stats['self_atari']+=1
            if caps==0:stats['noncapture_self_atari']+=1
        if m['top5'][0][0]==q and m['top5'][0][1]>.95 and caps==0 and not save:
            bad.append((gi,pi,q,len(atari_after),x['result'],m['top5'][:2]))
print(stats)
print('Confident, no capture or atari save:',len(bad))
print(bad[:30])
for gi,pi,q,libs,res,top in bad[:4]:
    print('\n',gi,pi,q,libs,res,top)
    print('\n'.join(''.join({0:'.',1:'X',-1:'O'}[int(v)] for v in row) for row in boards[gi,pi-1].reshape(9,9)))
```
