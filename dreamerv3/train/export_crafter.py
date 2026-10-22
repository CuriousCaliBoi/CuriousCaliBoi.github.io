"""Export real Crafter evaluations and learned image reconstructions for the web."""
import argparse
import hashlib
import json
import pathlib
import pickle
import subprocess
import sys
import numpy as np
from PIL import Image
from ruamel.yaml import YAML

parser=argparse.ArgumentParser()
parser.add_argument('--repo',type=pathlib.Path,required=True)
parser.add_argument('--logdir',type=pathlib.Path,required=True)
parser.add_argument('--output',type=pathlib.Path,required=True)
parser.add_argument('--max-steps',type=int,default=400)
args=parser.parse_args()
sys.path.insert(0,str(args.repo.resolve()))
import crafter
import elements
import jax
import jax.numpy as jnp
import ninjax as nj
from dreamerv3.main import make_agent
from embodied.jax import internal
cfg=YAML(typ='safe').load((args.logdir/'config.yaml').read_text())
cfg['jax']['precompile']=False
cfg['jax']['profiler']=False
agent=make_agent(elements.Config(cfg))
checkpoint=args.logdir/'ckpt'/(args.logdir/'ckpt/latest').read_text().strip()
cp=elements.Checkpoint(args.logdir/'ckpt')
cp.agent=agent
cp.load(path=checkpoint,keys=['agent'])
with (checkpoint/'step.pkl').open('rb') as f: steps=int(pickle.load(f))

# Decode the very same latent state used for the policy's action, after observing
# the current image. This is a reconstruction, never presented as a future frame.
def reconstruct(dyn):
    _,_,dist=agent.model.dec({},dyn,jnp.zeros((1,),bool),training=False,single=True)
    return jnp.clip(dist['image'].pred()[0]*255,0,255).astype(jnp.uint8)
decode=jax.jit(nj.pure(reconstruct))

def recon(carry,index):
    with jax.transfer_guard('allow'):
        dyn=agent._stack(carry)[1]
        _,image=decode(agent.params,dyn,seed=jax.random.PRNGKey(index))
        return np.array(jax.device_get(image))

out=args.output
(out/'media').mkdir(parents=True,exist_ok=True)
materials=list(crafter.constants.materials)

def atlas(frames,prefix,size):
    paths=[]
    for start in range(0,len(frames),100):
        chunk=frames[start:start+100]
        image=Image.new('RGB',(10*size,((len(chunk)+9)//10)*size))
        for i,frame in enumerate(chunk):
            image.paste(Image.fromarray(frame),(i%10*size,i//10*size))
        path=f'media/{prefix}-{start//100}.png'
        image.save(out/path,optimize=True)
        paths.append(path)
    return {'files':paths,'size':size,'columns':10,'per_sheet':100}

results=[]
for controller in ['dreamer','random']:
    for seed in [7,23,42]:
        env=crafter.Env(seed=seed,length=args.max_steps)
        observation=env.reset()
        terrain=[[materials.index(env._world[(x,y)][0]) for x in range(64)] for y in range(64)]
        rng=np.random.default_rng(seed)
        carry=agent.init_policy(1) if controller=='dreamer' else None
        frames=[]; visions=[]; recons=[]; records=[]; reward=0.; total=0.; done=False
        for step in range(args.max_steps+1):
            # Render high-resolution frames without changing the environment RNG:
            # Crafter's night lighting uses randomness, so preserve its state.
            rng_state=env._world.random.get_state()
            frames.append(env.render(size=(144,144)))
            env._world.random.set_state(rng_state)
            visions.append(observation.copy())
            if controller=='dreamer':
                data={'image':observation[None], 'reward':np.array([reward],np.float32),
                      'is_first':np.array([step==0]),'is_last':np.array([done]),
                      'is_terminal':np.array([done and env._player.health<=0])}
                carry,action,_=agent.policy(carry,data,mode='eval')
                action=int(action['action'][0])
                recons.append(recon(carry,step))
            else:
                action=int(rng.integers(17))
            records.append({'step':step,'action':action if not done else None,
                            'reward':round(float(reward),4),'total_reward':round(total,4),
                            'position':env._player.pos.astype(int).tolist(),
                            'inventory':{k:int(v) for k,v in env._player.inventory.items()},
                            'achievements':{k:int(v) for k,v in env._player.achievements.items()},
                            'daylight':float(env._world.daylight)})
            if done or step==args.max_steps: break
            observation,reward,done,info=env.step(action)
            total+=float(reward)
        identifier=f'{controller}-{seed}'
        result={'id':identifier,'controller':controller,'seed':seed,'steps':len(records)-1,
                'reward':round(total,4),'ended_by':'death' if env._player.health<=0 else 'evaluation_limit',
                'terrain':terrain,'frames':records,'world':atlas(frames,identifier+'-world',144),
                'vision':atlas(visions,identifier+'-vision',64)}
        if recons: result['reconstruction']=atlas(recons,identifier+'-reconstruction',64)
        results.append(result)
        print(identifier,result['steps'],result['reward'],{k:v for k,v in records[-1]['achievements'].items() if v},flush=True)
training=[]
for line in (args.logdir/'metrics.jsonl').read_text().splitlines():
    item=json.loads(line)
    if 'episode/score' in item:
        training.append({'step':int(item['step']),'reward':float(item['episode/score'])})
record={'schema_version':1,'environment':'Crafter 1.8.3','device':str(jax.devices()[0]),
        'jax_version':jax.__version__,'training_steps':steps,'updates':int(agent.n_updates),
        'model_parameters':687875,'training':training,'max_evaluation_steps':args.max_steps,
        'source_commit':subprocess.check_output(['git','-C',str(args.repo),'rev-parse','HEAD'],text=True).strip(),
        'checkpoint_sha256':hashlib.sha256((checkpoint/'agent.pkl').read_bytes()).hexdigest(),
        'config_sha256':hashlib.sha256((args.logdir/'config.yaml').read_bytes()).hexdigest(),
        'materials':materials,'actions':list(crafter.constants.actions),
        'achievements':list(crafter.constants.achievements),'episodes':results,
        'note':'Early, small-model GPU run. All three evaluation seeds and matching random baselines included. Reconstructed frames use current observations, not future predictions. This is not a published Crafter benchmark score.'}
(out/'run.json').write_text(json.dumps(record,separators=(',',':'),allow_nan=False))
Image.fromarray(frames[0]).save(out/'poster.png')
print(json.dumps({'training_steps':steps,'updates':int(agent.n_updates),'episodes':len(results)}),flush=True)
