const $=id=>document.getElementById(id);
const world=$('world'), context=world.getContext('2d'), map=$('map'), mapContext=map.getContext('2d');
let record=null,episode=null,controller='dreamer',view='world',step=0,playing=false,last=0,elapsed=0,drawVersion=0;
const cache=new Map(), colors={water:'#346b88',grass:'#6f9149',stone:'#8d8d7a',path:'#8f7048',sand:'#c7af70',tree:'#254c25',lava:'#c76033',coal:'#474a41',iron:'#9d7b62',diamond:'#8cb7af',table:'#9c7048',furnace:'#6d6256'};
const readable=name=>name.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const actionNames={noop:'Wait',move_left:'Move left ←',move_right:'Move right →',move_up:'Move up ↑',move_down:'Move down ↓',do:'Interact / attack',sleep:'Sleep',place_stone:'Place stone',place_table:'Build a table',place_furnace:'Build a furnace',place_plant:'Plant a sapling',make_wood_pickaxe:'Craft wood pickaxe',make_stone_pickaxe:'Craft stone pickaxe',make_iron_pickaxe:'Craft iron pickaxe',make_wood_sword:'Craft wood sword',make_stone_sword:'Craft stone sword',make_iron_sword:'Craft iron sword'};
function message(text){$('world-message').textContent=text;$('world-message').hidden=!text;}
function pause(){playing=false;$('play').textContent=step===episode?.steps?'Replay expedition ↺':'Play expedition ▶';$('play').setAttribute('aria-pressed','false');}
function play(){if(!episode)return;if(step===episode.steps)seek(0);playing=true;elapsed=0;$('play').textContent='Pause expedition Ⅱ';$('play').setAttribute('aria-pressed','true');}
function seek(value){if(!episode)return;step=Math.max(0,Math.min(episode.steps,Math.round(value)));elapsed=0;if(step===episode.steps)pause();update();}
function loadImage(path){
 if(cache.has(path))return cache.get(path);
 const promise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{cache.delete(path);reject(Error('A recorded image could not load. Reload to retry.'));};image.src=`crafter/${path}`;});
 cache.set(path,promise);if(cache.size>12)cache.delete(cache.keys().next().value);return promise;
}
async function drawWorld(){
 const version=++drawVersion,selected=episode,at=step,sprite=selected[view];if(!sprite)return;
 const sheet=Math.floor(at/sprite.per_sheet),offset=at%sprite.per_sheet;
 try {const image=await loadImage(sprite.files[sheet]);if(version!==drawVersion)return;context.imageSmoothingEnabled=false;context.clearRect(0,0,576,576);context.drawImage(image,offset%sprite.columns*sprite.size,Math.floor(offset/sprite.columns)*sprite.size,sprite.size,sprite.size,0,0,576,576);message('');
 if(sprite.files[sheet+1])loadImage(sprite.files[sheet+1]).catch(()=>{});
 }catch(error){if(version===drawVersion){pause();message(error.message);}}
}
function drawMap(){
 const unit=6;mapContext.imageSmoothingEnabled=false;
 episode.terrain.forEach((row,y)=>row.forEach((material,x)=>{mapContext.fillStyle=colors[record.materials[material]]||'#283c25';mapContext.fillRect(x*unit,y*unit,unit,unit);}));
 const path=episode.frames;
 mapContext.lineWidth=2;mapContext.strokeStyle='#f7d37d88';mapContext.beginPath();path.forEach((frame,i)=>{const [x,y]=frame.position;i?mapContext.lineTo(x*unit+3,y*unit+3):mapContext.moveTo(x*unit+3,y*unit+3);});mapContext.stroke();
 mapContext.lineWidth=3;mapContext.strokeStyle='#fff3bf';mapContext.beginPath();path.slice(0,step+1).forEach((frame,i)=>{const [x,y]=frame.position;i?mapContext.lineTo(x*unit+3,y*unit+3):mapContext.moveTo(x*unit+3,y*unit+3);});mapContext.stroke();
 const [x,y]=path[step].position;mapContext.strokeStyle='#ffe39e';mapContext.lineWidth=1;mapContext.strokeRect((x-4)*unit,(y-3)*unit,9*unit,7*unit);mapContext.fillStyle='#fff7de';mapContext.beginPath();mapContext.arc(x*unit+3,y*unit+3,4,0,Math.PI*2);mapContext.fill();
}
function update(){
 if(!episode)return;const frame=episode.frames[step];$('step-label').textContent=`${step} / ${episode.steps}`;$('timeline').value=step;$('step-badge').textContent=`STEP ${String(step).padStart(3,'0')}`;
 $('day-badge').textContent=frame.daylight<.3?'NIGHT':frame.daylight<.65?'TWILIGHT':'DAYLIGHT';$('position').textContent=`Position ${frame.position[0]}, ${frame.position[1]}`;
 $('action').textContent=frame.action===null?'Episode complete':actionNames[record.actions[frame.action]]||readable(record.actions[frame.action]);$('reward-now').textContent=`Reward so far: ${frame.total_reward.toFixed(1)}`;
 for(const key of ['health','food','drink','energy']){$(key).textContent=`${frame.inventory[key]} / 9`;$(`${key}-meter`).value=frame.inventory[key];}
 const inventory=Object.entries(frame.inventory).filter(([key,value])=>value>0&&!['health','food','drink','energy'].includes(key));$('inventory').replaceChildren();
 if(!inventory.length)$('inventory').textContent='Nothing collected yet.';for(const [key,value] of inventory){const span=document.createElement('span');span.className='item';span.textContent=`${readable(key)} × ${value}`;$('inventory').append(span);}
 const achieved=Object.entries(frame.achievements).filter(([,value])=>value>0);$('achievement-count').textContent=`${achieved.length} / 22`;$('discoveries').replaceChildren();
 if(!achieved.length){const p=document.createElement('p');p.className='muted';p.textContent='No achievements unlocked yet.';$('discoveries').append(p);}for(const [name] of achieved){const p=document.createElement('div');p.className='discovery';p.textContent=readable(name);$('discoveries').append(p);}
 $('previous').disabled=step===0;$('next').disabled=step===episode.steps;drawMap();drawWorld();
}
function setView(next){if(next==='reconstruction'&&controller!=='dreamer')return;view=next;document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
 $('view-note').textContent=view==='world'?'Real simulator frames, rendered at higher resolution for this notebook. Replay controls explore a fixed run; no model inference runs in this browser.':view==='vision'?'The actual 64 × 64 image given to the agent at this step. The full map and inventory panel are for you; they were not extra inputs to the agent.':'The model’s reconstruction of the current observation, decoded from the same internal state used to choose its action. This is not a future prediction; errors and blur are expected in an early model.';
 drawWorld();
}
function buildMilestones(){
 const list=$('milestones');list.replaceChildren();const found=new Set();
 function add(label,at){const button=document.createElement('button');const name=document.createElement('span'),time=document.createElement('span');name.textContent=label;time.textContent=`STEP ${at} →`;button.append(name,time);button.addEventListener('click',()=>{pause();seek(at);});list.append(button);}
 add('Enter the world',0);for(const frame of episode.frames){for(const [key,value] of Object.entries(frame.achievements)){if(value>0&&!found.has(key)){found.add(key);add(readable(key),frame.step);}}}
 if(!found.size){const p=document.createElement('p');p.className='empty';p.textContent='No achievements unlocked in this episode. The full attempt is included.';list.append(p);}
 add(episode.ended_by==='death'?'Health reaches zero':'Evaluation limit reached',episode.steps);
}
function selectEpisode(){pause();episode=record.episodes.find(item=>item.controller===controller&&item.seed===Number($('seed').value));step=0;elapsed=0;$('timeline').max=episode.steps;$('dreamer').setAttribute('aria-pressed',String(controller==='dreamer'));$('random').setAttribute('aria-pressed',String(controller==='random'));
 const reconstruction=document.querySelector('[data-view="reconstruction"]');reconstruction.disabled=controller!=='dreamer';if(controller==='random'&&view==='reconstruction')view='world';buildMilestones();setView(view);update();pause();}
