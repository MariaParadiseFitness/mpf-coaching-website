/* MPF daily log + weekly check-in (client portal), plus read-only tables for the coach view. */
(function(){
  var DAY=864e5,DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

  // Loom videos: any loom.com/share link in Maria's feedback becomes a playable video under the text.
  var loomH=function(t){var h=esc(t).replace(/\n/g,'<br>'),ids=[],re=/https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})[^\s<]*/gi;
    h=h.replace(re,function(m,id){if(ids.indexOf(id)<0)ids.push(id);return '<a href="https://www.loom.com/share/'+id+'" target="_blank" rel="noopener" style="color:#c9a64b">🎥 Watch my video</a>'});
    return h+ids.map(function(id){return '<div style="position:relative;padding-bottom:56.25%;height:0;margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid rgba(201,166,75,.35)"><iframe src="https://www.loom.com/embed/'+id+'?hide_owner=true&hide_share=true&hide_title=true" frameborder="0" allowfullscreen allow="fullscreen; picture-in-picture" style="position:absolute;inset:0;width:100%;height:100%"></iframe></div>'}).join('')};
  var toT=function(s){return Date.parse(s+'T00:00:00Z')},fromT=function(t){return new Date(t).toISOString().slice(0,10)};
  function nice(d,o){return new Date(toT(d)).toLocaleDateString('en-GB',Object.assign({weekday:'short',day:'numeric',month:'short',timeZone:'UTC'},o||{}))}
  function londonToday(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}}

  var GROUPS=[
    {g:'Morning',i:'⚖️',f:[{k:'weight',l:'Bodyweight',u:'kg',t:'num',ph:'e.g. 72.4',h:'Fasted, after the toilet'},{k:'weighTime',l:'Weigh-in time',t:'time'},{k:'water',l:'Water',u:'litres',t:'num',ph:'e.g. 2.5'}]},
    {g:'Sleep',i:'😴',f:[{k:'sleep',l:'Sleep duration',u:'hrs:mins',t:'text',ph:'e.g. 7:45',h:'Aim for 8 hours'},{k:'sleepScore',l:'Sleep quality',u:'score',t:'num',ph:'From your watch'},{k:'bed',l:'Sleep time',t:'time'},{k:'wake',l:'Wake time',t:'time'}]},
    {g:'Food',i:'🍽️',f:[{k:'carbs',l:'Carbs',u:'g',t:'num'},{k:'protein',l:'Protein',u:'g',t:'num'},{k:'fat',l:'Fat',u:'g',t:'num'},{k:'cals',l:'Calories',u:'kcal',t:'num',ph:'Auto from macros'},{k:'offPlan',l:'Takeaway or off-plan meal?',t:'yn'},{k:'offType',l:'What was it?',t:'pick',o:['Takeaway','Meal out','Drinks / night out','Party or event','Snacks / treats','Other'],if:'offPlan'},{k:'offWhat',l:'What did you have?',t:'text',ph:'Optional, e.g. Nando\'s, half chicken and chips',if:'offPlan'},{k:'alcohol',l:'Any alcohol?',t:'yn',gd:'alcohol',gdl:'Alcohol and fat loss: my guide'},{k:'drinks',l:'How many drinks?',t:'num',ph:'e.g. 2',h:'A pint, a glass of wine or a single with a mixer each count as 1',if:'alcohol'},{k:'bowel',l:'Bowel movements',t:'num',ph:'How many'}]},
    {g:'Activity',i:'👟',f:[{k:'steps',l:'Steps',t:'num',ph:'From your wrist tracker'},{k:'cardio',l:'Cardio',u:'mins',t:'num'},{k:'trained',l:'Did you train today?',t:'yn'},{k:'otherAct',l:'Any other exercise or activity?',t:'yn'},{k:'actType',l:'What did you do?',t:'text',ph:'e.g. pole dance, spin class, football',dl:['Dance class','Pole dance','Spin class','Yoga','Pilates','Reformer Pilates','Barre','HIIT class','Boxing','Kickboxing','Martial arts','Swimming','Running','Cycling','Hiking','Climbing','Football','Netball','Tennis','Padel','Badminton','Squash','Rowing','CrossFit','Zumba','Aerobics','Skating','Horse riding','Golf','Gardening','Other'],if:'otherAct'},{k:'actMins',l:'How long?',u:'mins',t:'num',ph:'e.g. 45',if:'otherAct'},
      {k:'trainTime',l:'Time of training',t:'time',if:'trained'},{k:'desire',l:'Desire to train',t:'scale',if:'trained'},{k:'energyGym',l:'Energy in the gym',t:'scale',if:'trained'},{k:'moodGym',l:'Mood in the gym',t:'scale',if:'trained'}]},
    {g:'How you feel',i:'💛',f:[{k:'energy',l:'Energy outside the gym',t:'scale'},{k:'mood',l:'Mood outside the gym',t:'scale'},{k:'stress',l:'Stress',t:'scale'},{k:'hunger',l:'Hunger',t:'scale'},{k:'adherence',l:'Sticking to the plan',t:'scale'},{k:'rhr',l:'Resting heart rate',u:'bpm',t:'num',ph:'From your watch'},{k:'period',l:'On your period today?',t:'yn',sex:'f'}]},
    {g:'Notes',i:'📝',f:[{k:'notes',l:'Anything else for Maria?',t:'area',ph:'Optional'}]}
  ];
  var LABEL={};GROUPS.forEach(function(g){g.f.forEach(function(f){LABEL[f.k]=f})});

  var num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isNaN(n)?null:n};
  function hours(v){var s=String(v||'').trim(),m=s.match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]+(+m[2])/60:num(s)}
  function kcal(d){var c=num(d.cals);if(c!==null)return c;if(d.carbs||d.protein||d.fat)return 4*(num(d.carbs)||0)+4*(num(d.protein)||0)+9*(num(d.fat)||0);return null}
  function weekStats(days,end){
    var o={daysLogged:0},S={weight:[],steps:[],cals:[],sleep:[],protein:[]};
    for(var i=0;i<7;i++){var d=days[fromT(toT(end)-i*DAY)];if(!d)continue;o.daysLogged++;
      var w=num(d.weight);if(w)S.weight.push(w);var st=num(d.steps);if(st!==null)S.steps.push(st);
      var c=kcal(d);if(c)S.cals.push(c);var sl=hours(d.sleep);if(sl)S.sleep.push(sl);var p=num(d.protein);if(p)S.protein.push(p);if(d.alcohol==='Yes'){o.drinkDays=(o.drinkDays||0)+1;o.drinks=(o.drinks||0)+(num(d.drinks)||0)}else if(d.alcohol==='No'){o.drinkDays=o.drinkDays||0;o.drinks=o.drinks||0}}
    function avg(a,dp){return a.length?+(a.reduce(function(x,y){return x+y},0)/a.length).toFixed(dp):null}
    o.weight=avg(S.weight,1);o.steps=avg(S.steps,0);o.cals=avg(S.cals,0);o.sleep=avg(S.sleep,1);o.protein=avg(S.protein,0);return o;
  }
  // day of cycle: days since the first 'Yes' of the most recent period, counting that day as 1
  // cardio target: "2 x 30 mins a week" = 2 sessions of 30 mins, not every day
  function cardioT(v){var s=String(v||''),m=s.match(/(\d+)\s*x\s*(\d+)/i);if(m&&/week|wk/i.test(s))return {perWeek:+m[1],mins:+m[2]};var n=parseFloat(s);return n>0?{perWeek:0,mins:n}:null}
  function cycleDay(days,date,todayVal){
    var isP=function(d){return d===date?todayVal==='Yes':!!(days[d]&&days[d].period==='Yes')};
    for(var i=0;i<60;i++){var d=fromT(toT(date)-i*DAY);if(isP(d)&&!isP(fromT(toT(d)-DAY)))return i+1}
    return null;
  }
  function fmtN(n){return n==null?'–':Math.round(n).toLocaleString('en-GB')}
  function fmtSleep(h){if(h==null)return '–';var m=Math.round(h*60);return Math.floor(m/60)+':'+String(m%60).padStart(2,'0')}
  function statsHTML(s){
    return '<div class="lg-stats">'+
      '<div><small>Avg weight</small><b>'+(s.weight!=null?s.weight+' kg':'–')+'</b>'+(s.change!=null?'<span>'+(s.change>0?'+':'')+s.change+' kg vs last week</span>':'')+'</div>'+
      '<div><small>Avg steps</small><b>'+fmtN(s.steps)+'</b></div>'+
      '<div><small>Avg calories</small><b>'+fmtN(s.cals)+'</b></div>'+
      '<div><small>Avg protein</small><b>'+(s.protein!=null?fmtN(s.protein)+' g':'–')+'</b></div>'+
      '<div><small>Avg sleep</small><b>'+fmtSleep(s.sleep)+'</b></div>'+
      '<div><small>Days logged</small><b>'+s.daysLogged+' / 7</b></div></div>';
  }
  function api(path,opt){return fetch(path,Object.assign({credentials:'same-origin',cache:'no-store'},opt||{})).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'error');return j})})}

  /* ---------------- daily log (client) ---------------- */
  function Today(el,o){
    o=o||{};var demo=!!o.demo,today=o.today||londonToday(),cur=today,days={},dirty=false;
    el.innerHTML='<div class="lg-nav"><button type="button" class="lg-arr" data-d="-1" aria-label="Previous day">‹</button><div class="lg-date"><b></b><small></small></div><button type="button" class="lg-arr" data-d="1" aria-label="Next day">›</button></div>'+
      '<div class="lg-strip"></div><div class="lg-bars" hidden></div><form class="lg-form" autocomplete="off"></form>'+
      '<div class="lg-save"><span class="lg-msg"></span><button class="btn" type="button">Save</button></div>';
    var form=el.querySelector('form'),msg=el.querySelector('.lg-msg'),saveBtn=el.querySelector('.lg-save .btn');
    function field(f){
      var id='lg-'+f.k,lab='<label for="'+id+'">'+esc(f.l)+(f.u?' <i>'+esc(f.u)+'</i>':'')+'</label>';
      if(f.t==='scale'){var b='';for(var i=1;i<=10;i++)b+='<button type="button" data-v="'+i+'">'+i+'</button>';return '<div class="lg-f lg-wide" data-k="'+f.k+'"'+(f.if?' data-if="'+f.if+'"':'')+'>'+lab.replace('<label for="'+id+'"','<label')+'<div class="lg-scale" data-k="'+f.k+'">'+b+'</div></div>'}
      if(f.t==='yn')return '<div class="lg-f" data-k="'+f.k+'">'+lab.replace('<label for="'+id+'"','<label')+'<div class="lg-yn" data-k="'+f.k+'"><button type="button" data-v="Yes">Yes</button><button type="button" data-v="No">No</button></div></div>';
      if(f.t==='pick')return '<div class="lg-f lg-wide" data-k="'+f.k+'"'+(f.if?' data-if="'+f.if+'"':'')+'>'+lab.replace('<label for="'+id+'"','<label')+'<div class="lg-yn lg-pick" data-k="'+f.k+'">'+f.o.map(function(x){return '<button type="button" data-v="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div></div>';
      if(f.t==='area')return '<div class="lg-f lg-wide">'+lab+'<textarea id="'+id+'" name="'+f.k+'" rows="3" placeholder="'+esc(f.ph||'')+'"></textarea></div>';
      var type=f.t==='time'?'time':'text',im=f.t==='num'?' inputmode="decimal"':'';
      return '<div class="lg-f"'+(f.if?' data-if="'+f.if+'"':'')+'>'+lab+'<input id="'+id+'" name="'+f.k+'" type="'+type+'"'+im+(f.dl?' data-dl="'+f.k+'" autocomplete="off"':'')+' placeholder="'+esc(f.ph||'')+'">'+(f.dl?'<div class="lg-sug" hidden></div>':'')+(f.h?'<small>'+esc(f.h)+'</small>':'')+(f.gd?'<a href="#" class="lg-gl" data-guide="'+f.gd+'">'+esc(f.gdl||'Read my guide')+' →</a>':'')+'<small class="tg" data-tk="'+f.k+'" hidden></small></div>';
    }
    var keep=function(f){return !f.sex||f.sex===o.sex};
    form.innerHTML=GROUPS.map(function(g){return '<fieldset><legend>'+g.i+' '+esc(g.g)+'</legend><div class="lg-grid">'+g.f.filter(keep).map(field).join('')+'</div></fieldset>'}).join('');
    var vals={};
    function setPick(k,v){vals[k]=v;[].forEach.call(form.querySelectorAll('[data-k="'+k+'"] button'),function(b){b.classList.toggle('on',b.getAttribute('data-v')===String(v))});showIf()}
    function cycleNote(){var n=form.querySelector('[data-k="period"]');if(!n)return;var c=cycleDay(days,cur,vals.period);var sm=n.querySelector('small')||n.appendChild(document.createElement('small'));sm.textContent=c?'Cycle day '+c:'Tap Yes on day 1 of your period and your cycle day counts automatically.'}
    function showIf(){cycleNote();[].forEach.call(form.querySelectorAll('[data-if]'),function(n){n.hidden=vals[n.getAttribute('data-if')]!=='Yes'})}
    [].forEach.call(form.querySelectorAll('input[data-dl]'),function(inp){var L=LABEL[inp.getAttribute('data-dl')].dl,box=inp.parentNode.querySelector('.lg-sug');
      var show=function(){var q=inp.value.trim().toLowerCase();if(!q){box.hidden=true;return}var m=L.filter(function(x){return x.toLowerCase().indexOf(q)===0}).concat(L.filter(function(x){var l=x.toLowerCase();return l.indexOf(q)>0})).filter(function(x){return x.toLowerCase()!==q}).slice(0,6);
        box.innerHTML=m.map(function(x){return '<button type="button">'+esc(x)+'</button>'}).join('');box.hidden=!m.length};
      inp.addEventListener('input',show);inp.addEventListener('focus',show);inp.addEventListener('blur',function(){setTimeout(function(){box.hidden=true},150)});
      box.addEventListener('mousedown',function(e){e.preventDefault()});
      box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;inp.value=b.textContent;vals[inp.name]=inp.value;box.hidden=true;inp.dispatchEvent(new Event('input',{bubbles:true}));box.hidden=true;touch()})});
    [].forEach.call(form.querySelectorAll('.lg-scale button,.lg-yn button'),function(b){b.onclick=function(){var k=b.parentNode.getAttribute('data-k'),v=b.getAttribute('data-v');setPick(k,vals[k]===v?'':v);touch()}});
    form.addEventListener('input',function(e){if(e.target.name){vals[e.target.name]=e.target.value;touch();if(/^(carbs|protein|fat)$/.test(e.target.name))calHint();bars()}});
    function calHint(){var c=form.querySelector('[name=cals]');if(c&&!c.value){var k=kcal({carbs:vals.carbs,protein:vals.protein,fat:vals.fat});c.placeholder=k?Math.round(k)+' from macros':'Auto from macros'}}
    function touch(){dirty=true;msg.textContent='Not saved yet';msg.className='lg-msg warn'}
    function fill(){
      var d=days[cur]||{};vals={};
      GROUPS.forEach(function(g){g.f.filter(keep).forEach(function(f){var v=d[f.k]||'';if(f.t==='scale'||f.t==='yn'||f.t==='pick')setPick(f.k,v);else{var inp=form.querySelector('[name="'+f.k+'"]');inp.value=v;vals[f.k]=v}})});
      showIf();calHint();bars();dirty=false;
      msg.className='lg-msg';msg.textContent=d._at?'Saved ✓':'Nothing logged yet';
      el.querySelector('.lg-date b').textContent=cur===today?'Today':(cur===fromT(toT(today)-DAY)?'Yesterday':nice(cur,{weekday:'long'}));
      el.querySelector('.lg-date small').textContent=nice(cur,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      el.querySelector('[data-d="1"]').disabled=cur>=today;
      saveBtn.textContent='Save '+(cur===today?'today':nice(cur,{weekday:'short',month:undefined,day:'numeric'}));
      strip();
    }
    function strip(){
      var h='';for(var i=6;i>=0;i--){var d=fromT(toT(today)-i*DAY),on=!!days[d];h+='<button type="button" data-day="'+d+'" class="'+(on?'done ':'')+(d===cur?'cur':'')+'"><small>'+nice(d,{weekday:'short',day:undefined,month:undefined})+'</small><b>'+(on?'✓':new Date(toT(d)).getUTCDate())+'</b></button>'}
      var s=el.querySelector('.lg-strip');s.innerHTML=h;
      [].forEach.call(s.querySelectorAll('button'),function(b){b.onclick=function(){go(b.getAttribute('data-day'))}});
    }
    function go(d){var g=function(){dirty=false;cur=d;fill();if(lastT)setTargets(lastT)};if(dirty)mpfAsk('You have changes that are not saved. Leave without saving?',{yes:'Leave',red:true},g);else g()}
    [].forEach.call(el.querySelectorAll('.lg-arr'),function(b){b.onclick=function(){var n=fromT(toT(cur)+(+b.getAttribute('data-d'))*DAY);if(n>today||toT(today)-toT(n)>60*DAY)return;go(n)}});
    saveBtn.onclick=function(){
      var data={};Object.keys(vals).forEach(function(k){if(vals[k]!==''&&vals[k]!=null)data[k]=vals[k]});
      saveBtn.disabled=true;msg.textContent='Saving…';msg.className='lg-msg';
      var done=function(day){days[cur]=day;if(!day)delete days[cur];dirty=false;saveBtn.disabled=false;msg.textContent='Saved ✓';msg.className='lg-msg ok';strip();if(o.onSaved)o.onSaved(days);bars();var sk=streak(cur);if(sk>=7&&sk%7===0&&cur===today)streakPop(sk);else if(bars.state&&bars.state.all)congrats(cur)};
      if(demo){setTimeout(function(){done(Object.keys(data).length?Object.assign({_at:new Date().toISOString()},data):null)},300);return}
      api('/portal/api/log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date:cur,data:data})}).then(function(j){done(j.day)}).catch(function(){saveBtn.disabled=false;msg.textContent='Not saved. Check your signal and try again.';msg.className='lg-msg warn'});
    };
    window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=''}});
    function load(d){days=d||{};fill();if(o.onSaved)o.onSaved(days)}
    if(demo)load(o.demoDays||{});
    else api('/portal/api/log?from='+fromT(toT(today)-60*DAY)+'&to='+today).then(function(j){if(j.today&&j.today!==today){today=j.today;cur=today}load(j.days)}).catch(function(){load({})});
    var lastT=null;
    function bars(){var box=el.querySelector('.lg-bars');if(!box)return;var t=dayTargets(lastT||{},cur),num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:null};
      var B=[['cals','Calories',' kcal',1],['protein','Protein','g',0],['carbs','Carbs','g',1],['fat','Fat','g',1],['steps','Steps','',0],['water','Water',' L',0],['cardio','Cardio',' mins',0]];
      var cT=cardioT(t.cardio);var rows=B.map(function(b){var tg=b[0]==='cardio'?(cT?cT.mins:null):num(t[b[0]]);if(!tg||tg<=0)return '';var v=num(vals[b[0]]);if(b[0]==='cardio'&&cT&&cT.perWeek&&!v)return '';if(b[0]==='cals'&&v==null){var k=kcal({carbs:vals.carbs,protein:vals.protein,fat:vals.fat});if(k)v=k}v=v||0;
        var pc=v/tg,cls=pc>=1.1&&b[3]?'over':pc>=0.95?'hit':'',left=tg-v,fm=function(n){return b[0]==='water'?Math.round(n*10)/10:Math.round(n).toLocaleString('en-GB')};
        var note=!v?'Not logged yet':cls==='over'?fm(-left)+b[2]+' over':left>0?(b[0]==='steps'&&left>=1000?stK(left):fm(left))+b[2]+' to go':'Target hit ✓';
        return '<div class="lb-r '+cls+'"><div class="lb-t"><b>'+b[1]+'</b><span>'+fm(v)+' / '+(b[0]==='steps'?stK(tg):fm(tg))+b[2]+'</span></div><div class="lb-b"><i style="width:'+Math.min(100,pc*100).toFixed(1)+'%"></i></div><small>'+note+'</small></div>'}).join('');
      var st={},need=0,got=0;[['protein',0.95],['steps',0.95],['cardio',0.95]].forEach(function(q){var tg=q[0]==='cardio'?(cardioT(t.cardio)||{}).mins:num(t[q[0]]);if(!tg)return;if(q[0]==='cardio'&&(cardioT(t.cardio)||{}).perWeek&&!num(vals.cardio))return;need++;if((num(vals[q[0]])||0)>=tg*q[1])got++});
      var tc=num(t.cals);if(tc){need++;var cv=num(vals.cals);if(cv==null)cv=kcal({carbs:vals.carbs,protein:vals.protein,fat:vals.fat});if(cv&&Math.abs(cv-tc)<=tc*0.1)got++}
      need++;if(vals.trained==='Yes'||vals.trained==='No')got++;
      bars.state={all:need>=3&&got===need,rest:vals.trained==='No'};
      box.hidden=!rows;box.innerHTML=rows?'<div class="lb-h">'+(cur===today?'Today':'This day')+' vs your targets</div>'+rows:''}
    function logged(d){var x=days[d];return !!(x&&Object.keys(x).some(function(k){return k[0]!=='_'&&x[k]!==''}))}
    function streak(d){var n=0;while(n<400&&logged(fromT(toT(d)-n*DAY)))n++;return n}
    function pop(icon,title,text,btn){var m=document.createElement('div');m.className='cg';m.innerHTML='<div class="cg-c"><div class="cg-b">'+icon+'</div><h3>'+title+'</h3><p>'+text+'</p><button type="button" class="btn">'+btn+'</button></div>';
      for(var i=0;i<40;i++){var c=document.createElement('i');c.className='cg-f';c.style.left=Math.random()*100+'%';c.style.animationDelay=(Math.random()*0.8)+'s';c.style.background=['#c9a64b','#e8c872','#fff','#8a6d2b'][i%4];m.appendChild(c)}
      document.body.appendChild(m);var x=function(){m.remove()};m.querySelector('button').onclick=x;m.onclick=function(e){if(e.target===m)x()};try{navigator.vibrate&&navigator.vibrate([60,40,60])}catch(e){}}
    function streakPop(n){var k='mpfStreak:'+today+':'+n;try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch(e){}
      var w=n/7;pop('🔥',n+' days in a row!',w===1?'You\'ve logged every single day this week. That\'s the habit that gets results. Keep the streak going 🖤':w+' weeks without missing a day. Honestly, I\'m so proud of you. This is what consistency looks like 💪','Keep it going 🔥')}
    function congrats(d){var k='mpfAll:'+d;try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch(e){}
      var L=['Protein, steps, cardio and training all done, and calories on point. That\'s how results happen 🔥','You ticked off everything that matters today. So proud of you 🖤','Protein hit, steps hit, calories bang on. Consistency like this changes everything 💪','Perfect day. Keep stacking these and the results take care of themselves 🏆'];
      var m=document.createElement('div');m.className='cg';m.innerHTML='<div class="cg-c"><div class="cg-b">🏆</div><h3>'+(d===today?'You did it!':'Target day!')+'</h3>'+(bars.state&&bars.state.rest?'':'')+'<p>'+L[Math.floor(Math.random()*L.length)]+'</p><button type="button" class="btn">Yes I did 🙌</button></div>';
      for(var i=0;i<40;i++){var c=document.createElement('i');c.className='cg-f';c.style.left=Math.random()*100+'%';c.style.animationDelay=(Math.random()*0.8)+'s';c.style.background=['#c9a64b','#e8c872','#fff','#8a6d2b'][i%4];m.appendChild(c)}
      document.body.appendChild(m);var x=function(){m.remove()};m.querySelector('button').onclick=x;m.onclick=function(e){if(e.target===m)x()};try{navigator.vibrate&&navigator.vibrate([60,40,60])}catch(e){}}
    function setTargets(t0){
      lastT=t0||{};var t=dayTargets(lastT,cur);var U={cals:' kcal',protein:' g',carbs:' g',fat:' g',water:' L',cardio:' mins',sleep:' hrs'};
      [].forEach.call(form.querySelectorAll('.tg'),function(n){var k=n.getAttribute('data-tk'),v=t[k];if(/^(none|no|n\/a|-|0)$/i.test(String(v||'').trim()))v='';n.hidden=!v;if(v)n.textContent='🎯 Target: '+(k==='steps'?stK(v):v)+(/[a-z]/i.test(v)?'':(U[k]||''))});
      bars();var dt=el.querySelector('.lg-daytype');if(!dt){dt=document.createElement('div');dt.className='lg-daytype';var hd=el.querySelector('.lg-nav');if(hd)hd.parentNode.insertBefore(dt,hd.nextSibling)}dt.hidden=!t.dayType;if(t.dayType)dt.textContent=(t.dayType==='High day'?'🔼 ':'🔽 ')+t.dayType+': '+t.cals+' kcal · P '+t.protein+'g · C '+t.carbs+'g · F '+t.fat+'g';
    }
    function reload(){if(demo||dirty)return;api('/portal/api/log?from='+fromT(toT(today)-60*DAY)+'&to='+today).then(function(j){days=j.days||{};fill();if(o.onSaved)o.onSaved(days)}).catch(function(){})}
    window.addEventListener('mpf-workout-saved',function(){setTimeout(reload,600)});
    return {days:function(){return days},setTargets:setTargets,reload:reload};
  }

  /* ---------------- weekly check-in (client) ---------------- */
  function CheckIn(el,o){
    o=o||{};var demo=!!o.demo,today=o.today||londonToday(),day=o.day||'Sunday',Q=[],all={},due,editing=false;
    function pickDue(lastDue){
      if(o.start&&lastDue<=o.start)return fromT(toT(lastDue)+7*DAY);
      var late=!all[lastDue]&&(toT(today)-toT(lastDue))/DAY<=3;
      if(lastDue===today||late)return lastDue;return fromT(toT(lastDue)+7*DAY);
    }
    function draw(){
      var c=all[due],days=o.getDays?o.getDays():{},diff=Math.round((toT(due)-toT(today))/DAY);
      var when=diff===0?'Due today':diff<0?'Was due '+nice(due,{weekday:'long',month:undefined})+'. Please send it now.':'Due '+nice(due,{weekday:'long',day:'numeric',month:'long'})+' (in '+diff+(diff===1?' day':' days')+')';
      var s=c&&!editing?c.stats:weekStats(days,due);
      if(!c||editing){var prev=weekStats(days,fromT(toT(due)-7*DAY));s.change=s.weight&&prev.weight?+(s.weight-prev.weight).toFixed(1):null}
      var photos=o.photoCount?o.photoCount():null;
      var h='<div class="ci-head"><div><div class="kick">'+esc(day)+' check-in</div><h3>Week ending '+nice(due,{weekday:undefined,day:'numeric',month:'long'})+'</h3></div><span class="pill '+(c?'ok':diff<0?'none':diff===0?'part':'off')+'">'+(c?'✓ Sent '+nice(c.at.slice(0,10),{weekday:'short',month:undefined}):when)+'</span></div>';
      h+='<p class="ci-note">'+(c&&!editing?'Here is what you sent. Maria will review it and get back to you.':'Your week\'s numbers come straight from your daily log. Then answer the questions and send.')+'</p>';
      h+=statsHTML(s);
      if(photos!==null)h+='<a class="ci-photos'+(photos===3?' ok':'')+'" href="#photos">📸 '+(photos===3?'All 3 photos uploaded ✓':'Check-in photos: '+photos+' of 3 uploaded. Tap to add them.')+'</a>';
      if(c&&!editing){
        if(c.reply)h+='<div class="ci-fb"><b>💬 Maria\'s feedback</b><p>'+loomH(c.reply.text)+'</p></div>';
        h+='<div class="ci-ans">'+(c.questions||Q).map(function(q,i){return c.answers[i]?'<div><b>'+(i+1)+'. '+esc(q)+'</b><p>'+esc(c.answers[i])+'</p></div>':''}).join('')+'</div>';
        h+='<div class="ci-btns"><button class="btn g" type="button" data-a="edit">Edit my answers</button><a class="btn" href="whatsapp://send?phone=447592791137&text='+encodeURIComponent('Hi Maria, my check-in for '+nice(due,{weekday:'long',month:'short'})+' is done ✅')+'">Tell Maria on WhatsApp</a></div>';
      }else{
        h+='<form class="ci-form">'+Q.map(function(q,i){var v=c?c.answers[i]||'':(draft()[i]||'');var short=false;return '<label><b>'+(i+1)+'. '+esc(q)+'</b>'+(short?'<input name="q'+i+'" type="text" inputmode="numeric" value="'+esc(v)+'">':'<textarea name="q'+i+'" rows="2">'+esc(v)+'</textarea>')+'</label>'}).join('')+
          '<div class="ci-btns"><span class="lg-msg"></span><button class="btn" type="submit">Send my check-in</button></div></form>';
      }
      var fbs=Object.keys(all).filter(function(k){return all[k]&&all[k].reply&&all[k].reply.text}).sort().reverse();
      if(fbs.length){var fbAll=el.__fbAll;h+='<div class="ci-hist"><h4>💬 All my feedback from Maria <span>('+fbs.length+')</span></h4><p class="ci-note">Every reply Maria has sent you, newest first. It\'s all saved here even if you lose it in WhatsApp.</p>'+(fbAll?fbs:fbs.slice(0,3)).map(function(k,i){var r=all[k].reply;return '<details class="ci-fbh"'+(i===0?' open':'')+'><summary><b>Week ending '+nice(k,{weekday:undefined,day:'numeric',month:'short'})+'</b><span>'+new Date(r.at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</span></summary><p>'+loomH(r.text)+'</p></details>'}).join('')+(fbs.length>3?'<button type="button" class="btn g" data-fball="1">'+(fbAll?'Show fewer':'Show all '+fbs.length)+'</button>':'')+'</div>'}
      var older={};Object.keys(all).forEach(function(k){if(k!==due)older[k]=all[k]});if(Object.keys(older).length)h+='<details class="ci-past" style="margin-top:18px"><summary style="cursor:pointer;color:var(--gold-l);font-weight:600">Past check-ins and feedback ('+Object.keys(older).length+')</summary><div style="margin-top:10px">'+checkinList(older)+'</div></details>';
      el.innerHTML=h;var fb=el.querySelector('[data-fball]');if(fb)fb.onclick=function(){el.__fbAll=!el.__fbAll;draw()};
      if(o.onState)o.onState({due:due,done:!!c,diff:diff});
      var f=el.querySelector('form');
      if(f){
        f.addEventListener('input',function(){saveDraft(f)});
        f.onsubmit=function(e){e.preventDefault();
          var answers=Q.map(function(_,i){return f.elements['q'+i].value.trim()});
          if(!answers.some(Boolean)){f.querySelector('.lg-msg').textContent='Answer at least one question first.';return}
          var btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Sending…';
          var ok=function(ci){all[due]=ci;editing=false;clearDraft();draw();el.scrollIntoView({behavior:'smooth',block:'start'})};
          if(demo){var st=weekStats(o.getDays?o.getDays():{},due);setTimeout(function(){ok({answers:answers,questions:Q,stats:st,at:new Date().toISOString()})},300);return}
          api('/portal/api/checkin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({due:due,answers:answers})}).then(function(j){ok(j.checkin)}).catch(function(){btn.disabled=false;btn.textContent='Send my check-in';f.querySelector('.lg-msg').textContent='Not sent. Check your signal and try again.'});
        };
      }
      var e=el.querySelector('[data-a=edit]');if(e)e.onclick=function(){editing=true;draw()};
    }
    var DK='mpfCiDraft:'+(o.email||'')+':';
    function draft(){try{return JSON.parse(localStorage.getItem(DK+due)||'[]')}catch(e){return []}}
    function saveDraft(f){try{localStorage.setItem(DK+due,JSON.stringify(Q.map(function(_,i){return f.elements['q'+i].value})))}catch(e){}}
    function clearDraft(){try{localStorage.removeItem(DK+due)}catch(e){}}
    function start(j){Q=j.questions;all=j.checkins||{};day=j.day||day;if(j.today)today=j.today;due=pickDue(j.lastDue);draw()}
    if(demo){var t=toT(today),want=DAYS.indexOf(day),wd=new Date(t).getUTCDay();start({questions:o.demoQuestions||[],checkins:{},day:day,lastDue:fromT(t-((wd-want+7)%7)*DAY)})}
    else api('/portal/api/checkins').then(start).catch(function(){el.innerHTML='<p class="ci-note">Your check-in could not load. Please refresh the page.</p>'});
    return {refresh:function(){if(Q.length&&!el.querySelector('form'))draw();else if(Q.length){var f=el.querySelector('form');if(f)saveDraft(f);draw()}}};
  }

  /* ---------------- coach: tables ---------------- */
  var COLS=['weight','steps','cals','protein','carbs','fat','water','sleep','cardio','trained','actType','actMins','energy','mood','stress','hunger','adherence','offPlan','offType','alcohol','drinks','mindful'];
  var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function dayTargets(t,date){t=t||{};if(t.hlOn!=='1')return t;var wd=WD[new Date(toT(date)).getUTCDay()],hi=String(t.hiDays||'').split(',').indexOf(wd)>-1,o={};for(var k in t)o[k]=t[k];
    var p=hi?'hi':'lo';o.cals=t[p+'Cals']||t.cals;o.protein=t[p+'P']||t.protein;o.carbs=t[p+'C']||t.carbs;o.fat=t[p+'F']||t.fat;o.dayType=hi?'High day':'Low day';return o}
  function logTable(days,from,to){
    var rows='',cols=COLS.slice();if(Object.keys(days).some(function(d){return days[d].period}))cols.push('cycle');
    var COLS_=cols;
    var gap=[];var flush=function(){if(!gap.length)return;var a=gap[gap.length-1],z=gap[0];rows+='<tr class="miss"><td>'+(gap.length>1?nice(a,{month:undefined})+' to '+nice(z,{month:undefined}):nice(z,{month:undefined}))+'</td><td colspan="'+(COLS_.length+1)+'">Not logged'+(gap.length>1?' · '+gap.length+' days':'')+'</td></tr>';gap=[]};
    for(var t=toT(to);t>=toT(from);t-=DAY){var d=fromT(t),x=days[d];
      var isT=d===londonToday();
      if(!x&&isT){flush();rows+='<tr class="today"><td>Today<small>'+nice(d,{month:undefined})+'</small></td><td colspan="'+(COLS_.length+1)+'">Not logged yet today</td></tr>';continue}
      if(!x){gap.push(d);continue}flush();
      rows+='<tr'+(isT?' class="today"':'')+'><td>'+(isT?'Today<small>'+nice(d,{month:undefined})+'</small>':nice(d,{month:undefined}))+'</td>'+COLS_.map(function(k){var v=x?(k==='cals'?(kcal(x)!=null?Math.round(kcal(x)):''):k==='cycle'?(cycleDay(days,d,x.period)||''):x[k]):'';return '<td>'+esc(v||'')+'</td>'}).join('')+'<td class="nt">'+esc(x&&x.notes||'')+'</td></tr>'}
    flush();
    return '<div class="lt-wrap"><table class="lt"><thead><tr><th>Day</th>'+COLS_.map(function(k){var f=LABEL[k]||{l:'Cycle day'};return '<th>'+esc({cycle:'Cycle day',weight:'Weight kg',steps:'Steps',cals:'Kcal',protein:'Protein g',carbs:'Carbs g',fat:'Fat g',water:'Water L',offPlan:'Off-plan',sleep:'Sleep',cardio:'Cardio min',trained:'Trained',energy:'Energy',mood:'Mood',stress:'Stress',hunger:'Hunger',adherence:'Plan',actType:'Activity',actMins:'Activity min',offType:'Off-plan type',alcohol:'Alcohol',drinks:'Drinks',mindful:'Mindful min'}[k]||f.l)+'</th>'}).join('')+'<th>Notes</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function checkinList(all,opt){
    opt=opt||{};var ds=Object.keys(all||{}).sort().reverse();
    if(!ds.length)return '<p class="ci-note">No check-ins sent yet.</p>';
    return ds.map(function(d,n){var c=all[d];return '<details class="ci-card"'+(n===0?' open':'')+'><summary><b>Week ending '+nice(d,{weekday:'short'})+'</b><span>Sent '+new Date(c.at).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</span></summary>'+(!opt.coach&&c.reply?'<div class="ci-fb"><b>💬 Maria\'s feedback</b><p>'+loomH(c.reply.text)+'</p></div>':'')+statsHTML(c.stats||{daysLogged:0})+'<div class="ci-ans">'+(c.questions||[]).map(function(q,i){return '<div><b>'+(i+1)+'. '+esc(q)+'</b><p>'+(esc(c.answers[i])||'<i>No answer</i>')+'</p></div>'}).join('')+'</div>'+(opt.coach?'<div class="ci-rep" data-due="'+d+'"><b>💬 Your reply'+(c.reply?' <span style="font-weight:400;color:var(--mute);font-size:12px">sent '+new Date(c.reply.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</span>':'')+'</b><textarea rows="4" placeholder="Feedback for this week: wins, what to focus on, any changes">'+esc(c.reply?c.reply.text:'')+'</textarea><div class="loomrow" style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><a class="btn g" href="https://www.loom.com/looms/videos" target="_blank" rel="noopener" title="Record your video in Loom, copy the share link and paste it here">🎥 Record a Loom</a><input class="loomIn" type="url" placeholder="Paste your Loom link here (optional)" style="flex:1;min-width:180px;background:#0e0e0e;color:#fff;border:1px solid rgba(201,166,75,.35);border-radius:10px;padding:9px 10px;font:inherit;font-size:14px"></div><div class="ci-btns"><span class="lg-msg"></span><button class="btn" type="button" data-rep>'+(c.reply?'Update reply':'Send reply')+'</button></div></div>':'')+'</details>'}).join('');
  }

    function stK(v){if(/^\s*[\d.]+\s*k\s*$/i.test(String(v)))return String(v).replace(/\s/g,'').toUpperCase();var n=parseFloat(String(v==null?'':v).replace(/,/g,''));if(!isFinite(n)||/[a-z]/i.test(String(v).replace(/k$/i,'')))return v;if(n<1000)return String(Math.round(n));var k=Math.round(n/100)/10;return (k%1?k.toFixed(1):String(k))+'K'}
  function targetsHTML(t,only){
    if(!t||!Object.keys(t).some(function(k){return k!=='updated'}))return '<div class="pg-empty">Your coach will assign you your calories and macros. They will appear here as soon as they are set.</div>';
    var L=[['cals','Calories','kcal'],['protein','Protein','g'],['carbs','Carbs','g'],['fat','Fat','g'],['steps','Steps',''],['water','Water','L'],['cardio','Cardio','mins'],['sleep','Sleep','hrs']];
    if(only==='move'){var okv=function(v){return v&&!/^(none|no|n\/a|-|0)$/i.test(String(v).trim())};var tile=function(l,v,u){return '<div><small>'+l+'</small><b>'+esc(v)+'</b>'+(u?'<span>'+u+'</span>':'')+'</div>'};
      var dd=[];if(okv(t.cals))dd.push(tile('Calories',t.cals,/[a-z]/i.test(t.cals)?'':'kcal'));if(okv(t.protein))dd.push(tile('Protein',t.protein,/[a-z]/i.test(t.protein)?'':'g'));if(okv(t.steps))dd.push(tile('Steps',stK(t.steps),''));if(okv(t.water))dd.push(tile('Water',t.water,/[a-z]/i.test(t.water)?'':'litres'));if(okv(t.sleep))dd.push(tile('Sleep',t.sleep,/[a-z]/i.test(t.sleep)?'':'hours'));
      var ww=[],ct=cardioT(t.cardio);if(okv(t.cardio)){if(ct&&ct.perWeek)ww.push(tile('Cardio',ct.perWeek+' × '+ct.mins,'mins sessions'));else ww.push(tile('Cardio',String(t.cardio).replace(/\s*a week/i,''),''))}
      var ex=arguments[2]||{};if(ex.checkinDay)ww.push(tile('Check-in',ex.checkinDay,'every week'));
      if(!dd.length&&!ww.length)return '';
      return (dd.length?'<div class="tg-k">Every day</div><div class="lg-stats tgt">'+dd.join('')+'</div>':'')+(ww.length?'<div class="tg-k">Every week</div><div class="lg-stats tgt">'+ww.join('')+'</div>':'')}
    if(only==='food')L=L.slice(0,4);
    if(t.hlOn==='1'){var tt=dayTargets(t,londonToday()),hd=String(t.hiDays||'').split(',').filter(Boolean),row=function(lbl,p,on){return '<div class="hl-row'+(on?' on':'')+'"><b>'+lbl+(on?' <span class="pill ok">Today</span>':'')+'</b><span>'+esc(t[p+'Cals']||'–')+' kcal</span><span>P '+esc(t[p+'P']||'–')+'g</span><span>C '+esc(t[p+'C']||'–')+'g</span><span>F '+esc(t[p+'F']||'–')+'g</span></div>'};
      var rest=L.slice(4).filter(function(x){return t[x[0]]});
      return '<div class="hl-box">'+row('🔼 High day'+(hd.length?' ('+hd.join(', ')+')':''),'hi',tt.dayType==='High day')+row('🔽 Low day','lo',tt.dayType==='Low day')+'</div>'+(rest.length?'<div class="lg-stats tgt">'+rest.map(function(x){var v=x[0]==='steps'?stK(t[x[0]]):t[x[0]];return '<div><small>'+x[1]+'</small><b>'+esc(v)+'</b>'+(x[2]&&!/[a-z]/i.test(v)?'<span>'+x[2]+'</span>':'')+'</div>'}).join('')+'</div>':'')+(t.notes?'<div class="pg-note" style="margin-top:10px">'+esc(t.notes)+'</div>':'')}
    return '<div class="lg-stats tgt">'+L.filter(function(x){return t[x[0]]}).map(function(x){var v=x[0]==='steps'?stK(t[x[0]]):t[x[0]];return '<div><small>'+x[1]+'</small><b>'+esc(v)+'</b>'+(x[2]&&!/[a-z]/i.test(v)?'<span>'+x[2]+'</span>':'')+'</div>'}).join('')+'</div>'+(t.notes?'<div class="pg-note">'+esc(t.notes)+'</div>':'')+(t.updated?'<p class="pg-key">Set by Maria · updated '+new Date(t.updated).toLocaleDateString('en-GB',{day:'numeric',month:'long'})+'</p>':'');
  }
  window.MPFLog={cardioT:cardioT,dayTargets:dayTargets,targetsHTML:targetsHTML,Today:Today,CheckIn:CheckIn,logTable:logTable,checkinList:checkinList,weekStats:weekStats,londonToday:londonToday,fromT:fromT,toT:toT,nice:nice,
    demoDays:function(today,n){var o={},b=74.2;for(var i=n;i>=1;i--){if(i%5===3)continue;var d=fromT(toT(today)-i*DAY);b-=0.04;o[d]={weight:(b+Math.sin(i)*0.4).toFixed(1),steps:String(8000+Math.round(Math.cos(i)*2500)),protein:String(140+i%20),carbs:'180',fat:'55',sleep:'7:'+(10+i%40),trained:i%2?'Yes':'No',energy:String(6+i%4),mood:'8',stress:String(3+i%3),hunger:'5',adherence:'9',water:(i%3?'3':'2.5'),cardio:(i%7===1||i%7===3||i%7===5?'30':''),period:((i-22)%28+28)%28>=24?'Yes':'',flow:((i-22)%28+28)%28===27?'medium':'',sym:(((i-22)%28+28)%28>=19&&((i-22)%28+28)%28<=23?'cravings,bloated':''),_at:'x'}}return o}};
})();
