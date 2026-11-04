const $ = selector => document.querySelector(selector);
const canvas = $('#solid');
const ctx = canvas.getContext('2d');
const scene = $('#scene');
const explorer = $('#explorer');
const status = $('#status');
const hueSelect = $('#hue');
const valueInput = $('#value');
const tooltip = $('#hover');
const families = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
const names = ['Red', 'Orange', 'Yellow', 'Yellow-green', 'Green', 'Blue-green', 'Blue', 'Blue-violet', 'Purple', 'Red-purple'];
const state = { mode:'solid', hue:'5Y', value:5, yaw:-.65, pitch:.24, zoom:1.25, guides:true, context:true, spin:false };
let samples = [], selected, projected = [], width = 0, height = 0, frame = 0, previousTime = 0, hovered = null;
const pointers = new Map();
let gesture = null;

function hueName(hue) {
  return names[families.indexOf(hue.replace(/[\d.]/g, ''))];
}

function gray(value) {
  const v = value;
  const Y = Math.min(1, Math.max(0, .975 * (1.2219*v - .23111*v*v + .23951*v**3 - .021009*v**4 + .0008404*v**5) / 100));
  const n = Math.round(255 * (Y <= .0031308 ? 12.92*Y : 1.055*Y**(1/2.4)-.055));
  return `rgb(${n},${n},${n})`;
}

function position(angle, chroma, value) {
  return { x:chroma*Math.cos(angle), y:(value-5)*3.5, z:chroma*Math.sin(angle) };
}

function project(point) {
  const x = point.x*Math.cos(state.yaw)-point.z*Math.sin(state.yaw);
  const z = point.x*Math.sin(state.yaw)+point.z*Math.cos(state.yaw);
  const y = point.y*Math.cos(state.pitch)-z*Math.sin(state.pitch);
  const depth = point.y*Math.sin(state.pitch)+z*Math.cos(state.pitch);
  const perspective = 78/(78+depth);
  const scale = Math.min(width*.40/17, (height-155)*.46/18)*state.zoom;
  return { x:width/2+x*scale*perspective, y:height*.51-y*scale*perspective, depth, scale:scale*perspective };
}

function active(sample) {
  return state.mode==='solid' || (state.mode==='hue' ? sample.h===state.hue : sample.v===state.value);
}

function path(points, color, lineWidth=1, close=false, fill=null) {
  ctx.beginPath();
  points.forEach((point,index) => { const p=project(point); index ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y); });
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle=fill; ctx.fill(); }
  ctx.strokeStyle=color; ctx.lineWidth=lineWidth; ctx.stroke();
}

function label(point, text, align='center', dy=0) {
  const p=project(point);
  if (p.x<24 || p.x>width-24 || p.y<90 || p.y>height-85) return;
  ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle='#b9bdbc';ctx.font='11px Inter, system-ui, sans-serif';
  ctx.fillText(text,p.x,p.y+dy);
}

