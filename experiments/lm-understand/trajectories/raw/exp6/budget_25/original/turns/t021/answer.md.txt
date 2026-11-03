```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v8.py")
s=open("/work/design.py").read()
a=s.index('    # Prefer moves with room')
b=s.index('# Fifth layer',a)
s=s[:a]+r'''
    # Binary access to a friendly string with spare liberties.
    # Count the string once even if it touches a move on several sides.
    dest=unit(5,p)
    B[3][dest]=1
    for q in adj[p]:
        add(3,dest,unit(0,q),-1)
        add(3,dest,unit(2,q),1)

''' + s[b:]
a=s.index('    # Insufficient escape')
b=s.index('    dest=unit(3,p)',a)
s=s[:a]+r'''
    # Conservative self-atari prevention with saturated friendly access.
    dest=unit(2,p)
    B[5][dest]=0.5-len(adj[p])
    add(5,dest,unit(5,p),1.5)
    for q in adj[p]:
        add(5,dest,unit(0,q),1)
        add(5,dest,unit(1,q),1)
        add(5,dest,unit(3,q),-2)

''' + s[b:]
s=s.replace('    for q in diag[p]:\n        add(5,dest,unit(0,q),0.5)',
'''    for q in adj[p]:
        add(5,dest,unit(1,q),-0.75)
    for q in diag[p]:
        add(5,dest,unit(0,q),0.5)''')
open("/work/design.py","w").write(s)
overrides=json.load(open("/work/params_v8.json"))
overrides.update(low_liberty=0.5)
open("/work/params_v9.json","w").write(json.dumps(overrides))
exec(s)
print("Conservative string access; permit necessary connections in contested areas.")
```
