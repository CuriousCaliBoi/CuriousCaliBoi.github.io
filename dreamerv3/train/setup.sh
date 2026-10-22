#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"
if [ ! -d dreamerv3/.git ]; then
  git clone https://github.com/danijar/dreamerv3.git dreamerv3
  git -C dreamerv3 checkout e01491fad6434b2245a3b8ca201dd7faedcc458c
fi
if git -C dreamerv3 apply --check "$project_dir/compatibility.patch" 2>/dev/null; then
  git -C dreamerv3 apply "$project_dir/compatibility.patch"
elif ! git -C dreamerv3 apply --reverse --check "$project_dir/compatibility.patch" 2>/dev/null; then
  printf '%s\n' 'Source differs from the tested version. Use a fresh directory for setup.' >&2
  exit 1
fi
if [ ! -x .venv/bin/python ]; then
  uv venv --python 3.12 .venv
fi
uv pip install --python .venv/bin/python -r requirements-cpu.lock
printf '%s\n' 'Ready: .venv/bin/python dreamerv3/dreamerv3/main.py --configs cartpole_cpu --logdir runs/cartpole'
