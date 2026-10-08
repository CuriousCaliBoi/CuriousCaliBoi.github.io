(() => {
  const root = document.getElementById('perspective-light-studio');
  const svg = root.querySelector('.ps-scene');
  const stage = root.querySelector('.ps-stage');
  const values = root.querySelector('.ps-values');
  const ns = 'http://www.w3.org/2000/svg';
  const defaults = {vp:{x:0.51,y:0.50},light:{x:0.27,y:0.115},depth:3,ambient:0.16,color:'#b4826e',gray:false,guides:true,active:'light'};
  const cubes = [
    {x:0.19,y:0.29,w:0.125,z:5.2},
    {x:0.51,y:0.22,w:0.092,z:6.8},
    {x:0.80,y:0.29,w:0.130,z:5.5},
    {x:0.20,y:0.76,w:0.104,z:6.2},
    {x:0.52,y:0.79,w:0.132,z:5.0},
    {x:0.84,y:0.75,w:0.085,z:7.0}
  ];
  let state = structuredClone(defaults);
  const storageKey = 'zuko:perspective-study:v1';
  let width = 736;
  let height = 435;
  let drag = null;
  let pending = false;
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const finite = (n,a,b,fallback) => typeof n === 'number' && Number.isFinite(n) ? clamp(n,a,b) : fallback;
  const dot = (a,b) => a.reduce((sum,n,i)=>sum+n*b[i],0);
  const sub = (a,b) => a.map((n,i)=>n-b[i]);
  const linear = n => n <= 0.04045 ? n / 12.92 : Math.pow((n+0.055)/1.055,2.4);
  const encoded = n => n <= 0.0031308 ? 12.92*n : 1.055*Math.pow(n,1/2.4)-0.055;
  function restore(saved) {
    const s = saved;
    if (!s) return;
    for (const key of ['vp','light']) {
      state[key] = {x:finite(s[key]?.x,0.065,0.935,defaults[key].x),y:finite(s[key]?.y,0.075,0.90,defaults[key].y)};
    }
    state.depth = finite(s.depth,1,12,defaults.depth);
    state.ambient = finite(s.ambient,0,0.65,defaults.ambient);
    state.color = /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : defaults.color;
    state.gray = typeof s.gray === 'boolean' ? s.gray : defaults.gray;
    state.guides = typeof s.guides === 'boolean' ? s.guides : defaults.guides;
    state.active = s.active === 'vp' ? 'vp' : 'light';
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { /* Browser privacy settings can disable local storage. */ }
  }
  function constrain(point) {
    return {x:clamp(point.x,26/width,1-26/width),y:clamp(point.y,27/height,1-45/height)};
  }
  function announce() {
    root.querySelector('[data-status]').textContent = `Study updated. ${Array.from(values.children,child=>child.textContent).join(', ')}`;
  }
  function selectTarget(key) {
    state.active=key;
    root.querySelectorAll('[data-move]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.move===key)));
    root.querySelector('#move-hint').textContent=`Click or tap the scene to place the ${key==='light'?'light':'vanishing point'}. You can also drag either handle.`;
  }
  function el(tag,attrs={},text='') {
    const node = document.createElementNS(ns,tag);
    Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));
    if (text) node.textContent = text;
    return node;
  }
  function shade(normal,center,lamp,base) {
    const direction = sub(lamp,center);
    const length = Math.hypot(...direction);
    const diffuse = length > 0.00001 ? Math.max(0,dot(normal,direction)/length) : 0;
    const energy = state.ambient+(1-state.ambient)*diffuse;
    const rgb = base.map(n=>n*energy);
    const luminance = dot(rgb,[0.2126,0.7152,0.0722]);
    const gray = Math.round(255*encoded(luminance));
    const channels = state.gray ? [gray,gray,gray] : rgb.map(n=>Math.round(255*encoded(n)));
    return {fill:`rgb(${channels.join(' ')})`,value:Math.round(100*encoded(luminance))};
  }
  function render() {
    pending = false;
    if (stage.clientWidth < 1) return;
    width = stage.clientWidth;
    height = clamp(width*0.60,270,510);
    state.vp = constrain(state.vp);
    state.light = constrain(state.light);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('height',height);
    svg.replaceChildren();
    svg.append(el('title',{},'Floating cube value study'));
    svg.append(el('desc',{},'All receding cube edges converge at the vanishing point. Drag either labeled handle or focus it and use arrow keys. Light depth moves the lamp from the viewer toward the back of the scene. The swatches describe the bottom center cube.'));
    
    const vp = [state.vp.x*width,state.vp.y*height];
    const focal = width*0.72;
    const project = p => [vp[0]+focal*p[0]/p[2],vp[1]+focal*p[1]/p[2]];
    const lamp = [(state.light.x*width-vp[0])*state.depth/focal,(state.light.y*height-vp[1])*state.depth/focal,state.depth];
    const base = [1,3,5].map(i=>linear(parseInt(state.color.slice(i,i+2),16)/255));
    if (state.guides) {
      svg.append(el('line',{x1:1,y1:vp[1],x2:width-1,y2:vp[1],stroke:'var(--foreground)','stroke-opacity':0.14,'stroke-width':1}));
    }
    const faces = [];
    const study = [];
    cubes.forEach((cube,index)=>{
      const side = cube.w*width;
      const x0 = (cube.x*width-side/2-vp[0])*cube.z/focal;
      const y0 = (cube.y*height-side/2-vp[1])*cube.z/focal;
      const s = side*cube.z/focal;
      const x1=x0+s,y1=y0+s,z0=cube.z,z1=z0+s;
      const verts = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      const projected = verts.map(project);
      if (state.guides) {
        const g = el('g',{'data-guides':index,'stroke':'var(--foreground)','stroke-opacity':0.13,'stroke-width':1});
        for (let i=0;i<4;i++) g.append(el('line',{x1:projected[i][0],y1:projected[i][1],x2:vp[0],y2:vp[1]}));
        svg.append(g);
      }
      const definitions = [
        {name:'Front',ids:[0,1,2,3],n:[0,0,-1]},
        {name:'Left',ids:[4,0,3,7],n:[-1,0,0]},
        {name:'Right',ids:[1,5,6,2],n:[1,0,0]},
        {name:'Top',ids:[4,5,1,0],n:[0,-1,0]},
        {name:'Bottom',ids:[3,2,6,7],n:[0,1,0]}
      ];
      definitions.forEach(face=>{
        const center = [0,1,2].map(axis=>face.ids.reduce((sum,i)=>sum+verts[i][axis],0)/4);
        if (dot(face.n,center.map(n=>-n)) <= 0.00001) return;
        const lighting = shade(face.n,center,lamp,base);
        faces.push({...face,...lighting,points:face.ids.map(i=>projected[i].join(',')).join(' '),z:center[2],cube:index});
        if(index===4) study.push({...face,...lighting});
      });
    });
    faces.sort((a,b)=>b.z-a.z).forEach(face=>{
      const polygon = el('polygon',{points:face.points,fill:face.fill,stroke:face.fill,'stroke-width':0.7,'stroke-linejoin':'round','data-cube':face.cube,'data-face':face.name,'data-value':face.value});
      polygon.append(el('title',{},`Cube ${face.cube+1}, ${face.name.toLowerCase()} face: grayscale value ${face.value} of 100`));
      svg.append(polygon);
    });
    for (const key of ['vp','light']) {
      const x=state[key].x*width,y=state[key].y*height;
      const handle = root.querySelector(`[data-handle="${key}"]`);
      handle.style.left=`${x}px`;
      handle.style.top=`${y}px`;
      const name=key==='vp'?'Vanishing point':'Light';
      const labelWidth=key==='vp'?102:34;
      const labelX=clamp(x,labelWidth/2+8,width-labelWidth/2-8);
      const label=el('text',{x:labelX,y:y+38,'text-anchor':'middle',class:'text-small',stroke:'var(--muted)','stroke-width':4,'paint-order':'stroke', 'stroke-linejoin':'round'},name);
      svg.append(label);
    }
    const label = document.createElement('span');
    label.textContent = 'Bottom center cube · value (0–100)';
    values.replaceChildren(label);
    for (const face of study) {
      const item = document.createElement('span');
      item.className='ps-value tabular-nums';
      const swatch=document.createElement('span');
      swatch.className='ps-swatch';
      swatch.style.background=face.fill;
      swatch.setAttribute('aria-hidden','true');
      item.append(swatch,document.createTextNode(`${face.name} ${face.value}`));
      values.append(item);
    }
    const depthLabel = state.depth<5?'in front':state.depth>8.4?'behind':'among cubes';
    root.querySelector('[data-output="depth"]').textContent=`${state.depth.toFixed(1)} · ${depthLabel}`;
    root.querySelector('[data-control="depth"]').setAttribute('aria-valuetext',`${state.depth.toFixed(1)}, ${depthLabel}`);
    root.querySelector('[data-output="ambient"]').textContent=`${Math.round(state.ambient*100)}%`;
  }
  function schedule() { if (!pending) { pending=true; requestAnimationFrame(render); } }
  function sync() {
    root.querySelectorAll('[data-control]').forEach(input=>{
      const key=input.dataset.control;
      if(input.type==='checkbox') input.checked=state[key];
      else input.value=state[key];
    });
    schedule();
  }
  root.querySelectorAll('[data-control]').forEach(input=>{
    input.addEventListener('input',()=>{
      state[input.dataset.control]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
      schedule();
    });
    input.addEventListener('change',()=>{
      render();
      save();
      announce();
    });
  });
  root.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('click',()=>{ selectTarget(button.dataset.move); save(); });
  });
  function movePointer(event) {
    const rect=stage.getBoundingClientRect();
    state[drag.key]=constrain({x:(event.clientX-rect.left)/rect.width-drag.dx,y:(event.clientY-rect.top)/rect.height-drag.dy});
    schedule();
  }
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0 || drag) return;
    const handle=event.target.closest('[data-handle]');
    const key=handle?.dataset.handle || state.active;
    const rect=stage.getBoundingClientRect();
    selectTarget(key);
    drag={key,id:event.pointerId,dx:handle?(event.clientX-rect.left)/rect.width-state[key].x:0,dy:handle?(event.clientY-rect.top)/rect.height-state[key].y:0};
    stage.setPointerCapture(event.pointerId);
    if(handle) handle.focus({preventScroll:true});
    else movePointer(event);
    event.preventDefault();
  });
  stage.addEventListener('pointermove',event=>{
    if(drag && drag.id===event.pointerId) { movePointer(event); event.preventDefault(); }
  });
  function finishDrag(event) {
    if(!drag || drag.id!==event.pointerId) return;
    if(event.type==='pointerup') movePointer(event);
    drag=null;
    if(stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    render();
    save();
    announce();
  }
  stage.addEventListener('pointerup',finishDrag);
  stage.addEventListener('pointercancel',finishDrag);
  stage.addEventListener('lostpointercapture',finishDrag);
  root.querySelectorAll('[data-handle]').forEach(button=>{
    button.addEventListener('click',()=>selectTarget(button.dataset.handle));
    button.addEventListener('keydown',event=>{
      const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(!offsets[event.key]) return;
      event.preventDefault();
      const key=button.dataset.handle;
      const step=event.shiftKey?0.04:0.01;
      selectTarget(key);
      state[key]=constrain({x:state[key].x+offsets[event.key][0]*step,y:state[key].y+offsets[event.key][1]*step});
      render();
      save();
    });
    button.addEventListener('keyup',event=>{ if(event.key.startsWith('Arrow')) announce(); });
  });
  try { restore(JSON.parse(localStorage.getItem(storageKey))); }
  catch { /* Corrupt or unavailable saved preferences must not block the study. */ }
  new ResizeObserver(schedule).observe(stage);
  selectTarget(state.active);
  sync();
})();
