(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('screen'), ctx = canvas.getContext('2d');
  const keymap = {ArrowLeft:1,KeyA:1,ArrowRight:2,KeyD:2,ArrowUp:3,KeyW:3,ArrowDown:4,KeyS:4,Space:5,KeyQ:0,KeyZ:6,KeyR:7,KeyT:8,KeyF:9,KeyP:10,Digit1:11,Digit2:12,Digit3:13,Digit4:14,Digit5:15,Digit6:16};
  const names = ['Wait','Left','Right','Up','Down','Interact','Sleep','Place stone','Place table','Place furnace','Plant','Wood pickaxe','Stone pickaxe','Iron pickaxe','Wood sword','Stone sword','Iron sword'];
  const sessionKey = 'craftax-play-session-v1';
  let api, token = null, state = null, active = false, busy = false, held = null, starting = false, downloadBusy = false;
  let imageRevision = 0, lastTick = 0;
  const playDialog = $('play-dialog'), playArea = $('play-area');
  const sessionTools = document.querySelector('.session-tools');
  const playHome = document.createComment('game position'), toolsHome = document.createComment('session tools position');
  playArea.before(playHome); sessionTools.before(toolsHome);
  try { token = sessionStorage.getItem(sessionKey); } catch (_) {}
  const storeToken = value => { token = value; try { if(value) sessionStorage.setItem(sessionKey,value); else sessionStorage.removeItem(sessionKey); } catch (_) {} };
  const title = value => value.replaceAll('_',' ').replace(/^./, c=>c.toUpperCase());
  const tell = (text, error=false) => { $('message').textContent=text; $('message').classList.toggle('error',error); };
  const connection = (text, live=false) => { $('connection').textContent=text; $('connection').classList.toggle('live',live); };
  const announce = (value,message) => { if(window.parent!==window) window.parent.postMessage({type:'zuko:experiment-status',state:value,message},location.origin); };
  const stopHeld = () => { held=null; document.querySelectorAll('.is-held').forEach(b=>b.classList.remove('is-held')); };
  function craftReason(action) {
    if(!state)return '';
    const inv=state.inventory;
    if(action===8 && inv.wood<2)return `A table needs 2 wood. You have ${inv.wood}. Face a tree and use Gather wood.`;
    if([11,12].includes(action)){
      if(inv.wood<1)return 'Collect 1 wood from a tree first.';
      if(action===12 && inv.stone<1)return 'Collect 1 stone with your wooden pickaxe first.';
      if(state.interaction && !state.interaction.near_table)return 'Stand next to a crafting table first. Place one with 2 wood.';
    }
    return '';
  }
  function positionTarget() {
    const target=$('target-tile');
    if(!state?.interaction){target.hidden=true;return;}
    const bounds=canvas.getBoundingClientRect();
    const scale=Math.min(bounds.width/144,bounds.height/112);
    const [dx,dy]=({1:[-1,0],2:[1,0],3:[0,-1],4:[0,1]})[state.interaction.direction] || [0,0];
    target.hidden=false;
    target.style.width=target.style.height=`${16*scale}px`;
    target.style.left=`${(bounds.width-144*scale)/2+(4+dx)*16*scale}px`;
    target.style.top=`${(bounds.height-112*scale)/2+(3+dy)*16*scale}px`;
  }
  new ResizeObserver(positionTarget).observe($('game'));
  function showControls(show) {
    stopHeld();
    playArea.classList.toggle('controls-open', show);
    $('toggle-controls').setAttribute('aria-expanded', String(show));
    $('toggle-controls').textContent=show?'Hide controls':'Controls & pack';
    $('game').focus({preventScroll:true});
  }
  function openPlayView() {
    if(playDialog.open)return;
    playDialog.append(playArea);
    $('play-sidebar').append(sessionTools);
    document.body.classList.add('play-open');
    playDialog.showModal();
    showControls(false);
  }
  async function leavePlayView() {
    pause(); stopHeld();
    if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    playDialog.close();
    playHome.after(playArea); toolsHome.after(sessionTools);
    playArea.classList.remove('controls-open');
    document.body.classList.remove('play-open');
    $('expand').focus({preventScroll:true});
  }
  async function fullscreen() {
    openPlayView(); stopHeld();
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await playArea.requestFullscreen();
      $('game').focus({preventScroll:true});
    } catch (_) { tell('Full-page play is ready. This browser doesn’t support going further into full screen.'); }
  }
  function cover(kicker, heading, text, button) {
    $('cover').hidden=false; $('cover-kicker').textContent=kicker; $('cover-title').textContent=heading;
    $('cover-text').textContent=text; $('start').textContent=button; $('start').disabled=false;
  }
  function pause() {
    if(!state || state.done || !active) return;
    active=false; stopHeld(); $('pause').textContent='Resume';
    cover('TAKE YOUR TIME','Your world can wait.','Nothing advances while you’re paused.','Resume playing →');
    connection('Paused'); announce('wait','Game paused');
  }
  function resume() {
    if(!state || state.done) return;
    openPlayView();
    active=true; $('cover').hidden=true; $('pause').innerHTML='Pause <kbd>Esc</kbd>';
    connection('Playing · your controls',true); $('game').focus({preventScroll:true}); announce('live','Craftax connected — you control the player');
  }
  const configuration = fetch('live.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Could not load connection settings.');return r.json();}).then(config=>{
    const endpoint = new URL(config.api);
    if(endpoint.protocol!=='https:' && !['127.0.0.1','localhost'].includes(endpoint.hostname)) throw Error('An HTTPS game connection is required.');
    api=endpoint.href.replace(/\/$/,'');
    $('access-note').textContent=config.access==='tailnet'?'Connect to Tailscale. Allow local-network access if your browser asks, so this page can reach your DGX.':'Live play · powered by the DGX Spark.';
  });
  // Handle configuration failures even if the visitor never presses Enter.
  configuration.catch(error=>tell(error.message,true));
  async function request(path, method='GET', body) {
    await configuration;
    const options={method,headers:{},cache:'no-store',signal:AbortSignal.timeout(path==='session'?60000:20000)};
    if(token) options.headers.Authorization=`Bearer ${token}`;
    if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    let response;
    try { response=await fetch(`${api}/api/${path}`,options); }
    catch(error){
      let denied=false;
      try{denied=(await navigator.permissions.query({name:'local-network-access'})).state==='denied';}catch(_){}
      if(denied)throw Error('Your browser blocked the private connection. Open this website’s site permissions, allow Local network access, then press Reconnect.');
      throw Error('Couldn’t reach the game. Connect Tailscale, check that the DGX is awake, and allow local-network access in your browser if prompted.');
    }
    const data=await response.json();
    if(!response.ok){const error=Error(typeof data.detail==='string'?data.detail:'That request could not be accepted.');error.status=response.status;throw error;}
    return data;
  }
  function draw(next) {
    const previous=state;
    state=next;
    const revision=++imageRevision;
    const img=new Image();
    // Use the whole world view. The original bottom inventory strip is already
    // represented by the page's live vitals and pack; recordings keep it intact.
    img.onload=()=>{if(revision===imageRevision){ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,144,112,0,0,144,112);}};
    img.src=`data:image/png;base64,${next.image}`;
    $('world-label').textContent=`SEED ${next.seed}`;
    $('step-label').textContent=`${next.step.toLocaleString()} ${next.step===1?'action':'actions'}`;
    for(const name of ['health','food','drink','energy']){
      $(name).value=next[name];
      $(`${name}-value`).textContent=next.automatic_needs?.includes(name)?'Auto':`${next[name]}/9`;
      $(name).title=next.automatic_needs?.includes(name)?'Refills automatically in relaxed mode':`${next[name]} out of 9`;
    }
    document.querySelectorAll('[data-stock]').forEach(el=>el.textContent=next.inventory[el.dataset.stock] || 0);
    $('best-pickaxe').textContent=next.inventory.iron_pickaxe?'Iron':next.inventory.stone_pickaxe?'Stone':next.inventory.wood_pickaxe?'Wood':'None';
    $('interact-label').textContent=next.interaction?.hint || 'Interact';
    $('facing-label').textContent=next.interaction?`Facing ${next.interaction.target} · Space`:'Face a tree · Space';
    document.querySelectorAll('.quick-actions [data-action]').forEach(button=>{
      const reason=craftReason(Number(button.dataset.action));
      button.classList.toggle('needs-materials',Boolean(reason));
      button.title=reason || 'Ready to use';
    });
    positionTarget();
    $('inventory').replaceChildren();
    for(const [name,count] of Object.entries(next.inventory)){
      if(!count)continue;
      const item=document.createElement('span');item.className='item';
      const n=document.createElement('b');n.textContent=count;item.append(n,document.createTextNode(title(name)));$('inventory').append(item);
    }
    if(!$('inventory').children.length){const p=document.createElement('p');p.textContent='Empty hands. A whole world of possibilities.';$('inventory').append(p);}
    $('achievement-count').textContent=`${next.achievements.length} / ${next.achievement_total ?? 22} ACHIEVEMENTS`;
    $('earned-count').textContent=`${next.achievements.length} earned`;
    $('achievements').replaceChildren();
    for(const a of next.achievements){const li=document.createElement('li');li.textContent=title(a);$('achievements').append(li);}
    if(!next.achievements.length){const li=document.createElement('li');li.textContent='Your discoveries will appear here.';$('achievements').append(li);}
    document.querySelectorAll('[data-goal]').forEach(el=>{const complete=next.achievements.includes(el.dataset.goal);el.classList.toggle('complete',complete);el.querySelector('span').textContent=complete?'✓':String([...el.parentElement.children].indexOf(el)+1).padStart(2,'0');});
    const newly=previous?next.achievements.filter(a=>!previous.achievements.includes(a)):[];
    if(newly.length)tell(`Discovered: ${newly.map(title).join(' · ')}.`);
    else if(next.sleeping)tell('Resting… time advances until you wake. Pause whenever you like.');
    else if(previous?.sleeping)tell('You’re awake. Back to exploring.');
    $('download').disabled=downloadBusy; $('reset').disabled=false; $('pause').disabled=next.done;
    document.querySelectorAll('[data-action]').forEach(b=>{
      const automaticRest=b.dataset.action==='6' && next.automatic_needs?.includes('energy');
      b.disabled=next.done || automaticRest;
      if(b.dataset.action==='6')b.textContent=automaticRest?'Rest is automatic':'Sleep (Z)';
    });
    if(next.done){active=false;stopHeld();const limit=next.step>=next.max_steps;
      cover('FIELD RECORD COMPLETE',limit?'An expedition well travelled.':'Every life leaves a story.',`${next.achievements.length} achievements in ${next.step} actions. Open Controls & pack to download your run before starting another.`, 'Start another world →');
      connection('Run complete'); announce('wait','Craftax run complete');
    }
  }
  function loseConnection(error) {
    active=false;stopHeld();connection('Disconnected');tell(error.message,true);announce('off',error.message);
    if(error.status===401){storeToken(null);state=null;}
    cover('CONNECTION PAUSED','Let’s reconnect.',error.message,'Reconnect →');
  }
  async function start() {
    if(starting||busy)return;
    if(state && active)return;
    if(state && !state.done && $('connection').textContent==='Paused'){resume();return;}
    if(state?.done){await reset();return;}
    starting=true;$('start').disabled=true;$('start').textContent='Opening your world…';connection('Connecting…');
    try{
      let next;
      if(token){try{next=await request('session');}catch(e){if(e.status!==401)throw e;storeToken(null);}}
      if(!next){next=await request('session','POST',{});storeToken(next.token);delete next.token;}
      openPlayView();draw(next);if(!next.done)resume();tell('Face a tree and press Space to collect your first wood.');
    }catch(error){loseConnection(error);}finally{starting=false;$('start').disabled=false;}
  }
  async function move(action) {
    if(!active||busy||!state||state.done)return;
    if(action===6 && state.automatic_needs?.includes('energy')){stopHeld();tell('Energy refills automatically. No need to sleep.');return;}
    const reason=craftReason(action);
    if(reason){stopHeld();tell(reason);return;}
    busy=true;
    try{
      // Pace quick taps as well as held keys; each accepted input advances one step.
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,60-(performance.now()-lastTick))));
      if(!active)return;
      lastTick=performance.now();
      const next=await request('step','POST',{action,expected_step:state.step});draw(next);$('last-action').textContent=names[action];
    }catch(error){
      if(error.status===409){try{draw(await request('session'));tell('Your view is up to date.');}catch(e){loseConnection(e);}}
      else if(error.status!==429)loseConnection(error);
    }finally{busy=false;}
  }
  async function reset() {
    if(busy||starting)return;
    if(state?.step && !confirm('Start a new world? Download this run first if you want to keep its recording.'))return;
    const raw=$('seed').value.trim(), seed=raw===''?null:Number(raw);
    if(seed!==null && (!Number.isInteger(seed)||seed<0||seed>2147483647)){tell('Choose a whole-number seed between 0 and 2147483647.',true);return;}
    starting=true;active=false;stopHeld();$('reset').disabled=true;connection('Creating world…');
    try{const next=await request('reset','POST',{seed});state=null;draw(next);resume();tell('A fresh start. Face a tree and press Space.');}
    catch(error){loseConnection(error);}finally{starting=false;$('reset').disabled=false;}
  }
  async function download() {
    if(!state||downloadBusy)return;
    pause();downloadBusy=true;$('download').disabled=true;$('download').textContent='Preparing recording…';
    try{
      const record=await request('recording');
      const url=URL.createObjectURL(new Blob([JSON.stringify(record)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=`craftax-seed-${record.seed}-${record.transitions.length}-steps.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      tell(`Downloaded ${record.transitions.length} actions and ${record.transitions.length+1} frames.`);
    }catch(error){tell(error.message,true);}finally{downloadBusy=false;$('download').disabled=false;$('download').textContent='↓ Download this run';}
  }
  $('start').addEventListener('click',start);
  $('expand').addEventListener('click',openPlayView);
  $('leave-play').addEventListener('click',leavePlayView);
  $('toggle-controls').addEventListener('click',()=>showControls(!playArea.classList.contains('controls-open')));
  $('more-craft').addEventListener('click',()=>{
    openPlayView();showControls(true);
    const crafting=document.querySelector('.controls details');
    crafting.open=true;crafting.scrollIntoView({block:'nearest'});
  });
  $('fullscreen').addEventListener('click',fullscreen);
  playDialog.addEventListener('cancel',event=>{event.preventDefault();pause();});
  document.addEventListener('fullscreenchange',()=>{
    $('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';
    if(!document.fullscreenElement)pause();
  });
  $('pause').addEventListener('click',()=>active?pause():resume());
  $('new-world').addEventListener('submit',event=>{event.preventDefault();reset();});
  $('download').addEventListener('click',download);
  document.querySelectorAll('[data-action]').forEach(button=>{
    button.disabled=true;
    button.addEventListener('pointerdown',event=>{
      if(!active)return;event.preventDefault();button.setPointerCapture(event.pointerId);
      const action=Number(button.dataset.action);held={action,source:`pointer-${event.pointerId}`};button.classList.add('is-held');move(action);
    });
    const release=event=>{if(held?.source===`pointer-${event.pointerId}`)stopHeld();};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{if(event.detail===0)move(Number(button.dataset.action));});
  });
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(event.code==='Escape'){
      event.preventDefault();
      if(playDialog.open){
        if(playArea.classList.contains('controls-open'))showControls(false);
        else if(active)pause();else leavePlayView();
      }else if(state&&!state.done){active?pause():resume();}
      return;
    }
    // Space on a focused button retains its standard keyboard activation.
    if(event.target.closest('button,a,summary'))return;
    const action=keymap[event.code];if(action===undefined||!active)return;
    event.preventDefault();if(event.repeat)return;
    held={action,source:event.code};move(action);
  });
  document.addEventListener('keyup',event=>{if(held?.source===event.code)stopHeld();});
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  setInterval(()=>{
    if(!active||busy||performance.now()-lastTick<125)return;
    if(held)move(held.action);else if(state?.sleeping)move(0);
  },40);
  announce('wait','Craftax is ready to connect');
})();
