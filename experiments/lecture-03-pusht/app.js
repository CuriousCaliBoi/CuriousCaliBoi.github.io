'use strict';
const $ = (id) => document.getElementById(id);
const ctx = $('scene').getContext('2d');
let record, sprite, frame = 0, timer = null, loadId = 0;
const controls = ['play', 'back', 'next', 'scrub'];
const point = (p) => `(${p.map(n => n.toFixed(1)).join(', ')})`;
function pause() { clearInterval(timer); timer = null; $('play').textContent = 'Play rollout'; }
function draw() {
  const n = record.transitions.length;
  const t = frame ? record.transitions[frame - 1] : null;
  const s = t ? t.after : record.initial_state;
  ctx.drawImage(sprite, (frame % record.frames.columns) * 512, Math.floor(frame / record.frames.columns) * 512, 512, 512, 0, 0, 512, 512);
  $('scrub').value = frame;
  $('counter').textContent = `${frame} / ${n} actions`;
  $('time').textContent = `${(frame / record.control_hz).toFixed(1)} seconds`;
  $('back').disabled = frame === 0; $('next').disabled = frame === n;
  $('event-label').textContent = frame ? `After action ${frame}` : 'After reset(seed=7)';
  $('event-title').textContent = !t ? 'Start with a world.' : t.terminated ? 'The goal is reached.' : t.contacts ? 'Contact changes the world.' : 'The world advances.';
  $('explanation').textContent = !t ? 'Reset establishes positions and velocities. The pusher and the T are about to make contact.' : t.terminated ? 'The centered push satisfies the position and orientation checks. This episode ends here.' : t.contacts ? 'The moving pusher touches the T. Off-center contact can change its rotation as well as its position.' : 'The physics advances even without pusher contact. Inspect the state to see the resulting motion.';
  $('action').textContent = t ? `[${t.action.join(', ')}]` : 'No action yet';
  $('target').textContent = t ? point(t.target_position) : 'Set when an action is applied';
  $('contact').textContent = t ? `Contact detected during action: ${t.contacts ? 'yes' : 'no'}` : 'One action will advance ten physics updates.';
  $('pose').textContent = `T at ${point(s.block_position)} · ${(s.block_angle_radians * 180 / Math.PI).toFixed(1)}°`;
  $('motion').textContent = `T velocity ${point(s.block_velocity)} · spin ${s.block_angular_velocity.toFixed(2)} rad/s`;
  $('reward').textContent = t ? t.reward.toFixed(2) : '—';
  $('success').textContent = t?.terminated ? 'Yes' : 'No';
  $('truncated').textContent = t?.truncated ? 'Yes' : 'No';
  $('trace').textContent = JSON.stringify(t || {event: 'reset', seed: record.seed, reset_options: record.reset_options, observation: record.initial_observation, mechanical_state: record.initial_state, goal_state: record.goal_state}, null, 2);
  $('load-status').textContent = `Recorded ${record.scene.toLowerCase()} · ${n} actions · 10 Hz`;
  if (frame === n) pause();
}
async function loadScene(slug) {
  pause(); const thisLoad = ++loadId;
  controls.forEach(id => $(id).disabled = true);
  $('load-status').textContent = 'Loading the recorded experiment…';
  try {
    const response = await fetch(`${slug}.json`);
    if (!response.ok) throw new Error(`Trace unavailable (${response.status})`);
    const nextRecord = await response.json();
    const nextSprite = new Image(); nextSprite.src = nextRecord.frames.file; await nextSprite.decode();
    if (thisLoad !== loadId) return;
    record = nextRecord; sprite = nextSprite; frame = 0;
    $('scrub').max = record.transitions.length;
    $('download').href = `${slug}.json`;
    document.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === slug)));
    controls.forEach(id => $(id).disabled = false);
    draw();
    if (window.parent !== window) window.parent.postMessage({type:'zuko:experiment-status',state:'live',message:'Recorded PushT explorer ready'}, location.origin);
  } catch (error) {
    if (thisLoad !== loadId) return;
    $('load-status').textContent = `Could not load this recording: ${error.message}. Choose a scene to retry.`;
  }
}
$('play').addEventListener('click', () => {
  if (timer) { pause(); return; }
  if (frame === record.transitions.length) frame = 0;
  draw(); $('play').textContent = 'Pause';
  timer = setInterval(() => { frame++; draw(); }, 300);
});
$('next').addEventListener('click', () => { pause(); frame = Math.min(frame + 1, record.transitions.length); draw(); });
$('back').addEventListener('click', () => { pause(); frame = Math.max(0, frame - 1); draw(); });
$('scrub').addEventListener('input', (e) => { pause(); frame = Number(e.target.value); draw(); });
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => loadScene(b.dataset.scene)));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
loadScene('off-center');
