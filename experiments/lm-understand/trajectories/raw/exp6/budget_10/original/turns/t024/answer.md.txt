```python
import json
exec(open('/work/design_v8.py').read())
cfg=json.load(open('/work/config_v5.json'))
cfg['temperature_scale']=4.
config=install(cfg)
json.dump(config,open('/work/config_v9.json','w'),indent=2)
print('Installed the established tactical/shape design with sharper move selection.')
print(config)
```
