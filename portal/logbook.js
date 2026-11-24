/* MPF logbook: log sets, reps and weight like a workout app (pick a workout, previous numbers shown, tick sets, rest timer, edit and swap exercises, history, PRs). */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var nk=function(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()};
  var today=function(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}};
  var nice=function(d,o){return new Date(d+'T12:00:00').toLocaleDateString('en-GB',o||{weekday:'short',day:'numeric',month:'short'})};
  var num=function(v){var x=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(x)?0:x};
  var LIB={'Chest':['Barbell Bench Press','Incline Barbell Bench Press','Incline Dumbbell Bench Press','Flat Dumbbell Bench Press','Smith Machine Bench Press','Smith Machine Incline Bench Press','Chest Press Machine','Plate Loaded Incline Chest Press Machine','Chest Fly Machine','Cable Fly','High Cable Fly','Low Cable Fly','Dumbbell Chest Fly','Push Up','Dips'],
    'Back':['Wide Grip Lat Pulldown','Neutral Grip Lat Pulldown','Pull Up','Assisted Pull Up','Seated Cable Row','Single Arm Cable Row','Chest Supported Dumbbell Row','Single Arm Dumbbell Row','Barbell Bent Over Row','T-Bar Row','Machine Row','Straight Arm Cable Pulldown','Machine Pullover','Dumbbell Pullover','Back Extension'],
    'Shoulders':['Seated Dumbbell Shoulder Press','Machine Shoulder Press','Barbell Overhead Press','Dumbbell Lateral Raise','Cable Lateral Raise','Machine Lateral Raise','Rear Delt Machine','Dumbbell Rear Delt Fly','Cable Face Pull','Dumbbell Front Raise','Cable Front Raise','Upright Row','Dumbbell Shrugs','Barbell Shrugs'],
    'Arms':['EZ Bar Curl','Dumbbell Curl','Incline Dumbbell Curl','Hammer Curl','Cable Curl','Preacher Curl','Cable Tricep Pushdown','Rope Tricep Pushdown','Overhead Cable Tricep Extension','Overhead Dumbbell Tricep Extension','EZ Bar Skull Crusher','Dumbbell Skull Crusher','Close Grip Bench Press','Tricep Kickback'],
    'Legs':['Barbell Back Squat','Hack Squat','Leg Press','Smith Machine Squat','Goblet Squat','Bulgarian Split Squat','Walking Lunges','Reverse Lunge','Leg Extension','Lying Leg Curl','Seated Leg Curl','Romanian Deadlift','Dumbbell Romanian Deadlift','Deadlift','Hip Thrust','Glute Bridge','Cable Kickback','Hip Abduction Machine','Hip Adduction Machine','Standing Calf Raise','Seated Calf Raise','Step Ups'],
    'Core':['Plank','Hanging Knee Raise','Hanging Leg Raise','Lying Leg Raise','Ab Wheel Rollout','Cable Crunch','Ab Machine','Russian Twist','Dead Bug'],
    'Cardio':['Treadmill Walk','Incline Walk','Stairmaster','Bike','Cross Trainer','Rowing Machine','Run']};
  var KEY='mpf-logbook-draft'+(window.__mpfAs?'-as-'+window.__mpfAs:'');
  var ST={w:['W','Warm-up'],d:['D','Drop set'],m:['M','Myo-reps / rest-pause'],f:['F','To failure']};
  function setLbl(sets,k){var s=sets[k];if(s.t&&ST[s.t])return ST[s.t][0];var n=0;for(var i=0;i<=k;i++)if(!sets[i].t||sets[i].t==='f')n++;return String(n)}
  function nextFor(e,prev){if(!prev||!e.top)return null;var ws=prev.sets.filter(function(s){return !s.t||s.t==='f'}).filter(function(s){return num(s.kg)&&num(s.reps)});if(!ws.length)return null;
    var top=Math.max.apply(null,ws.map(function(s){return num(s.kg)})),atTop=ws.filter(function(s){return num(s.kg)===top}),all=atTop.every(function(s){return num(s.reps)>=e.top});
    if(!all)return {up:false,kg:top,msg:'Stay at '+top+'kg and beat your reps. Move up when every set hits '+e.top+'.'};
    var inc=top>=40?2.5:top>=4?2:1,nk=Math.round((top+inc)*2)/2;return {up:true,kg:nk,msg:'You hit '+e.top+' reps on every set last time. Go up to '+nk+'kg today 💪'}}
  function chip(x){var t=x.t&&ST[x.t]?'<em class="st-'+x.t+'">'+ST[x.t][0]+'</em> ':'';return t+esc((x.kg?x.kg+'kg':'')+(x.kg&&x.reps?' × ':'')+(x.reps||''))}
  var DEMO_LB=/[?&]demo/.test(location.search)||!!window.__mpfAs,rT=null,rLast='';
  function rPush(v,now){if(DEMO_LB)return;clearTimeout(rT);var go=function(){var s=JSON.stringify(v);if(s===rLast)return;rLast=s;try{if(now&&navigator.sendBeacon){navigator.sendBeacon('/portal/api/workout-draft',new Blob([s],{type:'application/json'}));return}}catch(e){}fetch('/portal/api/workout-draft',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:s,keepalive:true}).catch(function(){rLast=''})};if(now)go();else rT=setTimeout(go,4000)}
  var store={get:function(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}},set:function(v){try{v._at=Date.now();localStorage.setItem(KEY,JSON.stringify(v))}catch(e){}rPush(v)},del:function(){try{localStorage.removeItem(KEY)}catch(e){}clearTimeout(rT);rLast='';if(!DEMO_LB)fetch('/portal/api/workout-draft',{method:'DELETE',credentials:'same-origin'}).catch(function(){})}};
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){var d=store.get();if(d&&d.exercises&&d.exercises.length)rPush(d,true)}});
  window.addEventListener('pagehide',function(){var d=store.get();if(d&&d.exercises&&d.exercises.length)rPush(d,true)});
  function restSecs(t){var s=String(t||'').toLowerCase(),m=s.match(/(\d+(?:\.\d+)?)/);if(!m)return 90;var n=parseFloat(m[1]);if(/min|m\b/.test(s)&&!/s\b|sec/.test(s))return Math.round(n*60);if(n<=5)return Math.round(n*60);return Math.round(n)}
  function setCount(e){var n=parseInt(e.sets,10);return n>0&&n<13?n:3}
  function e1rm(s){var kg=num(s.kg),r=num(s.reps);return kg&&r?kg*(1+Math.min(r,30)/30):0}
  function vol(ex){var v=0;(ex||[]).forEach(function(e){(e.sets||[]).forEach(function(s){v+=num(s.kg)*num(s.reps)})});return Math.round(v)}
  function nSets(ex){var n=0;(ex||[]).forEach(function(e){(e.sets||[]).forEach(function(s){if(s.kg||s.reps)n++})});return n}
  function fmtT(sec){sec=Math.max(0,Math.round(sec));var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?h+':'+(m<10?'0':''):'')+m+':'+(s<10?'0':'')+s}

  function Mount(el,o){
    o=o||{};var doc=o.doc||{programmes:[]},demo=!!o.demo,sessions=null,W=null,view='home',tick=null,rest=null,restTmr=null;
    var progs=(doc.programmes||[]),curProg=progs.filter(function(p){return p.id===doc.current})[0]||progs[0]||null;
    function api(u,b){return fetch(u,b?{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw r.status;return r.json()})}
    function load(){if(demo){sessions=[];show(view);return}el.innerHTML='<p class="ci-note">Loading your logbook…</p>';api('/portal/api/workouts').then(function(j){sessions=j.sessions||[];show(view)}).catch(function(){sessions=[];show(view)})}
    function prevFor(name,skipId){var k=nk(name);for(var i=0;i<sessions.length;i++){if(skipId&&sessions[i].id===skipId)continue;var e=(sessions[i].exercises||[]).filter(function(x){return nk(x.name)===k})[0];if(e&&(e.sets||[]).some(function(s){return s.kg||s.reps}))return {date:sessions[i].date,sets:e.sets.filter(function(s){return s.kg||s.reps})}}return null}
    function bestFor(name,skipId){var k=nk(name),b=0;sessions.forEach(function(s){if(skipId&&s.id===skipId)return;(s.exercises||[]).forEach(function(e){if(nk(e.name)===k)(e.sets||[]).forEach(function(x){b=Math.max(b,e1rm(x))})})});return b}
    function lastDone(wname){var k=nk(wname);for(var i=0;i<sessions.length;i++)if(nk(sessions[i].workout)===k)return sessions[i].date;return ''}
    function allNames(){var o={};progs.forEach(function(p){(p.workouts||[]).forEach(function(w){(w.exercises||[]).forEach(function(e){if(e.name)o[e.name.trim()]=1})})});sessions.forEach(function(s){(s.exercises||[]).forEach(function(e){if(e.name)o[e.name.trim()]=1})});return Object.keys(o).sort()}

    function show(v){view=v;if(v==='active'&&W)drawActive();else if(v==='history')drawHistory();else{view='home';drawHome()}if(o.onView)o.onView(view)}

    /* ---------- home: pick a workout ---------- */
    function drawHome(){
      var d=store.get(),h='';
      if(d&&d.exercises)h+='<div class="lb-resume"><div><b>Workout in progress</b><small>'+esc(d.workout||'Workout')+' · started '+nice(d.date)+'</small></div><button class="btn" type="button" data-a="resume">Resume</button></div>';
      h+='<button type="button" class="lb-start" data-a="new"><span>＋</span><b>Start new workout</b><small>Pick from your programme, or build your own</small></button>';
      var rec=sessions.slice(0,4);
      h+='<div class="lb-row-h"><h3 class="lb-h">Recent workouts</h3>'+(sessions.length?'<button type="button" class="lb-link" data-a="history">See all '+sessions.length+' ›</button>':'')+'</div>';
      h+=rec.length?rec.map(sessCard).join(''):'<p class="ci-note">Nothing logged yet. Your workouts will show here.</p>';
      el.innerHTML=h;bindCards();
      act('resume',function(){W=store.get();show('active')});
      act('new',function(){drawChoose(curProg)});
      act('history',function(){show('history')});
    }
    function drawChoose(p){
      var h='<div class="lb-row-h" style="margin-top:0"><h3 class="lb-h">Start new workout</h3><button type="button" class="lb-link" data-a="home">‹ Back</button></div>';
      if(progs.length){
        if(progs.length>1)h+='<label class="lb-lbl">Workout programme</label><div class="lb-progs">'+progs.map(function(x,i){return '<button type="button" data-pi="'+i+'" class="'+(x===p?'on':'')+'">'+(x.id===doc.current?'★ ':'')+esc(x.title)+'</button>'}).join('')+'</div>';
        h+='<label class="lb-lbl">Choose your workout'+(p?' from <b>'+esc(p.title)+'</b>':'')+'</label>';
        h+=p&&(p.workouts||[]).length?'<div class="lb-pick">'+p.workouts.map(function(w,i){var ld=lastDone(w.name),ex=(w.exercises||[]).filter(function(e){return e.name});return '<button type="button" class="lb-card" data-start="'+i+'"><b>'+esc(w.name)+'</b><small>'+ex.length+' exercises'+(ld?' · last done '+nice(ld,{day:'numeric',month:'short'}):'')+'</small><em>'+esc(ex.slice(0,3).map(function(e){return e.name}).join(', ')+(ex.length>3?'…':''))+'</em><span>Start ›</span></button>'}).join('')+'</div>':'<p class="ci-note">No workouts in this programme yet.</p>';
      }else h+='<p class="lb-sub">No programme yet. Build your own workout below.</p>';
      h+='<button type="button" class="lb-card lb-empty" data-a="empty"><b>＋ Empty workout</b><small>Start blank and pick each exercise yourself</small></button>';
      el.innerHTML=h;window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-80);
      act('home',function(){show('home')});
      [].forEach.call(el.querySelectorAll('[data-pi]'),function(b){b.onclick=function(){drawChoose(progs[+b.getAttribute('data-pi')])}});
      [].forEach.call(el.querySelectorAll('[data-start]'),function(b){b.onclick=function(){startFrom(p,p.workouts[+b.getAttribute('data-start')])}});
      act('empty',function(){if(!confirmReplace())return;begin({workout:'My workout',programme:'',exercises:[]});pickEx()});
    }
    // exercise picker: search, their own exercises first, then a library by body part
    function pickEx(replaceIdx){
      var mine=allNames(),wrap=document.createElement('div');wrap.className='lb-pk';
      wrap.innerHTML='<div class="lb-pkc"><div class="lb-pkh"><b>'+(replaceIdx!=null?'Swap exercise':'Add exercises')+'</b><button type="button" class="lb-link" data-p="x">Done</button></div><input type="search" id="lbQ" placeholder="🔍 Search exercises" autocomplete="off"><div class="lb-pkl" id="lbPkL"></div><div class="lb-pkf"><span id="lbPkN"></span><button type="button" class="btn" data-p="add">Add</button></div></div>';
      document.body.appendChild(wrap);document.body.style.overflow='hidden';
      var sel=[],q='';
      var list=function(){var f=nk(q),grp=[];if(mine.length)grp.push(['Your exercises',mine]);Object.keys(LIB).forEach(function(k){grp.push([k,LIB[k].filter(function(n){return mine.map(nk).indexOf(nk(n))<0})])});
        var h='';if(q&&!grp.some(function(g){return g[1].some(function(n){return nk(n)===f})}))h+='<button type="button" class="lb-pki new" data-n="'+esc(q)+'">＋ Add "'+esc(q)+'" as a new exercise</button>';
        grp.forEach(function(g){var it=g[1].filter(function(n){return !f||nk(n).indexOf(f)>-1});if(!it.length)return;h+='<div class="lb-pkg">'+esc(g[0])+'</div>'+it.map(function(n){return '<button type="button" class="lb-pki'+(sel.indexOf(n)>-1?' on':'')+'" data-n="'+esc(n)+'">'+esc(n)+'<i>'+(sel.indexOf(n)>-1?'✓':'')+'</i></button>'}).join('')});
        wrap.querySelector('#lbPkL').innerHTML=h||'<p class="ci-note">No matches.</p>';wrap.querySelector('#lbPkN').textContent=sel.length?sel.length+' selected':'Tap to select';
        [].forEach.call(wrap.querySelectorAll('.lb-pki'),function(b){b.onclick=function(){var n=b.getAttribute('data-n');if(replaceIdx!=null){sel=[n];go();return}var i=sel.indexOf(n);if(i>-1)sel.splice(i,1);else sel.push(n);if(b.classList.contains('new')){q='';wrap.querySelector('#lbQ').value='';if(mine.indexOf(n)<0)mine.unshift(n)}list()}})};
      var close=function(){wrap.remove();document.body.style.overflow=''};
      var go=function(){close();if(!sel.length)return;if(replaceIdx!=null){W.exercises[replaceIdx].name=sel[0];W.exercises[replaceIdx].target='';W.exercises[replaceIdx].coach=''}else sel.forEach(function(n){var prev=prevFor(n,W.id),c=prev?Math.max(prev.sets.length,1):3;W.exercises.push({name:n,ss:'',notes:'',target:'',rest:90,sets:Array.apply(null,Array(c)).map(function(){return {kg:'',reps:'',done:false}})})});save();drawActive();if(replaceIdx==null){var cards=el.querySelectorAll('.lb-ex');if(cards.length)cards[cards.length-1].scrollIntoView({block:'center'})}};
      wrap.querySelector('#lbQ').oninput=function(e){q=e.target.value.trim();list()};
      wrap.querySelector('[data-p=x]').onclick=function(){if(sel.length)go();else close()};wrap.querySelector('[data-p=add]').onclick=go;
      wrap.onclick=function(e){if(e.target===wrap)close()};
      list();setTimeout(function(){var i=wrap.querySelector('#lbQ');if(i&&window.innerWidth>700)i.focus()},50);
    }
    function act(a,fn){[].forEach.call(el.querySelectorAll('[data-a="'+a+'"]'),function(b){b.onclick=fn})}
    function confirmReplace(){var d=store.get();return !(d&&d.exercises&&d.exercises.length)||confirm('You have a workout in progress. Start a new one instead? The one in progress will be thrown away.')}
    function startFrom(p,w){if(!confirmReplace())return;begin({workout:w.name,programme:p?p.title:'',exercises:(w.exercises||[]).filter(function(e){return e.name}).map(function(e){var op=String(e.opts||'').split(',').map(function(x){return x.trim()}).filter(Boolean);return {name:e.name,group:op.length?e.name.replace(/:?\s*pick( one)?$/i,''):'',opts:op,picked:!op.length,ss:e.ss||'',notes:'',top:(function(){var m=String(e.reps||'').match(/(\d+)\s*(?:-|to|–)\s*(\d+)/);return m?+m[2]:0})(),target:[e.sets&&e.sets+' sets',e.reps&&e.reps+' reps',e.rir&&'RIR '+e.rir,e.tempo&&'tempo '+e.tempo].filter(Boolean).join(' · '),coach:e.notes||'',rest:restSecs(e.rest),sets:(function(){var ss=String(e.sets||''),dm=ss.match(/\+\s*(\d)\s*drop/i),mm=/myo|rest[- ]?pause/i.test(ss+' '+(e.reps||'')),fm=/failure/i.test(ss+' '+(e.reps||'')+' '+(e.rir||'')),n=setCount(e),a=Array.apply(null,Array(n)).map(function(){return {kg:'',reps:'',done:false}});if(mm&&a.length)a[a.length-1].t='m';else if(fm&&a.length)a[a.length-1].t='f';if(dm)for(var i=0;i<+dm[1];i++)a.push({kg:'',reps:'',done:false,t:'d'});return a})()}})})}
    function begin(base){W={id:'',date:today(),workout:base.workout,programme:base.programme,notes:'',start:Date.now(),exercises:base.exercises};save();show('active');window.scrollTo(0,0)}
    function save(){if(W)store.set(W)}

    /* ---------- active workout ---------- */
    function drawActive(){
      var h='<div class="lb-act"><div class="lb-top"><input class="lb-title" id="lbTitle" value="'+esc(W.workout)+'" aria-label="Workout name"><div class="lb-meta"><label>📅 <input type="date" id="lbDate" value="'+esc(W.date)+'" max="'+today()+'"></label>'+(W.id?'<span class="lb-tag">Editing</span>':'<span class="lb-time" id="lbTime">0:00</span>')+'</div></div>';
      if(!W.exercises.length)h+='<p class="ci-note" style="text-align:center;margin:18px 0">No exercises yet. Tap <b>＋ Add exercise</b> to choose some.</p>';
      h+=W.exercises.map(function(e,i){var prev=prevFor(e.name,W.id);
        var nx0=nextFor(e,prev);var rows=e.sets.map(function(s,k){var p=prev&&prev.sets[k],pk=p?p.kg:'',pr=p?p.reps:'';if(nx0&&nx0.up&&!s.t)pk=String(nx0.kg);
          return '<div class="lb-set'+(s.done?' done':'')+(s.t?' st-'+s.t:'')+'" data-k="'+k+'"><button type="button" class="lb-n'+(s.t?' st-'+s.t:'')+'" data-x="setmenu" title="Set type: warm-up, drop set, myo-reps, to failure">'+setLbl(e.sets,k)+'</button><span class="lb-prev">'+(p?esc((pk?pk+'kg':'')+(pk&&pr?' × ':'')+(pr||'')):'-')+'</span><input data-f="kg" inputmode="decimal" placeholder="'+esc(pk||'kg')+'" value="'+esc(s.kg)+'" aria-label="Weight in kg"><input data-f="reps" inputmode="numeric" placeholder="'+esc(pr||'reps')+'" value="'+esc(s.reps)+'" aria-label="Reps"><button type="button" class="lb-tick" data-x="tick" aria-label="Set done">✓</button></div>'}).join('');
        if(e.opts&&e.opts.length&&!e.picked)return '<div class="lb-ex lb-choose" data-e="'+i+'"><div class="lb-eh"><div><b>'+esc(e.group||e.name)+': pick one</b>'+(e.target?'<small>'+esc(e.target)+'</small>':'')+'</div></div><div class="lb-progs">'+e.opts.map(function(n,j){var pv=prevFor(n,W.id);return '<button type="button" data-x="pick" data-o="'+j+'">'+esc(n)+(pv?'<small style="display:block;opacity:.7">last: '+esc((pv.sets[0].kg?pv.sets[0].kg+'kg':'')+(pv.sets[0].kg&&pv.sets[0].reps?' × ':'')+(pv.sets[0].reps||''))+'</small>':'')+'</button>'}).join('')+'</div>'+(e.coach?'<p class="lb-coach">💬 '+esc(e.coach)+'</p>':'')+'</div>';
        var nx=nextFor(e,prev);
        return '<div class="lb-ex'+(e.fin?' lb-fin':'')+'" data-e="'+i+'"><div class="lb-eh"><div><b>'+(e.fin?'<span class="finpill">🔥 Finisher</span> ':'')+(e.ss?'<span class="sspill">'+esc(e.ss)+'</span> ':'')+esc(e.name)+'</b>'+(e.target?'<small>'+esc(e.target)+'</small>':'')+'</div><button type="button" class="lb-more" data-x="menu" aria-label="Exercise options">⋯</button></div>'+
          '<div class="lb-menu" hidden>'+(e.opts&&e.opts.length?'<button type="button" data-x="repick">↩ Pick a different '+esc(e.group||'exercise')+' exercise</button>':'')+'<button type="button" data-x="rename">🔄 Swap exercise</button><button type="button" data-x="up">⬆ Move up</button><button type="button" data-x="down">⬇ Move down</button><button type="button" data-x="fin">'+(e.fin?'✖ Not a finisher':'🔥 Mark as finisher')+'</button><button type="button" data-x="note">📝 Add a note</button><button type="button" data-x="rest">⏱ Rest time ('+fmtT(e.rest||90)+')</button><button type="button" data-x="remove" class="red">🗑 Remove exercise</button></div>'+
          (nx?'<p class="lb-next'+(nx.up?' up':'')+'">'+(nx.up?'📈 ':'🎯 ')+esc(nx.msg)+'</p>':'')+(e.coach?'<p class="lb-coach">💬 '+esc(e.coach)+'</p>':'')+
          '<div class="lb-set lb-hd"><span>Set</span><span>Previous</span><span>kg</span><span>Reps</span><span>✓</span></div>'+rows+
          '<div class="lb-adds"><button type="button" class="lb-add" data-x="addset">＋ Add set</button><button type="button" class="lb-add" data-x="adddrop">＋ Drop set</button></div>'+
          '<textarea class="lb-note" data-f="note" rows="1" placeholder="Notes for this exercise"'+(e.notes?'':' hidden')+'>'+esc(e.notes)+'</textarea></div>'}).join('');
      h+='<button type="button" class="lb-addbig" data-a="addex">＋ Add exercise</button>';
      h+='<label class="pe-full">How did the session go?<textarea id="lbNotes" rows="2" placeholder="Energy, pumps, anything that felt off">'+esc(W.notes)+'</textarea></label>';
      h+='<div class="lb-foot"><span class="lg-msg" id="lbMsg"></span><button class="btn g" type="button" data-a="discard">'+(W.id?'Cancel':'Discard')+'</button><button class="btn" type="button" data-a="finish">'+(W.id?'Save changes':'Finish workout ✓')+'</button></div></div>';
      el.innerHTML=h;bindActive();clock();
    }
    function clock(){clearInterval(tick);var t=el.querySelector('#lbTime');if(!t||W.id)return;var f=function(){t.textContent=fmtT((Date.now()-W.start)/1000)};f();tick=setInterval(function(){if(!document.body.contains(t)){clearInterval(tick);return}f()},1000)}
    function exOf(node){var b=node.closest('[data-e]');return b?+b.getAttribute('data-e'):-1}
    function bindActive(){
      el.querySelector('#lbTitle').oninput=function(e){W.workout=e.target.value;save()};
      el.querySelector('#lbDate').onchange=function(e){W.date=e.target.value||today();save()};
      el.querySelector('#lbNotes').oninput=function(e){W.notes=e.target.value;save()};
      [].forEach.call(el.querySelectorAll('.lb-ex input,.lb-ex textarea'),function(inp){inp.oninput=function(){var i=exOf(inp),e=W.exercises[i],f=inp.getAttribute('data-f');if(f==='note'){e.notes=inp.value}else{var k=+inp.closest('[data-k]').getAttribute('data-k');e.sets[k][f]=inp.value}save()}});
      [].forEach.call(el.querySelectorAll('[data-x]'),function(b){b.onclick=function(){var x=b.getAttribute('data-x'),i=exOf(b),e=W.exercises[i],row=b.closest('[data-k]'),k=row?+row.getAttribute('data-k'):-1;
        if(x==='tick'){var s=e.sets[k];if(!s.done){var kg=row.querySelector('[data-f=kg]'),rp=row.querySelector('[data-f=reps]');if(!s.kg&&kg.placeholder&&kg.placeholder!=='kg')s.kg=kg.placeholder;if(!s.reps&&rp.placeholder&&rp.placeholder!=='reps')s.reps=rp.placeholder;if(!s.kg&&!s.reps){rp.focus();return}s.done=true;startRest(e.rest||90)}else s.done=false;save();drawActive();return}
        if(x==='setmenu'){setSheet(b,e,k);return}
        if(x==='adddrop'){var lt=e.sets[e.sets.length-1]||{},kg=parseFloat(lt.kg);e.sets.push({kg:kg?String(Math.round(kg*0.8*2)/2):'',reps:'',done:false,t:'d'});save();drawActive();return}
        if(x==='fin'){e.fin=!e.fin;save();drawActive();return}
        if(x==='addset'){var last=e.sets[e.sets.length-1]||{};e.sets.push({kg:last.kg||'',reps:last.reps||'',done:false});save();drawActive();return}
        if(x==='menu'){var m=b.closest('.lb-ex').querySelector('.lb-menu');m.hidden=!m.hidden;return}
        if(x==='pick'){var on=e.opts[+b.getAttribute('data-o')],pv=prevFor(on,W.id);e.name=on;e.picked=true;if(pv&&pv.sets.length>e.sets.length)e.sets=pv.sets.map(function(){return {kg:'',reps:'',done:false}});save();drawActive();return}
        if(x==='repick'){if(e.sets.some(function(s){return s.kg||s.reps})&&!confirm('Clear the sets you\'ve logged for '+e.name+' and pick again?'))return;e.picked=false;e.sets=e.sets.map(function(){return {kg:'',reps:'',done:false}});save();drawActive();return}
        if(x==='rename'){pickEx(i);return}
        if(x==='up'&&i>0){W.exercises.splice(i-1,0,W.exercises.splice(i,1)[0]);save();drawActive();return}
        if(x==='down'&&i<W.exercises.length-1){W.exercises.splice(i+1,0,W.exercises.splice(i,1)[0]);save();drawActive();return}
        if(x==='note'){var t=b.closest('.lb-ex').querySelector('.lb-note');t.hidden=false;t.focus();b.closest('.lb-menu').hidden=true;return}
        if(x==='rest'){var r=prompt('Rest between sets, in seconds:',String(e.rest||90));if(r&&+r>0){e.rest=Math.min(900,Math.round(+r));save();drawActive()}return}
        if(x==='remove'){if(confirm('Remove '+e.name+' from this workout?')){W.exercises.splice(i,1);save();drawActive()}return}
      }});
      act('addex',function(){pickEx()});
      act('discard',function(){if(!W.id&&nSets(W.exercises)&&!confirm('Throw this workout away? Nothing will be saved.'))return;W=null;store.del();stopRest();show('home')});
      act('finish',finish);
    }
    function startRest(sec){stopRest();rest={end:Date.now()+sec*1000};var bar=document.createElement('div');bar.className='lb-rest';bar.id='lbRest';bar.innerHTML='<span>⏱ Rest <b id="lbRestT">'+fmtT(sec)+'</b></span><button type="button" data-r="-15">−15s</button><button type="button" data-r="15">+15s</button><button type="button" data-r="0">Skip</button>';document.body.appendChild(bar);
      [].forEach.call(bar.querySelectorAll('[data-r]'),function(b){b.onclick=function(){var d=+b.getAttribute('data-r');if(!d){stopRest();return}rest.end+=d*1000}});
      restTmr=setInterval(function(){var left=(rest.end-Date.now())/1000,t=document.getElementById('lbRestT');if(!t){stopRest();return}if(left<=0){t.textContent='Go! 💪';bar.classList.add('go');try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}clearInterval(restTmr);setTimeout(stopRest,4000);return}t.textContent=fmtT(left)},250)}
    function stopRest(){clearInterval(restTmr);var b=document.getElementById('lbRest');if(b)b.remove();rest=null}
    function setSheet(btn,e,k){var old=document.querySelector('.lb-sheet');if(old)old.remove();var s=e.sets[k],m=document.createElement('div');m.className='lb-sheet';
      m.innerHTML='<div class="lb-sheet-c"><b>Set '+(k+1)+'</b><small>What kind of set was this?</small>'+[['','Normal set'],['w','W · Warm-up'],['d','D · Drop set'],['m','M · Myo-reps / rest-pause'],['f','F · To failure']].map(function(o){return '<button type="button" data-t="'+o[0]+'" class="'+((s.t||'')===o[0]?'on':'')+'">'+o[1]+'</button>'}).join('')+'<button type="button" data-t="del" class="red">🗑 Delete this set</button><button type="button" data-t="x" class="g">Cancel</button></div>';
      document.body.appendChild(m);m.onclick=function(ev){var b=ev.target.closest('[data-t]');if(ev.target===m||(b&&b.getAttribute('data-t')==='x')){m.remove();return}if(!b)return;var t=b.getAttribute('data-t');
        if(t==='del'){if((s.kg||s.reps)&&!confirm('Delete set '+(k+1)+'?'))return;e.sets.splice(k,1)}else{if(t)s.t=t;else delete s.t}m.remove();save();drawActive()}}
    function finish(){
      var m=el.querySelector('#lbMsg');
      var ex=W.exercises.map(function(e){return {name:e.name,ss:e.ss||'',fin:!!e.fin,notes:e.notes||'',sets:e.sets.filter(function(s){return s.kg||s.reps}).map(function(s){var o={kg:s.kg,reps:s.reps,done:!!s.done};if(s.t)o.t=s.t;return o})}}).filter(function(e){return e.sets.length||e.notes});
      if(!ex.some(function(e){return e.sets.length})){m.textContent='Fill in at least one set first.';m.className='lg-msg warn';return}
      var prs=[];ex.forEach(function(e){var b=bestFor(e.name,W.id),top=0,ts=null;e.sets.forEach(function(s){var v=e1rm(s);if(v>top){top=v;ts=s}});if(b&&top>b+0.01)prs.push(e.name+': '+ts.kg+'kg × '+ts.reps)});
      var dur=W.id?0:Math.round((Date.now()-W.start)/60000);
      var body={id:W.id||Math.random().toString(36).slice(2,10),date:W.date,programme:W.programme,workout:W.workout||'Workout',notes:W.notes+(dur&&!/^\s*$/.test(W.notes)?'':'')+'',exercises:ex};
      m.textContent='Saving…';m.className='lg-msg';
      var done=function(){stopRest();store.del();var s=Object.assign({},body,{at:new Date().toISOString()});sessions=sessions.filter(function(x){return x.id!==s.id});sessions.unshift(s);sessions.sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0});var was=W;W=null;summary(s,prs,dur,!!was.id)};
      if(demo){done();return}
      var chain=(W.id&&W.oldDate&&W.oldDate!==W.date)?api('/portal/api/workout',{id:W.id,date:W.oldDate,delete:true}):Promise.resolve();
      chain.then(function(){return api('/portal/api/workout',body)}).then(done).catch(function(c){m.textContent=c===400?'That date is too far back to save.':'Not saved. Check your signal and tap again. Nothing is lost.';m.className='lg-msg warn'});
    }
    function summary(s,prs,dur,edited){
      el.innerHTML='<div class="lb-done"><div class="lb-big">'+(edited?'✓':'💪')+'</div><h3>'+(edited?'Workout updated':'Workout complete!')+'</h3><p>'+esc(s.workout)+' · '+nice(s.date)+'</p><div class="lb-stats">'+(dur?'<span><b>'+dur+'</b>min</span>':'')+'<span><b>'+s.exercises.length+'</b>exercises</span><span><b>'+nSets(s.exercises)+'</b>sets</span><span><b>'+vol(s.exercises).toLocaleString('en-GB')+'</b>kg lifted</span></div>'+
        (prs.length?'<div class="lb-prs"><b>🏆 New personal bests</b>'+prs.map(function(p){return '<div>'+esc(p)+'</div>'}).join('')+'</div>':'')+
        '<div class="lb-foot"><button class="btn g" type="button" data-a="history">See logbook</button><button class="btn" type="button" data-a="home">Done</button></div></div>';
      act('home',function(){show('home')});act('history',function(){show('history')});window.scrollTo(0,0);
    }

    /* ---------- history ---------- */
    function sessCard(s){var ex=(s.exercises||[]).filter(function(e){return (e.sets||[]).some(function(x){return x.kg||x.reps})});
      return '<details class="lb-hist" data-id="'+esc(s.id)+'" data-d="'+esc(s.date)+'"><summary><div><b>'+esc(s.workout||'Workout')+'</b><small>'+nice(s.date)+' · '+ex.length+' exercises · '+nSets(ex)+' sets · '+vol(ex).toLocaleString('en-GB')+' kg</small></div><span class="lb-chev">›</span></summary>'+
        '<div class="lb-hb">'+ex.map(function(e){return '<div class="lb-he"><b>'+(e.fin?'🔥 ':'')+esc(e.name)+'</b><div class="lb-chips">'+e.sets.filter(function(x){return x.kg||x.reps}).map(function(x){return '<span>'+chip(x)+'</span>'}).join('')+'</div>'+(e.notes?'<i>'+esc(e.notes)+'</i>':'')+'</div>'}).join('')+(s.notes?'<p class="lb-sn">'+esc(s.notes)+'</p>':'')+
        (o.readOnly?'':'<div class="lb-hact"><button type="button" class="btn g" data-h="again">↻ Do again</button><button type="button" class="btn g" data-h="edit">✏️ Edit</button><button type="button" class="btn g red" data-h="del">🗑 Delete</button></div>')+'</div></details>'}
    function bindCards(){[].forEach.call(el.querySelectorAll('[data-h]'),function(b){b.onclick=function(){var card=b.closest('.lb-hist'),id=card.getAttribute('data-id'),s=sessions.filter(function(x){return x.id===id})[0];if(!s)return;var h=b.getAttribute('data-h');
      if(h==='again'){if(!confirmReplace())return;begin({workout:s.workout,programme:s.programme,exercises:s.exercises.map(function(e){return {name:e.name,ss:e.ss||'',notes:'',target:'',rest:90,fin:!!e.fin,sets:e.sets.filter(function(x){return x.kg||x.reps}).map(function(x){var o={kg:'',reps:'',done:false};if(x.t)o.t=x.t;return o})}})})}
      if(h==='edit'){if(!confirmReplace())return;W={id:s.id,oldDate:s.date,date:s.date,workout:s.workout,programme:s.programme||'',notes:s.notes||'',start:Date.now(),exercises:s.exercises.map(function(e){return {name:e.name,ss:e.ss||'',notes:e.notes||'',target:'',rest:90,fin:!!e.fin,sets:e.sets.map(function(x){var o={kg:x.kg,reps:x.reps,done:true};if(x.t)o.t=x.t;return o})}})};save();show('active');window.scrollTo(0,0)}
      if(h==='del'){if(!confirm('Delete '+s.workout+' on '+nice(s.date)+'? This cannot be undone.'))return;(demo?Promise.resolve():api('/portal/api/workout',{id:s.id,date:s.date,delete:true})).then(function(){sessions=sessions.filter(function(x){return x.id!==id});show(view)}).catch(function(){alert('Not deleted. Try again.')})}
    }})}
    function monday(d){var t=new Date(d+'T12:00:00'),w=(t.getDay()+6)%7;t.setDate(t.getDate()-w);return t.toISOString().slice(0,10)}
    function weeksOf(list,openFirst){var wk={};list.forEach(function(x){var k=monday(x.date);(wk[k]=wk[k]||[]).push(x)});
      return Object.keys(wk).sort().reverse().map(function(k,j){var end=new Date(k+'T12:00:00');end.setDate(end.getDate()+6);var e=end.toISOString().slice(0,10);
        return '<details class="lb-wk"'+(openFirst&&j===0?' open':'')+'><summary><b>Week of '+nice(k,{day:'numeric',month:'short'})+'</b><small>'+nice(k,{day:'numeric',month:'short'})+' to '+nice(e,{day:'numeric',month:'short'})+' · '+wk[k].length+' workout'+(wk[k].length===1?'':'s')+'</small><span class="lb-chev">›</span></summary><div class="lb-days">'+wk[k].map(sessCard).join('')+'</div></details>'}).join('')}
    function drawHistory(){
      var h='<div class="lb-row-h"><h3 class="lb-h">My logbook</h3><button type="button" class="lb-link" data-a="home">‹ Back</button></div>';
      if(!sessions.length){el.innerHTML=h+'<p class="ci-note">No workouts logged yet.</p>';act('home',function(){show('home')});return}
      var names=allNames().filter(function(n){return bestFor(n)>0});
      h+='<div class="lb-prog"><label>📈 Track an exercise <select id="lbEx"><option value="">Pick an exercise…</option>'+names.map(function(n){return '<option>'+esc(n)+'</option>'}).join('')+'</select></label><div id="lbExOut"></div></div>';
      var by={};sessions.forEach(function(s){var m=s.date.slice(0,7);(by[m]=by[m]||[]).push(s)});
      h+=Object.keys(by).sort().reverse().map(function(m,i){return '<details class="lb-fold"'+(i===0?' open':'')+'><summary><span class="lb-fi">📁</span><b>'+new Date(m+'-15T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</b><small>'+by[m].length+' workout'+(by[m].length===1?'':'s')+' · '+vol([].concat.apply([],by[m].map(function(s){return s.exercises||[]}))).toLocaleString('en-GB')+' kg</small><span class="lb-chev">›</span></summary><div class="lb-fb">'+weeksOf(by[m],i===0)+'</div></details>'}).join('');
      el.innerHTML=h;bindCards();act('home',function(){show('home')});
      el.querySelector('#lbEx').onchange=function(e){var n=e.target.value,out=el.querySelector('#lbExOut');if(!n){out.innerHTML='';return}var k=nk(n),pts=[];sessions.slice().reverse().forEach(function(s){(s.exercises||[]).forEach(function(x){if(nk(x.name)!==k)return;var top=null;(x.sets||[]).forEach(function(st){if(!top||e1rm(st)>e1rm(top)||(!e1rm(top)&&num(st.reps)>num(top.reps)))top=st});if(top&&(top.kg||top.reps))pts.push({d:s.date,s:top})})});
        if(!pts.length){out.innerHTML='';return}var best=pts.reduce(function(a,b){return e1rm(b.s)>e1rm(a.s)?b:a});
        out.innerHTML='<p class="lb-sub">Best set: <b>'+esc(best.s.kg)+'kg × '+esc(best.s.reps)+'</b> on '+nice(best.d,{day:'numeric',month:'short'})+' · done '+pts.length+' times</p><div class="lb-trend">'+pts.slice(-12).map(function(p){return '<div><small>'+nice(p.d,{day:'numeric',month:'short'})+'</small><b>'+esc((p.s.kg?p.s.kg+'kg':'')+(p.s.kg&&p.s.reps?' × ':'')+(p.s.reps||''))+'</b></div>'}).join('')+'</div>'}
    }

    var d0=store.get();if(d0&&d0.exercises&&o.resume!==false){W=d0;view='active'}
    load();
    // no workout on this phone? check for one backed up from another session (closed screen, other device, phone glitch)
    if(!DEMO_LB&&o.resume!==false)fetch('/portal/api/workout-draft',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var rw=j&&j.w;if(!rw||!rw.exercises||!rw.exercises.length)return;var lw=store.get();if(lw&&lw.exercises&&(lw._at||0)>=(rw._at||0))return;try{localStorage.setItem(KEY,JSON.stringify(rw))}catch(e){}W=rw;if(sessions)show('active');else view='active';if(o.onResume)o.onResume()}).catch(function(){});
    if(W&&o.onResume)setTimeout(o.onResume,0);
    return {show:function(v){if(sessions)show(v)},start:function(i){if(curProg&&curProg.workouts[i])startFrom(curProg,curProg.workouts[i])},view:function(){return view}};
  }
  window.MPFLogbook={Mount:Mount};
})();
