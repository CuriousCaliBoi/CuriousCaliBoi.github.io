#!/usr/bin/env bash
set -euo pipefail
setup_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$setup_dir"
if [ ! -d dreamerv3-crafter/.git ]; then
  git clone https://github.com/danijar/dreamerv3.git dreamerv3-crafter
  git -C dreamerv3-crafter checkout e01491fad6434b2245a3b8ca201dd7faedcc458c
fi
if git -C dreamerv3-crafter apply --check "$setup_dir/compatibility-crafter.patch" 2>/dev/null; then
  git -C dreamerv3-crafter apply "$setup_dir/compatibility-crafter.patch"
elif ! git -C dreamerv3-crafter apply --reverse --check "$setup_dir/compatibility-crafter.patch" 2>/dev/null; then
  printf '%s\n' 'Source differs from the tested version. Use a fresh setup directory.' >&2
  exit 1
fi
if [ ! -x .venv-crafter/bin/python ]; then
  uv venv --python 3.12 .venv-crafter
fi
uv pip install --python .venv-crafter/bin/python -r requirements-crafter-gpu.lock
printf '%s\n' 'Ready: .venv-crafter/bin/python dreamerv3-crafter/dreamerv3/main.py --configs crafter_spark --run.steps 48000 --logdir runs/crafter'