function render() {
  ctx.clearRect(0,0,width,height);
  projected=[];
  if (!samples.length) return;
  if (state.guides) {
    const circle=Array.from({length:81},(_,i)=>position(i*Math.PI/40,16,0));
    path(circle,'#ffffff16');
    for (let i=0;i<10;i++) path([position(0,0,0),position((i*10+5)*Math.PI/50,16,0)],'#ffffff0b');
    for (let i=0;i<10;i+=2) label(position((i*10+5)*Math.PI/50,18,0),names[i]);
    path([position(0,0,0),position(0,0,10)],'#ffffff65');
    label(position(0,0,10),'10 · light', 'center', -16);
    label(position(0,0,0),'0 · dark', 'center', 18);
    if(state.mode==='solid') {
      for (let v=2;v<=8;v++) {
        const edge=[];
        for(const h of hueSelect.options) {
          const row=samples.filter(d=>d.h===h.value&&d.v===v);
          if(row.length) edge.push(row[row.length-1]);
        }
        path(edge.map(d=>d.pos),'#ffffff12',1,true);
      }
    }
  }
  if (state.mode==='hue') {
    const angle=samples.find(d=>d.h===state.hue).a;
    path([position(angle,0,1.4),position(angle,15.4,1.4),position(angle,15.4,8.6),position(angle,0,8.6)],'#ffffff28',1,true,'#ffffff04');
  } else if (state.mode==='value') {
    const ring=Array.from({length:81},(_,i)=>position(i*Math.PI/40,15.5,state.value));
    path(ring,'#ffffff30',1,true,'#ffffff05');
  }
  const points=samples.map(sample=>({...project(sample.pos),sample})).sort((a,b)=>b.depth-a.depth);
  for (const point of points) {
    const included=active(point.sample);
    if (!included&&!state.context) continue;
    if (point.x<-15||point.x>width+15||point.y<-15||point.y>height+15) continue;
    const radius=Math.max(2.3,Math.min(8.5,point.scale*.48));
    ctx.globalAlpha=included?1:.065;
    ctx.fillStyle=point.sample.color;
    ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();
    if(included) projected.push({...point,radius});
  }
  ctx.globalAlpha=1;
  if (state.guides) {
    for(let v=0;v<=10;v++) {
      const p=project(position(0,0,v));
      const size=Math.max(3,Math.min(8,p.scale*.5));
      ctx.fillStyle=gray(v);ctx.fillRect(p.x-size/2,p.y-size/2,size,size);
    }
  }
  for(const sample of [hovered,selected]) {
    if(!sample||!active(sample)) continue;
    const p=project(sample.pos),radius=Math.max(2.3,Math.min(8.5,p.scale*.48));
    ctx.strokeStyle=sample===selected?'#f8f5e9':'#f8f5e980';ctx.lineWidth=sample===selected?1.8:1;
    ctx.beginPath();ctx.arc(p.x,p.y,radius+4,0,Math.PI*2);ctx.stroke();
  }
}

function invalidate() {
  if(frame) return;
  frame=requestAnimationFrame(time=>{
    frame=0;
    if(state.spin&&!document.hidden) state.yaw+=Math.min(40,previousTime?time-previousTime:16)*.00013;
    previousTime=time;
    render();
    if(state.spin&&!document.hidden) invalidate();
  });
}

function resize() {
  const box=scene.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  width=box.width;height=box.height;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  invalidate();
}

function updateMode() {
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)));
  const count=samples.filter(active).length;
  $('#scene-title').textContent=state.mode==='solid'?'The Munsell sample solid':state.mode==='hue'?`${hueName(state.hue)} · ${state.hue}`:`Value ${state.value} · a horizontal slice`;
  $('#scene-subtitle').textContent=state.mode==='solid'?'956 colors · 40 hues · value 2–8':state.mode==='hue'?'One hue · varying value and chroma':'One value · varying hue and chroma';
  $('#sample-count').textContent=`${count} ${state.mode==='solid'?'samples':'samples in slice'}`;
  $('#context').disabled=state.mode==='solid';
  tooltip.hidden=true;hovered=null;invalidate();
}

function updateSelected() {
  const d=selected;
  $('#selected-swatch').style.background=d.color;
  $('#selected-swatch').setAttribute('aria-label',`${hueName(d.h)}, Munsell ${d.h} ${d.v}/${d.c}`);
  $('#selected-name').textContent=hueName(d.h);
  $('#selected-notation').textContent=`${d.h} ${d.v}/${d.c}`;
  $('#coord-hue').textContent=d.h;$('#coord-value').textContent=d.v;$('#coord-chroma').textContent=d.c;
  $('#display-note').textContent=`${d.color.toUpperCase()} · ${d.clipped?'outside sRGB; display clipped':'approximate screen color'}`;
  status.textContent=`Selected ${d.h}: value ${d.v}, chroma ${d.c}.`;
}