$('play').addEventListener('click',()=>playing?pause():play());$('restart').addEventListener('click',()=>{pause();seek(0);});$('previous').addEventListener('click',()=>{pause();seek(step-1);});$('next').addEventListener('click',()=>{pause();seek(step+1);});$('timeline').addEventListener('input',()=>{pause();seek(Number($('timeline').value));});$('seed').addEventListener('change',selectEpisode);
for(const name of ['dreamer','random'])$(name).addEventListener('click',()=>{controller=name;selectEpisode();});document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(episode)setView(button.dataset.view);}));
map.addEventListener('click',event=>{if(!episode)return;const rect=map.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*64,y=(event.clientY-rect.top)/rect.height*64;let best=0,distance=Infinity;episode.frames.forEach((frame,i)=>{const d=(frame.position[0]+.5-x)**2+(frame.position[1]+.5-y)**2;if(d<distance){distance=d;best=i;}});pause();seek(best);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function animate(time){if(!last)last=time;const delta=Math.min((time-last)/1000,.2);last=time;if(playing&&episode){elapsed+=delta*Number($('speed').value);if(elapsed>=1){const amount=Math.floor(elapsed);elapsed-=amount;step=Math.min(episode.steps,step+amount);if(step===episode.steps)pause();update();}}requestAnimationFrame(animate);}
async function init(){
 try {const response=await fetch('crafter/run.json');if(!response.ok)throw Error('The expedition record could not load. Reload this page to retry.');record=await response.json();if(!record.episodes?.length)throw Error('The expedition record is incomplete.');
 const seeds=[...new Set(record.episodes.map(item=>item.seed))];for(const seed of seeds){const option=document.createElement('option');option.value=seed;option.textContent=`Seed ${seed}`;$('seed').append(option);}
 $('training-steps').textContent=record.training_steps.toLocaleString();$('updates').textContent=record.updates.toLocaleString();$('load-status').textContent=`GPU CHECKPOINT · ${record.training_steps.toLocaleString()} STEPS`;
 $('evaluation-note').textContent=`All ${seeds.length} evaluation seeds are shown for both controllers, capped at ${record.max_evaluation_steps} steps each. These rewards are not the official Crafter benchmark score. JAX ${record.jax_version} · ${record.environment}.`;
 for(const item of record.episodes){const tr=document.createElement('tr');const achievements=Object.values(item.frames.at(-1).achievements).filter(value=>value>0).length;for(const value of [item.controller==='dreamer'?'DreamerV3':'Random actions',item.seed,item.steps,item.reward.toFixed(1),achievements]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('results').append(tr);}
 for(const id of ['play','next','restart','timeline','seed','dreamer','random'])$(id).disabled=false;
 selectEpisode();
 }catch(error){message(error.message);$('load-status').textContent='Record unavailable';}
}
requestAnimationFrame(animate);init();
