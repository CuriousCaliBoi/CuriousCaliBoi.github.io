```python
import json, hashlib, numpy as np

passes=[28,31,32,33,34,35]+list(range(38,50))
all_games=[]
for k in passes:
    all_games.extend(json.load(open("/work/pass_%d/games.json"%k)))

summary={}
for opponent in ["strong","weak","random"]:
    games=[g for g in all_games if g["opponent"]==opponent]
    wins=sum(g["result"]>0 for g in games)
    n=len(games)
    p=wins/n
    z=1.959963984540054
    den=1+z*z/n
    center=(p+z*z/(2*n))/den
    half=z*np.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    summary[opponent]={
        "games":n, "wins":wins, "win_rate":p,
        "mean_margin":float(np.mean([g["margin"] for g in games])),
        "wilson_95_percent":[center-half,center+half],
        "by_colour":{
            colour:{
                "games":sum(g["net_color"]==colour for g in games),
                "wins":sum(g["net_color"]==colour and g["result"]>0 for g in games)
            } for colour in ["black","white"]
        }
    }

names=["L%d.%s"%(k,t) for k in range(1,7) for t in ["W","b"]]+["out.W","out.b"]
reference=np.load("/work/candidate_A.npz")
tensors={name:load(name).astype(np.float32,copy=False) for name in names}
assert sum(a.size for a in tensors.values())==1480274
assert all(np.isfinite(a).all() for a in tensors.values())
assert all(np.array_equal(tensors[name],reference[name]) for name in names)

# Re-save the already validated checkpoint without changing any values.
for name,array in tensors.items():
    save(name,array)
np.savez("/work/final_policy.npz",**tensors)

cfg=json.load(open("/work/candidate_A_config.json"))
json.dump(cfg,open("/work/final_policy_config.json","w"),indent=2)
open("/work/final_policy_design.py","w").write(
    open("/work/policy_design_v23.py").read())

digest=hashlib.sha256()
for name in names:
    digest.update(name.encode())
    digest.update(tensors[name].tobytes())
manifest={
    "sha256":digest.hexdigest(),
    "completed_validation_passes":passes,
    "pending_final_pass":50,
    "summary_before_final_pass":summary,
    "training_or_search_used":False
}
json.dump(manifest,open("/work/final_validation_manifest.json","w"),indent=2)
print(json.dumps(summary,indent=2))
print("All 14 final tensors saved, unchanged from candidate A.")
print("SHA256:",digest.hexdigest())
print("Final remaining pass will validate another 128 games against weak.")
```