function buildHuePage() {
  const page=$('#hue-page');
  const restoreFocus=page.contains(document.activeElement);
  page.replaceChildren();
  $('#page-title').textContent=`${hueName(state.hue)} hue page`;
  const tick=(value,cls='')=>{const el=document.createElement('span');el.className=`tick ${cls}`;el.textContent=value;return el;};
  page.append(tick('V↑','axis-tick'));
  for(let c=0;c<=14;c+=2)page.append(tick(c));
  for(let v=8;v>=2;v--) {
    page.append(tick(v,'axis-tick'));
    const neutral=document.createElement('span');neutral.className='neutral';neutral.style.background=gray(v);neutral.setAttribute('aria-label',`Neutral gray, value ${v}`);page.append(neutral);
    for(let c=2;c<=14;c+=2) {
      const sample=samples.find(d=>d.h===state.hue&&d.v===v&&d.c===c);
      if(!sample) {const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');page.append(blank);continue;}
      const button=document.createElement('button');button.type='button';button.className='chip';button.style.background=sample.color;
      const description=`${sample.h}: value ${sample.v}, chroma ${sample.c}`;
      button.setAttribute('aria-label',description);button.title=description;button.setAttribute('aria-pressed',String(sample===selected));
      button.addEventListener('click',()=>selectSample(sample,false));
      page.append(button);
    }
  }
  const hues=samples.filter(d=>d.h===state.hue);
  const maximum=Math.max(...hues.map(d=>d.c));
  const peaks=hues.filter(d=>d.c===maximum).map(d=>d.v);
  $('#page-note').textContent=`Highest sampled chroma: ${maximum}, at value ${peaks.join(' and ')}. Blank spaces are unsampled.`;
  if(restoreFocus)page.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
}

function selectSample(sample,syncHue=true) {
  selected=sample;
  if(syncHue)state.hue=sample.h;
  state.value=sample.v;valueInput.value=state.value;$('#value-output').textContent=state.value;
  hueSelect.value=state.hue;$('#hue-name').textContent=`${hueName(state.hue)} · ${state.hue}`;
  updateSelected();buildHuePage();updateMode();
}

function nearest(hue,value,chroma) {
  return samples.filter(d=>d.h===hue).reduce((best,d)=>{
    const score=p=>Math.abs(p.v-value)*20+Math.abs(p.c-chroma);
    return !best||score(d)<score(best)?d:best;
  },null);
}

function setHue(hue,preset=false) {
  state.mode='hue';state.hue=hue;
  selectSample(nearest(hue,preset?(hue==='5Y'?8:3):selected.v,preset?12:selected.c));
  if(preset) {state.yaw=-selected.a;state.pitch=.12;state.zoom=1;setSpin(false);}
  invalidate();
}

function setSpin(spin) {
  state.spin=spin;$('#spin').setAttribute('aria-pressed',String(spin));previousTime=0;invalidate();
}

function zoom(factor) {state.zoom=Math.min(2.4,Math.max(.55,state.zoom*factor));tooltip.hidden=true;invalidate();}
function reset() {state.yaw=-.65;state.pitch=.24;state.zoom=1.25;setSpin(false);invalidate();}
function local(event) {const box=canvas.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top};}
function pick(x,y) {
  let found=null,best=Infinity;
  for(let i=projected.length-1;i>=0;i--) {
    const p=projected[i],distance=Math.hypot(p.x-x,p.y-y);
    if(distance<=Math.max(12,p.radius+4)&&distance<best){found=p.sample;best=distance;}
  }
  return found;
}

canvas.addEventListener('pointerdown',event=>{
  canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);setSpin(false);
  pointers.set(event.pointerId,local(event));
  const points=Array.from(pointers.values());
  gesture={x:points[0].x,y:points[0].y,yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,moved:points.length>1,distance:points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0};
  tooltip.hidden=true;
});
canvas.addEventListener('pointermove',event=>{
  const p=local(event);
  if(!pointers.has(event.pointerId)) {
    const sample=pick(p.x,p.y);
    if(hovered!==sample){hovered=sample;invalidate();}
    tooltip.hidden=!sample;
    if(sample){tooltip.textContent=`${sample.h} · value ${sample.v} · chroma ${sample.c}`;tooltip.style.left=`${Math.max(8,Math.min(width-220,p.x+15))}px`;tooltip.style.top=`${Math.max(8,Math.min(height-70,p.y-38))}px`;}
    return;
  }
  pointers.set(event.pointerId,p);
  const points=Array.from(pointers.values());
  if(points.length>1) {
    const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
    if(gesture.distance>0)state.zoom=Math.min(2.4,Math.max(.55,gesture.zoom*distance/gesture.distance));
    gesture.moved=true;
  } else {
    const dx=p.x-gesture.x,dy=p.y-gesture.y;
    if(Math.hypot(dx,dy)>5)gesture.moved=true;
    state.yaw=gesture.yaw+dx*.007;
    state.pitch=Math.min(1.25,Math.max(-1.25,gesture.pitch+dy*.006));
  }
  invalidate();
});
function release(event,cancelled=false) {
  if(!pointers.has(event.pointerId))return;
  const p=local(event),wasClick=gesture&&!gesture.moved&&pointers.size===1;
  pointers.delete(event.pointerId);
  if(!cancelled&&wasClick){const sample=pick(p.x,p.y);if(sample)selectSample(sample);}
  if(pointers.size) {
    const remaining=Array.from(pointers.values())[0];
    gesture={x:remaining.x,y:remaining.y,yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,moved:true,distance:0};
  } else gesture=null;
}
canvas.addEventListener('pointerup',event=>release(event));
canvas.addEventListener('pointercancel',event=>release(event,true));
canvas.addEventListener('pointerleave',()=>{if(!pointers.size){hovered=null;tooltip.hidden=true;invalidate();}});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-Math.max(-120,Math.min(120,event.deltaY))*.0018));},{passive:false});
canvas.addEventListener('keydown',event=>{
  const actions={ArrowLeft:()=>{state.yaw-=.12;},ArrowRight:()=>{state.yaw+=.12;},ArrowUp:()=>{state.pitch=Math.max(-1.25,state.pitch-.1);},ArrowDown:()=>{state.pitch=Math.min(1.25,state.pitch+.1);},'+':()=>zoom(1.12),'=':()=>zoom(1.12),'-':()=>zoom(1/1.12),r:reset,R:reset};
  if(actions[event.key]){event.preventDefault();setSpin(false);actions[event.key]();invalidate();}
});

