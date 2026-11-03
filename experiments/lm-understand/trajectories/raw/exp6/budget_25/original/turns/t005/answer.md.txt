```python
import shutil
shutil.copyfile("/work/design.py","/work/design_v1.py")
s=open("/work/design.py").read()
start=s.index("# Second layer")
end=s.index("    dest = unit(4,p)",start)
s=s[:start]+r'''
# Conservative safety seeds: never mark a genuinely atari group safe.
# Channels 2/4 are binary danger; 3/5 detect adjacent liberty-bearing
# stones, whose liberties must be distinct on the square grid.
for p in range(81):
    carry(1,0,p)
    carry(1,1,p)
    for color,dch,zch in [(0,2,3),(1,4,5)]:
        dest=unit(dch,p)
        add(1,dest,unit(dch,p),1)
        add(1,dest,unit(zch,p),-1)
        for q in adj[p]:
            add(1,dest,unit(color,q),-1)
            add(1,dest,unit(dch,q),1)
            add(1,dest,unit(zch,q),-1)
        dest=unit(zch,p)
        B[1][dest]=-4
        add(1,dest,unit(dch,p),4)
        add(1,dest,unit(zch,p),-8)
        for q in adj[p]:
            add(1,dest,unit(dch,q),1)
            add(1,dest,unit(zch,q),-2)

# Safety propagates through each connected string.
for p in range(81):
    carry(2,0,p)
    carry(2,1,p)
    for color,dch,zch,outch in [(0,2,3,2),(1,4,5,3)]:
        dest=unit(outch,p)
        add(2,dest,unit(dch,p),1)
        add(2,dest,unit(zch,p),-1)
        for q in adj[p]:
            add(2,dest,unit(color,q),-1)
            add(2,dest,unit(dch,q),1)
            add(2,dest,unit(zch,q),-1)
''' + s[end:]
open("/work/design.py","w").write(s)
overrides={}
exec(s)
print("Corrected conservative group-safety logic; other coefficients unchanged.")
```
