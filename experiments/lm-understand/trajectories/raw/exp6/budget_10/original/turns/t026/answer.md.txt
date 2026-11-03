```python
import json, numpy as np
exec(open('/work/design_v5.py').read())
final_config=json.load(open('/work/config_v5.json'))
install(final_config)
for name in NAMES:
    value=load(name)
    assert value.shape==tuple(SHAPES[name])
    assert value.dtype==np.float32
    assert np.isfinite(value).all()
assert set(saved())==set(NAMES)
json.dump(final_config,open('/work/final_config.json','w'),indent=2)
print('Final policy saved and all 14 tensors checked.')
print('Design: liberty-based group signals, guarded captures, atari escapes,')
print('self-atari avoidance, eye preservation, connection/shape preferences,')
print('local influence, center opening, and conservative passing.')
print('No training, search, or sandbox forward evaluations were used.')
```