document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{state.mode=button.dataset.mode;updateMode();}));
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>setHue(button.dataset.preset,true)));
hueSelect.addEventListener('change',()=>setHue(hueSelect.value));
valueInput.addEventListener('input',()=>{state.mode='value';selectSample(nearest(state.hue,Number(valueInput.value),selected.c));});
$('#guides').addEventListener('change',event=>{state.guides=event.target.checked;invalidate();});
$('#context').addEventListener('change',event=>{state.context=event.target.checked;invalidate();});
$('#zoom-in').addEventListener('click',()=>zoom(1.18));$('#zoom-out').addEventListener('click',()=>zoom(1/1.18));
$('#spin').addEventListener('click',()=>setSpin(!state.spin));$('#reset').addEventListener('click',reset);

function expanded() {return document.fullscreenElement===explorer||explorer.classList.contains('expanded');}
function syncFullscreen() {$('#fullscreen').textContent=expanded()?'Exit fullscreen ↙':'Fullscreen ↗';resize();}
function fallbackFullscreen() {explorer.classList.toggle('expanded');document.body.classList.toggle('has-expanded',explorer.classList.contains('expanded'));syncFullscreen();}
$('#fullscreen').addEventListener('click',async()=>{
  if(document.fullscreenElement===explorer)await document.exitFullscreen();
  else if(explorer.classList.contains('expanded'))fallbackFullscreen();
  else if(document.fullscreenEnabled){try{await explorer.requestFullscreen();}catch{fallbackFullscreen();}}
  else fallbackFullscreen();
});
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&explorer.classList.contains('expanded'))fallbackFullscreen();});
document.addEventListener('visibilitychange',()=>{previousTime=0;if(!document.hidden)invalidate();});
new ResizeObserver(resize).observe(scene);

async function init() {
  const controls=Array.from(explorer.querySelectorAll('button, input, select'));
  controls.forEach(el=>el.disabled=true);
  try {
    const response=await fetch('./munsell.json');
    if(!response.ok)throw new Error(`Data request failed (${response.status})`);
    const data=await response.json();
    samples=data.samples.map(([h,v,c,angle,color,clipped])=>({h,v,c,a:angle*Math.PI/180,color,clipped,pos:position(angle*Math.PI/180,c,v)}));
    const hues=Array.from(new Set(samples.map(d=>d.h))).sort((a,b)=>samples.find(d=>d.h===a).a-samples.find(d=>d.h===b).a);
    hues.forEach(hue=>{const option=document.createElement('option');option.value=hue;option.textContent=`${hueName(hue)} · ${hue}`;hueSelect.append(option);});
    controls.forEach(el=>el.disabled=false);
    selectSample(samples.find(d=>d.h==='5Y'&&d.v===8&&d.c===12));
    state.value=5;valueInput.value=5;$('#value-output').textContent='5';
    status.textContent='Pick a color in the solid or the hue page.';
    resize();
  } catch(error) {
    status.textContent='The color data could not load. Reload the page to try again; reference links are below.';
    console.error(error);
  }
}
init();
