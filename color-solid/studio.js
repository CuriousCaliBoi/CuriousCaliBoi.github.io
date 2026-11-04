const $ = selector => document.querySelector(selector);
const canvas = $('#solid');
const ctx = canvas.getContext('2d');
const scene = $('#scene');
const explorer = $('#explorer');
const status = $('#status');
const hueSelect = $('#hue');
const valueInput = $('#value');
const tooltip = $('#hover');
const names = ['Red-purple', 'Red', 'Orange', 'Yellow', 'Yellow-green', 'Green', 'Blue-green', 'Cyan', 'Blue-cyan', 'Blue', 'Blue-violet', 'Purple'];
const state = { mode:'solid', hue:90, value:90, yaw:-.65, pitch:.24, zoom:1.1, guides:true, context:true, screen:true, spin:false };
const boundary = new Map();
const boundaryRows = [];
let samples = [], selected, projected = [], width = 0, height = 0, frame = 0, previousTime = 0, hovered = null;
const pointers = new Map();
let gesture = null;

function hueName(hue) { return names[Math.round(Number(hue)/30)%12]; }
function limits(h,v) { return boundary.get(`${Number(h)},${v}`); }
function inverseF(t) { return t>6/29 ? t**3 : 3*(6/29)**2*(t-4/29); }
function screenColor(h,v,c) {
  const angle=h*Math.PI/180, fy=(v+16)/116;
  const X=(.3127/.329)*inverseF(fy+c*Math.cos(angle)/500);
  const Y=inverseF(fy), Z=((1-.3127-.329)/.329)*inverseF(fy-c*Math.sin(angle)/200);
  const rgb=[3.2409699419*X-1.5373831776*Y-.4986107603*Z,-.9692436363*X+1.8759675015*Y+.0415550574*Z,.0556300797*X-.2039769589*Y+1.0569715142*Z];
  return '#'+rgb.map(n=>Math.round(255*Math.min(1,Math.max(0,n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055))).toString(16).padStart(2,'0')).join('');
}
function gray(v) {return screenColor(0,v,0);}
function position(angle,chroma,value) {return {x:chroma/10*Math.cos(angle),y:(value-50)*.35,z:chroma/10*Math.sin(angle)};}
function makeSample(h,v,c) {
  h=Number(h);
  const cap=limits(h,v);
  c=Math.max(0,Math.min(c,cap.surface));
  const outside=c>cap.screen+.0001;
  return {h,v,c,a:h*Math.PI/180,edge:Math.abs(c-cap.surface)<.001,outside,
    color:screenColor(h,v,outside?cap.screen*.995:c),pos:position(h*Math.PI/180,c,v)};
}
function project(point) {
  const x=point.x*Math.cos(state.yaw)-point.z*Math.sin(state.yaw);
  const z=point.x*Math.sin(state.yaw)+point.z*Math.cos(state.yaw);
  const y=point.y*Math.cos(state.pitch)-z*Math.sin(state.pitch);
  const depth=point.y*Math.sin(state.pitch)+z*Math.cos(state.pitch);
  const perspective=78/(78+depth);
  const scale=Math.min(width*.40/19.5,(height-155)*.46/18)*state.zoom;
  return {x:width/2+x*scale*perspective,y:height*.51-y*scale*perspective,depth,scale:scale*perspective};
}
function active(sample) {return state.mode==='solid'||(state.mode==='hue'?sample.h===state.hue:sample.v===state.value);}
function path(points,color,lineWidth=1,close=false,fill=null) {
  ctx.beginPath();
  points.forEach((point,index)=>{const p=project(point);index?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});
  if(close)ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();
}
function label(point,text,align='center',dy=0) {
  const p=project(point);
  if(p.x<24||p.x>width-24||p.y<90||p.y>height-85)return;
  ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle='#b9bdbc';ctx.font='11px Inter, system-ui, sans-serif';ctx.fillText(text,p.x,p.y+dy);
}
function outline(kind,color) {
  if(state.mode==='hue') {
    const a=state.hue*Math.PI/180;
    const points=[position(a,0,0),...boundaryRows.filter(d=>d.h===state.hue).map(d=>position(a,d[kind],d.v)),position(a,0,100)];
    path(points,color,kind==='surface'?1.4:1.2,true);
  } else {
    for(let v=5;v<100;v+=5) {
      if(state.mode==='value'&&v!==state.value)continue;
      if(state.mode==='solid'&&kind==='screen'&&v%10!==0)continue;
      path(boundaryRows.filter(d=>d.v===v).map(d=>position(d.h*Math.PI/180,d[kind],v)),color,kind==='surface'?1:1.1,true);
    }
  }
}
function render() {
  ctx.clearRect(0,0,width,height);projected=[];
  if(!samples.length)return;
  if(state.guides) {
    path(Array.from({length:73},(_,i)=>position(i*Math.PI/36,195,0)),'#ffffff12');
    if(width>600&&state.mode==='solid')for(const h of [30,90,150,210,270,330])label(position(h*Math.PI/180,205,0),hueName(h));
    path([position(0,0,0),position(0,0,100)],'#ffffff65');
    label(position(0,0,100),'L* 100 · white','center',-16);label(position(0,0,0),'L* 0 · black','center',18);
  }
  outline('surface',state.mode==='solid'?'#ffffff19':'#ffffff70');
  const points=samples.map(sample=>({...project(sample.pos),sample})).sort((a,b)=>b.depth-a.depth);
  for(const point of points) {
    const included=active(point.sample);
    if(!included&&!state.context)continue;
    if(point.x<-15||point.x>width+15||point.y<-15||point.y>height+15)continue;
    const radius=Math.max(1.8,Math.min(7,point.scale*(point.sample.edge?.42:.34)));
    ctx.globalAlpha=included?1:.035;ctx.fillStyle=point.sample.color;
    ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();
    if(included)projected.push({...point,radius});
  }
  ctx.globalAlpha=1;
  if(state.screen){ctx.setLineDash([4,5]);outline('screen',state.mode==='solid'?'#ffffff50':'#ffffffb0');ctx.setLineDash([]);}
  if(state.guides)for(let v=0;v<=100;v+=10){const p=project(position(0,0,v));const size=Math.max(3,Math.min(8,p.scale*.5));ctx.fillStyle=gray(v);ctx.fillRect(p.x-size/2,p.y-size/2,size,size);}
  for(const sample of [hovered,selected]) {
    if(!sample||!active(sample))continue;
    const p=project(sample.pos),radius=Math.max(2.3,Math.min(8.5,p.scale*.48));
    ctx.fillStyle=sample.color;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=sample===selected?'#f8f5e9':'#f8f5e980';ctx.lineWidth=sample===selected?1.8:1;
    ctx.beginPath();ctx.arc(p.x,p.y,radius+4,0,Math.PI*2);ctx.stroke();
  }
}
function invalidate() {
  if(frame)return;
  frame=requestAnimationFrame(time=>{frame=0;if(state.spin&&!document.hidden)state.yaw+=Math.min(40,previousTime?time-previousTime:16)*.00013;previousTime=time;render();if(state.spin&&!document.hidden)invalidate();});
}
function resize() {
  const box=scene.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  width=box.width;height=box.height;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);invalidate();
}
function updateMode() {
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)));
  $('#scene-title').textContent=state.mode==='solid'?'The surface-color solid':state.mode==='hue'?`${hueName(state.hue)} · hue ${state.hue}°`:`Lightness L* ${state.value} · horizontal slice`;
  $('#scene-subtitle').textContent=state.mode==='solid'?'D65 daylight · ideal reflectances · CIE 1931 observer':state.mode==='hue'?'One hue · varying lightness and chroma':'One lightness · varying hue and chroma';
  $('#sample-count').textContent='CIELAB coordinates';$('#context').disabled=state.mode==='solid';tooltip.hidden=true;hovered=null;invalidate();
}
function updateSelected() {
  const d=selected,cap=limits(d.h,d.v),name=d.c<.001?'Neutral gray':hueName(d.h);
  $('#selected-swatch').style.background=d.color;
  $('#selected-swatch').setAttribute('aria-label',`${name}, lightness ${d.v}, chroma ${d.c.toFixed(1)}${d.outside?'; screen approximation':''}`);
  $('#selected-name').textContent=name;$('#selected-notation').textContent=d.edge?'Surface limit':'CIELAB';
  $('#coord-hue').textContent=d.c<.001?'—':`${d.h}°`;$('#coord-value').textContent=d.v;$('#coord-chroma').textContent=d.c.toFixed(1);
  $('#display-note').textContent=d.outside?'Outside sRGB · swatch chroma reduced for display':'Within sRGB · approximate screen appearance';
  $('#chroma').max=cap.surface;$('#chroma').value=d.c;$('#chroma-output').textContent=d.c.toFixed(1);
  $('#limit-note').textContent=`For this hue page and L*: surface limit ≈ ${cap.surface.toFixed(1)} C*. sRGB limit ≈ ${cap.screen.toFixed(1)} C*.`;
  status.textContent=`Selected hue ${d.h}°, L* ${d.v}, C* ${d.c.toFixed(1)}${d.outside?'; outside sRGB':''}.`;
}
function buildHuePage() {
  const page=$('#hue-page'),restoreFocus=page.contains(document.activeElement);page.replaceChildren();
  $('#page-title').textContent=`${hueName(state.hue)} hue page`;
  const tick=(value,cls='')=>{const el=document.createElement('span');el.className=`tick ${cls}`;el.textContent=value;return el;};
  page.append(tick('L*↑','axis-tick'));for(let c=0;c<=180;c+=30)page.append(tick(c));page.append(tick('Edge'));
  for(let v=90;v>=10;v-=10) {
    page.append(tick(v,'axis-tick'));
    const cap=limits(state.hue,v);
    for(const c of [...Array.from({length:7},(_,i)=>i*30),cap.surface]) {
      if(c>cap.surface+.001){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');page.append(blank);continue;}
      const sample=makeSample(state.hue,v,c),button=document.createElement('button');
      button.type='button';button.className=`chip${sample.outside?' beyond-screen':''}${sample.edge?' edge-chip':''}`;button.style.background=sample.color;
      const description=`Hue ${sample.h}°, L* ${sample.v}, C* ${sample.c.toFixed(1)}${sample.edge?', surface limit':''}${sample.outside?', outside sRGB':''}`;
      button.setAttribute('aria-label',description);button.title=description;
      button.setAttribute('aria-pressed',String(sample.h===selected.h&&sample.v===selected.v&&Math.abs(sample.c-selected.c)<.01));
      if(sample.edge)button.textContent=sample.c.toFixed(0);
      button.style.color=v>60?'#171917':'#fff';button.addEventListener('click',()=>selectSample(sample,false));page.append(button);
    }
  }
  const peak=boundaryRows.filter(d=>d.h===state.hue).reduce((best,d)=>d.surface>best.surface?d:best);
  $('#page-note').textContent=`Peak on the 5-L* grid: C* ${peak.surface.toFixed(1)} at L* ${peak.v}. Blank = beyond the surface limit. Corner mark = beyond sRGB. Edge numbers are C*.`;
  if(restoreFocus)page.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
}
function selectSample(sample,syncHue=true) {
  selected=sample;if(syncHue)state.hue=sample.h;
  state.value=sample.v;valueInput.value=state.value;$('#value-output').textContent=state.value;
  hueSelect.value=state.hue;$('#hue-name').textContent=`${hueName(state.hue)} · ${state.hue}°`;
  updateSelected();buildHuePage();updateMode();
}
function setHue(hue,preset=false) {
  state.mode='hue';state.hue=Number(hue);
  const v=preset?({40:40,90:90,300:35}[state.hue]):selected.v;
  selectSample(makeSample(state.hue,v,preset?limits(state.hue,v).surface:selected.c));
  if(preset){state.yaw=-selected.a;state.pitch=.12;state.zoom=1.1;setSpin(false);}invalidate();
}

function setSpin(spin) {
  state.spin=spin;$('#spin').setAttribute('aria-pressed',String(spin));previousTime=0;invalidate();
}

function zoom(factor) {state.zoom=Math.min(2.4,Math.max(.55,state.zoom*factor));tooltip.hidden=true;invalidate();}
function reset() {state.yaw=-.65;state.pitch=.24;state.zoom=1.1;setSpin(false);invalidate();}
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
    if(sample){tooltip.textContent=`${sample.h}° · L* ${sample.v} · C* ${sample.c.toFixed(1)}`;tooltip.style.left=`${Math.max(8,Math.min(width-220,p.x+15))}px`;tooltip.style.top=`${Math.max(8,Math.min(height-70,p.y-38))}px`;}
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
valueInput.addEventListener('input',()=>{state.mode='value';selectSample(makeSample(state.hue,Number(valueInput.value),selected.c));});
$('#chroma').addEventListener('input',event=>selectSample(makeSample(state.hue,state.value,Number(event.target.value))));
$('#screen-gamut').addEventListener('change',event=>{state.screen=event.target.checked;invalidate();});
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
  const controls=Array.from(explorer.querySelectorAll('button, input, select'));controls.forEach(el=>el.disabled=true);
  try {
    const response=await fetch('./surface-solid.json');
    if(!response.ok)throw new Error(`Data request failed (${response.status})`);
    const data=await response.json();
    for(const [h,v,surface,screen] of data.boundaries){boundary.set(`${h},${v}`,{surface,screen});boundaryRows.push({h,v,surface,screen});}
    for(const d of boundaryRows){for(let c=30;c<d.surface-.01;c+=30)samples.push(makeSample(d.h,d.v,c));samples.push(makeSample(d.h,d.v,d.surface));}
    for(let h=0;h<360;h+=10){const option=document.createElement('option');option.value=h;option.textContent=`${hueName(h)} · ${h}°`;hueSelect.append(option);}
    controls.forEach(el=>el.disabled=false);
    selectSample(makeSample(90,90,limits(90,90).surface));status.textContent='Pick a color or change its chroma. Dashed lines show sRGB.';resize();
  }catch(error){status.textContent='The color data could not load. Reload the page to try again; source links are below.';console.error(error);}
}
init();
