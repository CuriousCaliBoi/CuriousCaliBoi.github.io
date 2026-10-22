"""Export local DreamerV3 checkpoint evaluations as a static, inspectable replay."""
import argparse
import hashlib
import json
import pathlib
import pickle
import subprocess
import sys
import numpy as np
import ruamel.yaml as yaml

parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=pathlib.Path, required=True)
parser.add_argument('--logdir', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
args = parser.parse_args()
sys.path.insert(0, str(args.repo.resolve()))
import elements
import gym
import jax
from dreamerv3.main import make_agent

cfg = yaml.YAML(typ='safe').load((args.logdir / 'config.yaml').read_text())
cfg['jax']['precompile'] = False
cfg['jax']['profiler'] = False
agent = make_agent(elements.Config(cfg))
ckpt_dir = args.logdir / 'ckpt' / (args.logdir / 'ckpt/latest').read_text().strip()
# Only trusted checkpoints created locally by this run are loaded.
checkpoint = elements.Checkpoint(args.logdir / 'ckpt')
checkpoint.agent = agent
checkpoint.load(path=ckpt_dir, keys=['agent'])
with (ckpt_dir / 'step.pkl').open('rb') as f:
    steps = int(pickle.load(f))

def evaluate(controller, seed):
    env = gym.make('CartPole-v1')
    obs, _ = env.reset(seed=seed)
    carry = agent.init_policy(1) if controller == 'dreamer' else None
    rng = np.random.default_rng(seed)
    states, actions = [obs.astype(float).tolist()], []
    reward = 0.0
    for step in range(500):
        if controller == 'dreamer':
            data = {'vector': obs[None].astype(np.float32),
                    'reward': np.array([reward], np.float32),
                    'is_first': np.array([step == 0]),
                    'is_last': np.array([False]),
                    'is_terminal': np.array([False])}
            carry, act, _ = agent.policy(carry, data, mode='eval')
            action = int(act['action'][0])
        else:
            action = int(rng.integers(2))
        obs, reward, terminated, truncated, _ = env.step(action)
        states.append(obs.astype(float).tolist())
        actions.append(action)
        if terminated or truncated:
            break
    env.close()
    return {'seed': seed, 'score': len(actions), 'states': states, 'actions': actions,
            'terminated': bool(terminated), 'truncated': bool(truncated)}

episodes = {controller: [evaluate(controller, seed) for seed in range(8)]
            for controller in ['dreamer', 'random']}
training = []
for line in (args.logdir / 'metrics.jsonl').read_text().splitlines():
    item = json.loads(line)
    if 'episode/score' in item:
        training.append({'step': item['step'], 'score': item['episode/score']})
record = {'schema_version': 1, 'task': 'CartPole-v1', 'platform': 'CPU',
          'jax_version': jax.__version__,
          'commit': subprocess.check_output(['git', '-C', str(args.repo), 'rev-parse', 'HEAD'], text=True).strip(),
          'local_changes': ['Gym 0.26 reset/step compatibility', 'CPU CartPole config with float32', 'save final checkpoint'],
          'checkpoint_sha256': hashlib.sha256((ckpt_dir / 'agent.pkl').read_bytes()).hexdigest(),
          'config_sha256': hashlib.sha256((args.logdir / 'config.yaml').read_bytes()).hexdigest(),
          'steps': steps, 'updates': int(agent.n_updates), 'training': training,
          'episodes': episodes,
          'evaluation': {f'{k}_mean': float(np.mean([e['score'] for e in v])) for k,v in episodes.items()},
          'note': 'Short setup validation, not a solved-task claim. All eight evaluation episodes included, without cherry-picking.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(record, separators=(',', ':'), allow_nan=False))
print(json.dumps({'steps':steps,'updates':record['updates'],'evaluation':record['evaluation']}))
