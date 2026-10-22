import { advance, failed } from './physics.js';
const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d');
let mode = 'manual', running = false, ended = false, step = 0, state = [0,0,Math.PI/60,0];
let run = null, recording = null, force = 0, accumulator = 0, last = 0;
const held = new Set();
function message(text) { $('notice').textContent = text; }
function setRunning(value) {
  if (value && ended) reset();
  running = value;
  $('play').textContent = running ? 'Pause experiment  Ⅱ' : ended ? 'Try again  ↺' : step ? 'Continue  ▶' : 'Start experiment  ▶';
  $('play').setAttribute('aria-pressed', String(running));
}
function stopInput() { held.clear(); force=0; $('left').classList.remove('pressed'); $('right').classList.remove('pressed'); }
function reset() {
  running=false; ended=false; step=0; accumulator=0; stopInput();
  if (mode==='manual') {
    state=[0,0,Number($('tilt').value)*Math.PI/180,0];
    message('Ready when you are. Each second upright is a small victory.');
  } else {
    recording=run.episodes[$('controller').value][Number($('episode').value)];
    state=recording.states[0].slice();
    $('scrub').max=recording.states.length-1;
    message(`Recorded evaluation · seed ${recording.seed} · ${recording.score} reward. This is a saved run, with no live model connection.`);
  }
  setRunning(false); readouts(); draw();
}
function switchMode(next) {
  if (next==='replay'&&!run) return;
  mode=next;
  $('manual-mode').setAttribute('aria-pressed',String(next==='manual'));
  $('replay-mode').setAttribute('aria-pressed',String(next==='replay'));
  $('manual-options').hidden=next!=='manual'; $('push-buttons').hidden=next!=='manual';
  $('recording-options').hidden=next!=='replay'; $('replay-controls').hidden=next!=='replay';
  $('mode-badge').textContent=next==='manual'?'PLAYGROUND':'RECORDED MODEL RUN';
  $('mode-title').textContent=next==='manual'?'A surprisingly hard balancing act.':'Watch what it learned.';
  $('mode-description').textContent=next==='manual'?'The cart can only move left or right. Keep the pole within 12° of vertical and the cart on the track.':'Replay the actual checkpoint, then compare it with random actions from the same starting seeds. A short run can still make plenty of mistakes.';
  $('mode-caption').textContent=next==='manual'?'You control a physics simulation. Hold ← / → or use the buttons. Releasing both applies no force. This playground does not run the neural network.':'These are real environment states recorded on the Spark. Scrub, slow down, or switch seeds. The recording is fixed; no inference or training runs in this browser.';
  canvas.setAttribute('aria-label',next==='manual'?'Cart and pole playground. Focus here and use arrow keys to move the cart.':'Recorded CartPole evaluation. Use the recording position slider to inspect frames.');
  reset();
}
function readouts() {
  $('time').textContent=(step*.02).toFixed(2); $('angle').textContent=(state[2]*180/Math.PI).toFixed(1);
  $('step-badge').textContent=`STEP ${String(step).padStart(3,'0')}`;
  $('scrub').value=step; $('scrub-value').textContent=`${step} / ${recording?recording.states.length-1:0}`;
  $('action-badge').textContent=ended?'EPISODE COMPLETE':mode==='replay'?`${$('controller').value==='dreamer'?'DREAMERV3':'RANDOM BASELINE'} · ${force>0?'RIGHT →':force<0?'← LEFT':'INITIAL STATE'}`:force>0?'PUSHING RIGHT →':force<0?'← PUSHING LEFT':'PUSH THE CART. KEEP THE POLE UPRIGHT.';
}
function draw() {
  const w=1000,h=520;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#274037';ctx.lineWidth=1;
  for(let x=20;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,35);ctx.lineTo(x,450);ctx.stroke();}
  for(let y=50;y<=450;y+=40){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(980,y);ctx.stroke();}
  const base=371, scale=140, px=500+state[0]*scale;
  const pole=180, tipX=px+Math.sin(state[2])*pole, tipY=base-Math.cos(state[2])*pole;
  ctx.strokeStyle='#526e5b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(65,base+44);ctx.lineTo(935,base+44);ctx.stroke();
  ctx.setLineDash([3,7]);ctx.strokeStyle='#67806b66';
  for(const x of [164,836]){ctx.beginPath();ctx.moveTo(x,170);ctx.lineTo(x,base+59);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(500,115);ctx.lineTo(500,base+44);ctx.stroke();ctx.setLineDash([]);
  ctx.font='12px ui-monospace,monospace';ctx.fillStyle='#7f9a86';ctx.textAlign='center';
  ctx.fillText('−2.4',164,base+78);ctx.fillText('0',500,base+78);ctx.fillText('+2.4',836,base+78);
  ctx.fillStyle='#243d30';ctx.beginPath();ctx.moveTo(px,base);ctx.arc(px,base,pole,-Math.PI/2-12*Math.PI/180,-Math.PI/2+12*Math.PI/180);ctx.closePath();ctx.fill();
  ctx.strokeStyle=ended?'#dcaa78':'#c6ecc5';ctx.lineWidth=11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,base);ctx.lineTo(tipX,tipY);ctx.stroke();
  ctx.fillStyle=ended?'#dcaa78':'#c6ecc5';ctx.beginPath();ctx.arc(tipX,tipY,13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#10221c';ctx.beginPath();ctx.ellipse(px,base+49,66,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=ended?'#b18660':'#9ec6a2';ctx.beginPath();ctx.roundRect(px-49,base-4,98,32,7);ctx.fill();
  ctx.fillStyle='#183627';for(const x of [px-30,px+30]){ctx.beginPath();ctx.arc(x,base+32,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8aae8c';ctx.lineWidth=2;ctx.stroke();}
  ctx.fillStyle='#173a2b';ctx.beginPath();ctx.arc(px,base+1,6,0,Math.PI*2);ctx.fill();
  if(force){ctx.strokeStyle='#d6a26d';ctx.lineWidth=2;ctx.beginPath();const ax=px+Math.sign(force)*75,ex=ax+Math.sign(force)*38;ctx.moveTo(ax,base+12);ctx.lineTo(ex,base+12);ctx.moveTo(ex-Math.sign(force)*8,base+5);ctx.lineTo(ex,base+12);ctx.lineTo(ex-Math.sign(force)*8,base+19);ctx.stroke();}
  ctx.fillStyle='#89a58e';ctx.font='11px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText('12° LIMIT',Math.min(820,Math.max(35,px+60)),base-200);
  if(ended){ctx.textAlign='center';ctx.fillStyle='#dcaa78';ctx.font='16px ui-monospace,monospace';ctx.fillText('EPISODE COMPLETE',500,70);}
}
function tick() {
  if(mode==='manual') {force=(held.has('right')?1:0)-(held.has('left')?1:0);state=advance(state,force);step++;if(failed(state)||step>=500){ended=true;running=false;message(step>=500?'Ten seconds balanced. Nice work—try a steeper starting tilt.':'The pole tipped or the cart left the track. Reset and try a smaller correction.');setRunning(false);stopInput();}}
  else {step=Math.min(step+1,recording.states.length-1);state=recording.states[step].slice();force=recording.actions[step-1]===1?1:-1;if(step===recording.states.length-1){ended=true;running=false;message(`Recording complete: ${recording.score} reward over ${recording.actions.length} actions. Try another seed or compare the random baseline.`);setRunning(false);}}
  readouts();
}
function animate(time) {if(!last)last=time;const delta=Math.min((time-last)/1000,.1);last=time;if(running){accumulator+=delta*Number($('speed').value);while(accumulator>=.02&&running){tick();accumulator-=.02;}}draw();requestAnimationFrame(animate);}
$('play').addEventListener('click',()=>setRunning(!running));$('reset').addEventListener('click',reset);
$('manual-mode').addEventListener('click',()=>switchMode('manual'));$('replay-mode').addEventListener('click',()=>switchMode('replay'));
$('tilt').addEventListener('input',()=>{$('tilt-value').textContent=`${$('tilt').value}°`;if(!running&&step===0)reset();});
$('speed').addEventListener('input',()=>{$('speed-value').textContent=`${$('speed').value}×`;});
$('episode').addEventListener('change',reset);$('controller').addEventListener('change',reset);
$('scrub').addEventListener('input',()=>{setRunning(false);step=Number($('scrub').value);state=recording.states[step].slice();ended=step===recording.states.length-1;force=step?(recording.actions[step-1]===1?1:-1):0;setRunning(false);readouts();draw();});
function press(direction){if(mode!=='manual')return;if(ended)reset();held.add(direction);$(direction).classList.add('pressed');if(!running)setRunning(true);}
function release(direction){held.delete(direction);$(direction).classList.remove('pressed');}
for(const direction of ['left','right']){const button=$(direction);button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);press(direction);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>release(direction));}
canvas.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&mode==='manual'){event.preventDefault();press(event.key==='ArrowLeft'?'left':'right');}if(event.code==='Space'){event.preventDefault();setRunning(!running);}});
window.addEventListener('keyup',event=>{if(event.key==='ArrowLeft')release('left');if(event.key==='ArrowRight')release('right');});window.addEventListener('blur',()=>{stopInput();setRunning(false);});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopInput();setRunning(false);}});canvas.addEventListener('blur',stopInput);
function drawChart(points) {
  const c=$('chart'),g=c.getContext('2d'),w=1000,h=280;
  g.clearRect(0,0,w,h); const maxX=Math.max(1,...points.map(p=>p.step)),maxY=Math.max(50,Math.ceil(Math.max(...points.map(p=>p.score))/25)*25);
  g.font='14px ui-monospace,monospace';g.lineWidth=1;
  for(let n=0;n<=4;n++){const y=20+(h-60)*n/4;g.strokeStyle='#d9ddd0';g.beginPath();g.moveTo(48,y);g.lineTo(w-20,y);g.stroke();g.fillStyle='#697068';g.textAlign='right';g.fillText(Math.round(maxY*(1-n/4)),38,y+5);}
  const xy=p=>[48+p.step/maxX*(w-68),20+(1-p.score/maxY)*(h-60)];g.strokeStyle='#23624c';g.lineWidth=2;g.beginPath();points.forEach((p,i)=>{const [x,y]=xy(p);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.fillStyle='#23624c';for(const p of points){const [x,y]=xy(p);g.beginPath();g.arc(x,y,3.5,0,Math.PI*2);g.fill();}g.fillStyle='#697068';g.textAlign='left';g.fillText('0',48,h-9);g.textAlign='right';g.fillText(`${maxX.toLocaleString()} steps`,w-20,h-9);
}
async function loadRun() {
  try {const response=await fetch('run.json');if(!response.ok)throw Error('record not available');const data=await response.json();if(!data.episodes?.dreamer?.length||!data.training?.length)throw Error('incomplete record');run=data;
    $('training-steps').textContent=run.steps.toLocaleString();$('training-updates').textContent=run.updates.toLocaleString();$('eval-score').textContent=`${run.evaluation.dreamer_mean.toFixed(1)} / 500`;$('random-score').textContent=`${run.evaluation.random_mean.toFixed(1)} / 500`;
    $('run-note').textContent=`${run.episodes.dreamer.length} evaluation episodes per controller, identical starting seeds. Seeded random actions provide a reference, not a statistical significance test. JAX ${run.jax_version} · ${run.platform} · source ${run.commit.slice(0,7)}. Training observations: cart position, velocity, pole angle, and angular velocity.`;
    run.episodes.dreamer.forEach((ep,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Seed ${ep.seed}`;$('episode').append(option);});$('replay-mode').disabled=false;drawChart(run.training);
  } catch(error) {$('run-note').textContent='The training record could not load. You can still use the playground; reload the page to retry the recordings.';console.error(error);}
}
reset();requestAnimationFrame(animate);loadRun();
