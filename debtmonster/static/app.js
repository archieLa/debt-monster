'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state=null, view=null, settings={}, busy=false, cursor=null, queue=[], animating=false, currentSlide=0;
let journeyFrame=null,journeyGraph=null,journeyKey=null,journeyPlaying=false;
let angerTimer=null;
let submitting=false, balanceTween=false, celebrationTimer=null, rotationTimer=null;
const localTransactions=new Set();
const isDisplay=document.body.classList.contains('display-mode');
const panelNames=['Balance','Journey','Trend','Monthly progress'];
const token=$('meta[name="csrf-token"]').content;
const money=n=>new Intl.NumberFormat(undefined,{style:'currency',currency:settings.currency||'USD'}).format((n||0)/100);
function cents(value,optional=false){const s=String(value).trim();if(optional&&!s)return null;if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Use a positive amount with up to two decimal places, without commas.');const [whole,fraction='']=s.split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(n))throw Error('Amount is too large.');return n;}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className='show'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='',6000);}
async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:body===undefined?undefined:JSON.stringify(body)});let result;try{result=await response.json();}catch{throw Error('The app returned an unexpected response.');}if(!response.ok)throw Error(result.error||result.message||'Could not complete this change.');return result;}
function run(fn){return async event=>{event?.preventDefault();try{await fn(event);}catch(error){toast(error.message,true);}};}
function text(selector,value){$(selector).textContent=value;}
function node(tag,value,className){const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el;}
async function refresh(){if(busy)return;busy=true;try{const data=await api('/api/status'+(view?'?mode='+view:''));state=data;settings=data.settings||settings;view=view||data.mode;render();if(cursor===null){const key='dm-display-cursor';const latest=data.event_cursor||0;const stored=localStorage.getItem(key);cursor=stored===null?latest:Math.min(Number(stored)||0,latest);localStorage.setItem(key,String(cursor));}await pollEvents();text('#sync-status','Local ledger · updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));}catch(error){text('#sync-status','Connection interrupted · retrying');if(!state)toast(error.message,true);}finally{busy=false;}}
function render(){const s=state,savings=s.mode==='savings';document.body.classList.toggle('savings-mode',savings);$('#monster').closest('[data-slide]').setAttribute('aria-label',savings?'Savings garden panel':'Debt journey panel');const active=s.active_mode||s.settings?.mode||s.mode;$('#setup-panel').hidden=s.initialized!==false;$('#dashboard').hidden=s.initialized===false;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===s.mode));text('#greeting',savings?'Make room for possibility.':'A little lighter, every day.');text('#subtitle',savings?'Watch your next chapter take root.':'Your journey, one small step at a time.');text('#balance-label',savings?'SAVINGS BALANCE':'DEBT REMAINING');text('#mode-label',savings?'GROW AT YOUR OWN PACE':'ONE STEP AT A TIME');if(!balanceTween)text('#balance',money(savings?s.balance_cents:s.remaining_cents));text('#balance-detail',!savings&&s.credit_cents>0?money(s.credit_cents)+' in credit · kept separate from savings':savings?'A growing space for what matters to you.':s.balance_cents<=0?'You’re debt free. Take a moment to enjoy it.':'Every recorded step is part of your story.');$('#progress-block').hidden=s.progress===null||s.progress===undefined;text('#percent',(s.progress||0)+'%');$('#progress-fill').style.width=(s.progress||0)+'%';$('.progress-track').setAttribute('aria-valuenow',s.progress||0);text('#progress-description',savings?'Toward your savings goal':'Journey progress');text('#goal-label',savings?money(s.settings?.savings_goal_cents||0)+' goal':'Debt free');text('#net-label',savings?'NET SAVINGS CHANGE':'NET DEBT REDUCTION');text('#net',money(savings?s.balance_cents-s.starting_cents:s.net_reduction_cents));text('#starting',money(s.starting_cents));text('#chart-title',savings?'Room to grow.':'Your balance over time.');if(!balanceTween&&!animating){text('#monster-message',savings?'A little care. A little more possibility.':'Ready for a little less debt?');text('#stage-caption',savings?'Your savings garden is growing.':'Small steps. Big appetite.');}$('#payoff-panel').hidden=savings||s.balance_cents>0||active!=='debt'||localStorage.getItem('dm-stay-here')==='true';const disabled=active!==s.mode;$('#entry-form').querySelectorAll('input,select,button').forEach(el=>el.disabled=disabled||submitting||balanceTween);text('#entry-title',disabled?'You’re viewing retained history.':savings?'Plant a little progress.':'Feed your progress.');const select=$('#entry-kind'),previous=select.value;select.replaceChildren(...(savings?[['S','Deposit'],['W','Withdrawal']]:[['P','Payment'],['C','Charge']]).map(([value,label])=>{const o=node('option',label);o.value=value;return o;}));if([...select.options].some(o=>o.value===previous))select.value=previous;updateEntryButton();text('#entry-help',disabled?'Switch the active mode in Settings to add new entries.':savings?'Record a deposit or withdrawal to update your savings.':'Record a payment or charge to update your debt.');drawTrend(s.trend||[]);drawMonthly(s.monthly||[]);drawLedger(s.transactions||[]);syncJourney();}
function updateEntryButton(){const label={P:'Feed the monster',C:'Record charge',S:'Grow my savings',W:'Record withdrawal'}[$('#entry-kind').value];$('#entry-submit').replaceChildren(document.createTextNode(label+' '),node('span','↗'));}
function drawTrend(points){const svg=$('#trend-chart');svg.replaceChildren();if(!points.length){const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','50');t.setAttribute('y','100');t.textContent='Your timeline will grow with every entry.';t.setAttribute('fill','#788078');t.setAttribute('font-size','13');svg.append(t);return;}const values=points.map(p=>p.balance_cents);let lo=Math.min(0,...values),hi=Math.max(0,...values);if(lo===hi)hi=lo+100;const range=hi-lo;lo-=range*.08;hi+=range*.08;const x=i=>55+i*565/Math.max(points.length-1,1),y=v=>180-(v-lo)/(hi-lo)*155;const add=(tag,attrs,value)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(value!==undefined)n.textContent=value;svg.append(n);return n;};for(let i=0;i<4;i++){let v=lo+(hi-lo)*i/3;add('line',{x1:55,x2:625,y1:y(v),y2:y(v),stroke:'#eceee5','stroke-dasharray':'3 5'});add('text',{x:46,y:y(v)+3,fill:'#8b9385','font-size':13,'text-anchor':'end'},money(Math.round(v)));}let d=points.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.balance_cents)).join(' ');add('path',{d:d+' L '+x(points.length-1)+',185 L 55,185 Z',fill:'#a8c675',opacity:'.09'});add('path',{d,fill:'none',stroke:'#719653','stroke-width':'2.5','stroke-linejoin':'round'});points.forEach((p,i)=>{const c=add('circle',{cx:x(i),cy:y(p.balance_cents),r:points.length<50?3:1.8,fill:'#719653'});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=p.date+' · '+money(p.balance_cents);c.append(title);});text('#chart-start',points[0].date==='Starting balance'?'Starting balance':String(points[0].date||'').slice(0,10));}
function drawMonthly(months){const target=$('#monthly-chart');target.replaceChildren();if(!months.length){target.append(node('p','Your first update starts the story.','small muted'));return;}const max=Math.max(1,...months.map(m=>Math.abs(m.net_cents)));months.slice(-6).forEach(m=>{const row=node('div',undefined,'month-row'),track=node('div',undefined,'month-track'),bar=node('div',undefined,'month-bar'+(m.net_cents<0?' negative':''));bar.style.width=Math.max(2,Math.abs(m.net_cents)*100/max)+'%';track.append(bar);row.append(node('span',m.month),track,node('strong',money(m.net_cents)));target.append(row);});}
function drawLedger(transactions){const body=$('#ledger');body.replaceChildren();if(!transactions.length){const row=node('tr'),cell=node('td','A fresh page. Record your first change.','muted');cell.colSpan=4;row.append(cell);body.append(row);return;}[...transactions].reverse().forEach(t=>{const row=node('tr'),date=node('td',new Date(t.effective_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}));if(t.note)date.append(node('small',t.note));const actions=node('td'),wrap=node('div',undefined,'row-actions');const edit=node('button','Edit');edit.type='button';edit.onclick=()=>{const form=$('#edit-form');form.elements.id.value=t.id;form.dataset.kind=t.kind;form.elements.amount.value=(t.amount_cents/100).toFixed(2);form.elements.note.value=t.note||'';$('#history-dialog').close();$('#edit-dialog').showModal();};const del=node('button','Delete');del.type='button';del.onclick=run(async()=>{if(!confirm('Delete this entry? The balance will be recalculated.'))return;await api('/api/transactions/'+t.id,'DELETE');await refresh();toast('Entry removed.');});wrap.append(edit,del);actions.append(wrap);row.append(date,node('td',({P:'Payment',C:'Charge',S:'Deposit',W:'Withdrawal',payment:'Payment',charge:'Charge',deposit:'Deposit',withdrawal:'Withdrawal'})[t.kind]||t.kind),node('td',money(t.amount_cents)),actions);body.append(row);});}
async function pollEvents(){if(cursor===null)return;const result=await api('/api/events?after='+cursor);const events=Array.isArray(result)?result:result.events||[];for(const e of events){cursor=Math.max(cursor,e.id);localStorage.setItem('dm-display-cursor',String(cursor));if(['payment','deposit','milestone','payoff','goal'].includes(e.kind)&&e.mode===state.mode&&!localTransactions.has(e.payload?.transaction_id)){if(queue.length<12)queue.push(e);else if(e.kind==='payoff'||e.kind==='milestone')queue[queue.length-1]=e;}}playNext();}
function playNext(){
  if(animating||balanceTween||!queue.length)return;
  const event=queue.shift();
  if(event.mode!==state.mode){playNext();return;}
  if(['payment','deposit'].includes(event.kind)){
    const payload=event.payload||{};
    const after=payload.balance_cents??state.balance_cents;
    const before=payload.before_balance_cents??(after+(event.kind==='payment'?payload.amount_cents:-payload.amount_cents));
    animateChange(before,after,event.kind==='payment'?'P':'S',payload.amount_cents).then(playNext);
    return;
  }
  animating=true;
  const monster=$('#monster');
  monster.classList.remove('chomp','celebrate');void monster.offsetWidth;monster.classList.add('celebrate');
  const message=event.kind==='payoff'?'Debt free. Look what you made possible!':(event.payload?.threshold||'Another')+'% milestone. Look at you grow!';
  text('#monster-message',message);toast(message);
  celebrationTimer=setTimeout(()=>{monster.classList.remove('celebrate');animating=false;playNext();},3500);
}
async function animateChange(before,after,kind,amount){
  const charge=kind==='C',deposit=kind==='S',withdrawal=kind==='W',positive=kind==='P'||deposit||withdrawal||charge,savings=state.mode==='savings';
  if(!positive){text('#transaction-result','Change recorded. Balance '+money(savings?after:Math.max(0,after)));return;}
  if(isDisplay){showSlide(1);return;}
  clearTimeout(celebrationTimer);clearTimeout(angerTimer);animating=false;
  balanceTween=true;
  if(isDisplay)showSlide(1,false);else $('#stage-deck').scrollIntoView({behavior:'smooth',block:'start'});
  document.body.classList.add(deposit?'garden-deposit':withdrawal?'garden-withdrawal':charge?'charge-reaction':'transaction-playing');
  const monster=$('#monster');monster.classList.remove('celebrate','angry','chomp','gardening','harvesting');monster.classList.add(deposit?'gardening':withdrawal?'harvesting':charge?'angry':'chomp');
  monster.setAttribute('aria-label',deposit?'A smiling monster planting and watering savings':withdrawal?'A smiling monster gently collecting fruit':charge?'An angry monster reacting to a charge':'A happy monster eating debt');
  text('#debt-snack',(kind==='P'?'−':'+')+money(amount));
  text('#monster-message',withdrawal?'Gathering a little fruit for today.':deposit?'Plant a seed. Give your future a little care.':charge?'Grrr! More debt to chew through.':kind==='P'?'CHOMP! Making room for a little more life.':'A little seed for your future.');
  text('#stage-caption',withdrawal?'Savings are here to be used when you need them.':charge?'Charge recorded. We’ll keep going.':kind==='P'?'Watch your debt disappear.':'Watch your savings grow.');
  const from=savings?before:Math.max(0,before),to=savings?after:Math.max(0,after);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await new Promise(resolve=>{
    const start=performance.now(),duration=reduced?0:withdrawal?3200:charge?2600:4400;
    function frame(time){
      const t=duration?Math.min(1,(time-start)/duration):1;
      // Interpolate the visual counter only. The committed ledger stays in integer cents.
      const step=Math.floor(t*24)/24,shown=Math.round(from+(to-from)*(1-Math.pow(1-step,2)));
      text('#balance',money(shown));text('#chomp-balance',money(shown));
      if(t<1)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
  });
  balanceTween=false;document.body.classList.remove('transaction-playing','charge-reaction','garden-deposit','garden-withdrawal');monster.classList.remove('chomp','gardening','harvesting');
  if(charge)angerTimer=setTimeout(()=>{monster.classList.remove('angry');monster.setAttribute('aria-label','A friendly green monster');},1800);
  text('#balance',money(to));text('#monster-message',withdrawal?'A little fruit for today. The garden is still here.':deposit?'A new sprout for your future.':charge?'Grrr. A little more to munch next time.':kind==='P'?'A little lighter. You made that happen.':'A little more possibility. You made that happen.');
  text('#stage-caption',withdrawal?money(amount)+' gently gathered.':charge?money(amount)+' charge recorded.':kind==='P'?money(amount)+' of debt, eaten.':money(amount)+' planted for your future.');
  text('#transaction-result','Recorded '+money(amount)+'. New balance '+money(to));
  scheduleRotation();
}
$('#date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
$('#setup-form').onsubmit=run(async e=>{const f=new FormData(e.target);await api('/api/setup','POST',{mode:f.get('mode'),starting_debt_cents:cents(f.get('starting_debt')),starting_savings_cents:cents(f.get('starting_savings')),savings_goal_cents:cents(f.get('savings_goal'),true)});view=f.get('mode');cursor=null;await refresh();toast('Your journey is ready.');});
$('#demo-setup').onclick=run(async()=>{await api('/api/setup','POST',{demo:true});view='debt';cursor=null;await refresh();toast('Demo ready. All balances and entries are artificial.');});
$('#entry-kind').onchange=updateEntryButton;
$('#entry-form').onsubmit=run(async e=>{
  if(submitting||balanceTween)return;
  const form=e.target,f=new FormData(form),amount=cents(f.get('amount')),kind=f.get('kind');
  const before=state.balance_cents,known=new Set(state.transactions.map(t=>t.id));
  submitting=true;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
  try{
    const result=await api('/api/transactions','POST',{commands:kind+' '+String(f.get('amount')).trim(),note:f.get('note')});
    for(const t of result.transactions)if(!known.has(t.id))localTransactions.add(t.id);
    state=result;settings=result.settings;render();
    form.elements.amount.value='';form.elements.note.value='';
    await animateChange(before,result.balance_cents,kind,amount);
    await pollEvents();toast(kind==='P'?'Payment saved. A little less debt.':'Change saved.');
  }finally{
    submitting=false;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=state.active_mode!==state.mode);
    playNext();
  }
});
$('#edit-form').onsubmit=run(async e=>{const f=new FormData(e.target);await api('/api/transactions/'+f.get('id'),'PUT',{kind:e.target.dataset.kind,amount_cents:cents(f.get('amount')),note:f.get('note')});$('#edit-dialog').close();await refresh();toast('Correction saved.');});
$$('[data-view]').forEach(b=>b.onclick=run(async()=>{view=b.dataset.view;await refresh();}));
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#settings-open').onclick=run(async()=>{settings=await api('/api/settings');const form=$('#settings-form');for(const el of form.elements){if(!el.name)continue;if(el.type==='checkbox')el.checked=Boolean(settings[el.name]);else if(settings[el.name]!==undefined)el.value=settings[el.name]??'';}$('#settings-dialog').showModal();});
$('#settings-form').onsubmit=run(async e=>{const body={};for(const el of e.target.elements){if(el.name)body[el.name]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;}await api('/api/settings','PATCH',body);await refresh();toast('Settings saved.');});
$('#restore-file').onchange=run(async e=>{const file=e.target.files[0];if(!file)return;let backup;try{backup=JSON.parse(await file.text());}catch{throw Error('Choose a valid JSON backup.');}if(!confirm('Replace your current ledgers and settings with this backup? A safety backup will be created first. Changes after this backup will be lost.')){e.target.value='';return;}await api('/api/restore','POST',{backup,confirmed:true});localStorage.removeItem('dm-display-cursor');cursor=null;view=null;$('#settings-dialog').close();e.target.value='';await refresh();toast('Backup restored.');});
$('#start-saving').onclick=run(async()=>{if(settings.savings_started){await api('/api/mode','POST',{mode:'savings'});view='savings';await refresh();toast('Returned to your savings chapter.');}else $('#savings-dialog').showModal();});
$('#stay-here').onclick=()=>{localStorage.setItem('dm-stay-here','true');$('#payoff-panel').hidden=true;toast('Enjoy this chapter. Start saving anytime in Settings.');};
$('#savings-form').onsubmit=run(async e=>{const f=new FormData(e.target);await api('/api/mode','POST',{mode:'savings',starting_savings_cents:cents(f.get('starting_savings')),savings_goal_cents:cents(f.get('savings_goal'),true)});view='savings';$('#savings-dialog').close();await refresh();toast('Your savings chapter starts here.');});
$('#switch-mode').onclick=run(async()=>{if((state.active_mode||settings.mode)==='savings'){if(!confirm('Switch to debt mode? Both ledgers are preserved. '))return;await api('/api/mode','POST',{mode:'debt'});view='debt';localStorage.removeItem('dm-stay-here');$('#settings-dialog').close();await refresh();}else if(settings.savings_started){await api('/api/mode','POST',{mode:'savings'});view='savings';$('#settings-dialog').close();await refresh();toast('Returned to your savings chapter.');}else{$('#settings-dialog').close();$('#savings-dialog').showModal();}});
function stopJourney(){cancelAnimationFrame(journeyFrame);journeyFrame=null;journeyPlaying=false;}
function syncJourney(){
  if(!isDisplay)return;
  const key=JSON.stringify([state.mode,state.trend]);
  if(key!==journeyKey){journeyKey=key;buildJourney();if(currentSlide===1)replayJourney();}
}
function buildJourney(){
  stopJourney();
  journeyGraph=DebtJourney.layout(state.trend||[]);
  const svg=$('#journey-chart');svg.replaceChildren();
  function add(tag,attrs,parent=svg){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value));parent.append(el);return el;}
  const graph=journeyGraph;
  for(let i=0;i<3;i++){
    const y=80+i*80,value=graph.high-(graph.high-graph.low)*i/2;
    add('line',{x1:85,x2:650,y1:y,y2:y,stroke:'#d9e2c9','stroke-dasharray':'3 7'});
    const label=add('text',{x:76,y:y+4,'text-anchor':'end',class:'journey-axis'});label.textContent=money(Math.round(value));
  }
  add('path',{id:'journey-line',d:graph.path,fill:'none',stroke:'#6c9653','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':1,'stroke-dashoffset':1});
  graph.nodes.forEach((point,index)=>{
    const date=index?new Date(point.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Starting balance';
    const marker=add('circle',{cx:point.x,cy:point.y,r:7,class:'journey-point',tabindex:0,role:'button','aria-label':date+', '+money(point.balance_cents)});
    const title=add('title',{},marker);title.textContent=date+' · '+money(point.balance_cents);
    const select=()=>{stopJourney();showJourneyFrame(index/Math.max(1,graph.nodes.length-1),true);scheduleRotation();};
    marker.addEventListener('click',select);marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
    marker.addEventListener('pointerenter',()=>{if(!journeyPlaying)showJourneyFrame(index/Math.max(1,graph.nodes.length-1),true);});
  });
  const start=add('text',{x:85,y:283,class:'journey-axis'});start.textContent='Where you started';
  const end=add('text',{x:650,y:283,'text-anchor':'end',class:'journey-axis'});end.textContent='Now';
  const pal=add('g',{id:'journey-pal','aria-hidden':'true'});
  // A small SVG companion rides directly on the ledger line.
  const shapes=[['ellipse',{cx:0,cy:-1,rx:24,ry:5,fill:'#637c3820'}],['path',{d:'M-20 -43 Q-34 -65 -25 -72 L-12 -58 M14 -57 Q34 -72 30 -55 L25 -42',fill:'#a5bf70'}],['ellipse',{cx:0,cy:-31,rx:29,ry:31,fill:'#a5bf70'}],['ellipse',{cx:-27,cy:-20,rx:7,ry:14,fill:'#a5bf70',transform:'rotate(20 -27 -20)'}],['ellipse',{cx:27,cy:-20,rx:7,ry:14,fill:'#a5bf70',transform:'rotate(-20 27 -20)'}],['ellipse',{cx:-14,cy:-2,rx:11,ry:5,fill:'#90aa60'}],['ellipse',{cx:14,cy:-2,rx:11,ry:5,fill:'#90aa60'}],['ellipse',{cx:-10,cy:-40,rx:7,ry:9,fill:'#fffef4'}],['ellipse',{cx:10,cy:-40,rx:7,ry:9,fill:'#fffef4'}],['ellipse',{cx:-9,cy:-38,rx:2.6,ry:4,fill:'#304834'}],['ellipse',{cx:11,cy:-38,rx:2.6,ry:4,fill:'#304834'}],['path',{d:'M-9 -24 Q0 -12 10 -24',class:'pal-smile',fill:'none',stroke:'#3b5836','stroke-width':3,'stroke-linecap':'round'}],['ellipse',{cx:0,cy:-22,rx:10,ry:8,class:'pal-chomp',fill:'#3b5836'}],['path',{d:'M-6 -29 L-2 -29 L-2 -24 L-6 -24 M3 -29 L7 -29 L7 -24 L3 -24',class:'pal-chomp',fill:'#fffef4'}],['path',{d:'M35 -52 Q23 -36 35 -33 Q47 -36 35 -52',class:'pal-sweat',fill:'#8bbbd0'}],['path',{d:'M-8 -19 Q0 -30 8 -19',class:'pal-pant',fill:'none',stroke:'#3b5836','stroke-width':3}]];
  shapes.forEach(([tag,attrs])=>add(tag,attrs,pal));
  if(state.mode==='savings'){
    pal.classList.add('savings-pal');
    const can=add('g',{class:'pal-water'},pal);
    add('rect',{x:23,y:-28,width:17,height:14,rx:3,fill:'#86b7c3'},can);
    add('path',{d:'M27 -28 Q25 -40 36 -33 M40 -22 L48 -29 L51 -27 L42 -17',fill:'none',stroke:'#6d9dab','stroke-width':4},can);
    const drops=add('g',{class:'pal-water-drops'},can);
    for(let i=0;i<3;i++)add('ellipse',{cx:49+i*3,cy:-21+i*6,rx:1.5,ry:2.5,fill:'#6ba7bd'},drops);
    const basket=add('g',{class:'pal-basket'},pal);
    add('path',{d:'M22 -20 L44 -20 L40 -8 L26 -8 Z',fill:'#bd9967'},basket);
    add('circle',{cx:29,cy:-22,r:5,fill:'#d7a45c'},basket);add('circle',{cx:37,cy:-22,r:5,fill:'#c88259'},basket);
    const stages=DebtJourney.gardenStages(graph.nodes,state.settings.savings_goal_cents);
    graph.nodes.forEach((point,index)=>{
      if(!stages[index].grow)return;
      const plant=add('g',{class:'journey-plant','data-point':index,transform:'translate('+point.x+' '+(point.y+4)+')'});
      svg.insertBefore(plant,pal);
      add('path',{d:'M0 0 L0 -20 M0 -8 Q-15 -20 -14 -10 Q-9 -3 0 -8 M0 -12 Q14 -25 14 -15 Q9 -8 0 -12',fill:'#7fa75e',stroke:'#6e9952','stroke-width':2},plant);
      if(stages[index].blooms){
        const bloom=add('g',{class:'journey-bloom',transform:'translate(0 -24) scale('+(1+Math.min(3,stages[index].blooms)*.15)+')'},plant);
        for(let petal=0;petal<5;petal++)add('ellipse',{cx:0,cy:-5,rx:3.5,ry:5,fill:stages[index].blooms>1?'#d7b7cf':'#edd79a',transform:'rotate('+petal*72+')'},bloom);
        add('circle',{cx:0,cy:0,r:3,fill:'#c8a253'},bloom);
      }else add('circle',{cx:0,cy:-20,r:4,fill:'#bbcd84'},plant);
    });
  }
  showJourneyFrame(0);
}
function showJourneyFrame(progress,selected=false){
  if(!journeyGraph)return;
  const frame=DebtJourney.sample(journeyGraph,progress),savings=state.mode==='savings';
  const selectedIndex=selected?Math.round(progress*(journeyGraph.nodes.length-1)):frame.index;
  const delta=selected?(journeyGraph.nodes[selectedIndex].balance_cents-(journeyGraph.nodes[Math.max(0,selectedIndex-1)].balance_cents)):frame.delta;
  const reaction=DebtJourney.reaction(state.mode,delta);const struggle=reaction==='climbing';
  const pal=$('#journey-pal');pal.setAttribute('transform','translate('+frame.x+' '+frame.y+')');
  for(const name of ['climbing','munching','watering','harvesting'])pal.classList.toggle(name,reaction===name&&(selected||progress<1));
  $$('.journey-plant').forEach(plant=>{plant.style.opacity=Number(plant.dataset.point)<=progress*(journeyGraph.nodes.length-1)?'1':'0';});
  $('#journey-line').setAttribute('stroke-dashoffset',String(1-frame.revealed));
  text('#journey-value',money(frame.balance_cents));
  const point=journeyGraph.nodes[selectedIndex],transaction=state.transactions.find(t=>t.id===point?.id);
  let message=journeyGraph.nodes.length===1?'Your story starts here. Record your first change.':progress===0?'Here’s where we started.':progress>=1?(savings?'Look at your garden. Every bit of care counts.':'Look how far you’ve come. Every step counts.'):savings?(delta<0?'Gathering a little fruit. Your savings are here for you.':'Watering a new seed. A little more room to grow.'):struggle?(savings?'A withdrawal. Finding our footing.':'A charge! Phew… climbing this bit.'):(savings?'A deposit! Growing something good.':'CHOMP! A payment makes the path lighter.');
  if(selected&&point){message=(selectedIndex?new Date(point.date).toLocaleDateString()+ ' · ':'Starting balance · ')+money(point.balance_cents)+(transaction?.note?' · '+transaction.note:'');}
  text('#journey-detail',message);
  $$('.journey-point').forEach((marker,index)=>{marker.classList.toggle('visited',index<=frame.index-1||progress===1);marker.setAttribute('aria-pressed',String(selected&&index===selectedIndex));});
}
function replayJourney(){
  if(!isDisplay||!state||currentSlide!==1)return;
  if(!journeyGraph)buildJourney();
  stopJourney();showJourneyFrame(0);scheduleRotation();
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||journeyGraph.nodes.length===1){showJourneyFrame(1);return;}
  journeyPlaying=true;
  const start=performance.now(),duration=Math.max(8000,Math.min(12000,(journeyGraph.nodes.length-1)*1800));
  function frame(time){
    if(!journeyPlaying||currentSlide!==1)return;
    const progress=Math.min(1,(time-start)/duration);showJourneyFrame(progress);
    if(progress<1)journeyFrame=requestAnimationFrame(frame);else{journeyPlaying=false;journeyFrame=null;}
  }
  journeyFrame=requestAnimationFrame(frame);
}
$('#journey-replay').onclick=replayJourney;
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopJourney();else if(isDisplay&&currentSlide===1)replayJourney();});
$('#history-open').onclick=()=>$('#history-dialog').showModal();
$('#rotate').checked=localStorage.getItem('dm-rotate')==='true';
currentSlide=Math.max(0,Math.min(3,Number(localStorage.getItem('dm-panel'))||0));
function showSlide(index,resetTimer=true){
  currentSlide=(index+4)%4;
  $$('[data-slide]').forEach((slide,i)=>{slide.classList.toggle('current-slide',i===currentSlide);if(isDisplay)slide.setAttribute('aria-hidden',String(i!==currentSlide));});
  $$('#slide-dots button').forEach((dot,i)=>{dot.classList.toggle('active',i===currentSlide);dot.setAttribute('aria-current',i===currentSlide?'true':'false');});
  text('#slide-position',(currentSlide+1)+' of 4 · '+panelNames[currentSlide]);
  text('#slide-heading',panelNames[currentSlide]);
  localStorage.setItem('dm-panel',String(currentSlide));
  if(isDisplay&&currentSlide===1&&state)replayJourney();else stopJourney();
  if(resetTimer)scheduleRotation();
}
function scheduleRotation(){
  clearTimeout(rotationTimer);
  if(isDisplay&&$('#rotate').checked)rotationTimer=setTimeout(()=>{
    if(!balanceTween&&!animating&&!document.querySelector('dialog[open]')&&!document.hidden)showSlide(currentSlide+1,false);
    scheduleRotation();
  },15000);
}
panelNames.forEach((name,i)=>{const dot=node('button');dot.type='button';dot.setAttribute('aria-label','Show '+name.toLowerCase()+' panel');dot.onclick=()=>showSlide(i);$('#slide-dots').append(dot);});
$('#slide-prev').onclick=()=>showSlide(currentSlide-1);
$('#slide-next').onclick=()=>showSlide(currentSlide+1);
$('#rotate').onchange=()=>{localStorage.setItem('dm-rotate',String($('#rotate').checked));scheduleRotation();};
document.addEventListener('keydown',event=>{if(!isDisplay||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;if(event.key==='ArrowRight'){event.preventDefault();showSlide(currentSlide+1);}if(event.key==='ArrowLeft'){event.preventDefault();showSlide(currentSlide-1);}});
let touchStart=null;
$('#stage-deck').addEventListener('touchstart',event=>{if(isDisplay)touchStart=event.changedTouches[0];},{passive:true});
$('#stage-deck').addEventListener('touchend',event=>{if(!touchStart)return;const end=event.changedTouches[0],dx=end.clientX-touchStart.clientX,dy=end.clientY-touchStart.clientY;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy))showSlide(currentSlide+(dx<0?1:-1));touchStart=null;},{passive:true});
showSlide(currentSlide);
refresh();setInterval(refresh,5000);
