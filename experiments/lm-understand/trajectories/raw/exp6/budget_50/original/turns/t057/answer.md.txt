```python
import json, numpy as np, collections
g=json.load(open("/work/pass_27/games.json"))
b=np.load("/work/pass_27/boards.npy")
N=[]
for p in range(81):
    r,c=divmod(p,9)
    N.append([rr*9+cc for rr,cc in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)]
              if 0<=rr<9 and 0<=cc<9])
def groups(board):
    out=[]; seen=set()
    for p in range(81):
        if board[p]==0 or p in seen: continue
        st={p}; lib=set(); seen.add(p); todo=[p]
        while todo:
            q=todo.pop()
            for a in N[q]:
                if board[a]==0: lib.add(a)
                elif board[a]==board[p] and a not in seen:
                    st.add(a);seen.add(a);todo.append(a)
        out.append((int(board[p]),st,lib))
    return out
for i,x in enumerate(g):
    if x["end"]!="repetition": continue
    t=len(x["moves"])-1
    eq=[j for j in range(t) if np.array_equal(b[i,j],b[i,t])]
    print("\nREPEAT",i,x["net_color"],"result",x["result"],"margin",x["margin"],
          "ply",t,"earlier",eq)
    print(json.dumps(x["moves"][-8:]))
    pre=b[i,t-1]
    mover=1 if t%2==0 else -1
    p=x["moves"][-1]["move"]
    print("move",divmod(p,9),"adjacent",[int(pre[q]) for q in N[p]],
          "capturable",[(len(s),sorted(s),list(l)) for co,s,l in groups(pre)
                        if co==-mover and l=={p}])
    print("\n".join("".join({0:".",1:"X",-1:"O"}[int(z)] for z in row)
                    for row in pre.reshape(9,9)))
```