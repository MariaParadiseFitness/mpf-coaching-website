/* MPF logbook: log sets, reps and weight like a workout app (pick a workout, previous numbers shown, tick sets, rest timer, edit and swap exercises, history, PRs). */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var nk=function(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()};
  var today=function(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}};
  var nice=function(d,o){return new Date(d+'T12:00:00').toLocaleDateString('en-GB',o||{weekday:'short',day:'numeric',month:'short'})};
  var num=function(v){var x=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(x)?0:x};
  var KEY='mpf-logbook-draft'+(window.__mpfAs?'-as-'+window.__mpfAs:'');
  var store={get:function(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}},set:function(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch(e){}},del:function(){try{localStorage.removeItem(KEY)}catch(e){}}};
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
      h+='<h3 class="lb-h">Start a workout</h3>';
      if(curProg&&(curProg.workouts||[]).length){h+='<p class="lb-sub">From <b>'+esc(curProg.title)+'</b>. Your last weights show next to every set.</p><div class="lb-pick">'+curProg.workouts.map(function(w,i){var ld=lastDone(w.name);return '<button type="button" class="lb-card" data-start="'+i+'"><b>'+esc(w.name)+'</b><small>'+(w.exercises||[]).filter(function(e){return e.name}).length+' exercises'+(ld?' · last done '+nice(ld,{day:'numeric',month:'short'}):'')+'</small><span>Start ›</span></button>'}).join('')+'</div>'}
      else h+='<p class="lb-sub">No programme yet. You can still log any workout below.</p>';
      h+='<button type="button" class="lb-card lb-empty" data-a="empty"><b>＋ Empty workout</b><small>Build your own session, add any exercise</small></button>';
      var rec=sessions.slice(0,4);
      h+='<div class="lb-row-h"><h3 class="lb-h">Recent workouts</h3>'+(sessions.length?'<button type="button" class="lb-link" data-a="history">See all '+sessions.length+' ›</button>':'')+'</div>';
      h+=rec.length?rec.map(sessCard).join(''):'<p class="ci-note">Nothing logged yet. Your workouts will show here.</p>';
      el.innerHTML=h;bindCards();
      [].forEach.call(el.querySelectorAll('[data-start]'),function(b){b.onclick=function(){startFrom(curProg,curProg.workouts[+b.getAttribute('data-start')])}});
      act('resume',function(){W=store.get();show('active')});
      act('empty',function(){begin({workout:'Workout',programme:'',exercises:[]})});
      act('history',function(){show('history')});
    }
    function act(a,fn){[].forEach.call(el.querySelectorAll('[data-a="'+a+'"]'),function(b){b.onclick=fn})}
    function confirmReplace(){var d=store.get();return !(d&&d.exercises&&d.exercises.length)||confirm('You have a workout in progress. Start a new one instead? The one in progress will be thrown away.')}
    function startFrom(p,w){if(!confirmReplace())return;begin({workout:w.name,programme:p?p.title:'',exercises:(w.exercises||[]).filter(function(e){return e.name}).map(function(e){return {name:e.name,ss:e.ss||'',notes:'',target:[e.sets&&e.sets+' sets',e.reps&&e.reps+' reps',e.rir&&'RIR '+e.rir,e.tempo&&'tempo '+e.tempo].filter(Boolean).join(' · '),coach:e.notes||'',rest:restSecs(e.rest),sets:Array.apply(null,Array(setCount(e))).map(function(){return {kg:'',reps:'',done:false}})}})})}
    function begin(base){W={id:'',date:today(),workout:base.workout,programme:base.programme,notes:'',start:Date.now(),exercises:base.exercises};save();show('active');window.scrollTo(0,0)}
    function save(){if(W)store.set(W)}

    /* ---------- active workout ---------- */
    function drawActive(){
      var names=allNames();
      var h='<div class="lb-act"><div class="lb-top"><input class="lb-title" id="lbTitle" value="'+esc(W.workout)+'" aria-label="Workout name"><div class="lb-meta"><label>📅 <input type="date" id="lbDate" value="'+esc(W.date)+'" max="'+today()+'"></label>'+(W.id?'<span class="lb-tag">Editing</span>':'<span class="lb-time" id="lbTime">0:00</span>')+'</div></div>';
      h+=W.exercises.map(function(e,i){var prev=prevFor(e.name,W.id);
        var rows=e.sets.map(function(s,k){var p=prev&&prev.sets[k],pk=p?p.kg:'',pr=p?p.reps:'';
          return '<div class="lb-set'+(s.done?' done':'')+'" data-k="'+k+'"><button type="button" class="lb-n" data-x="setmenu" title="Set options">'+(k+1)+'</button><span class="lb-prev">'+(p?esc((pk?pk+'kg':'')+(pk&&pr?' × ':'')+(pr||'')):'-')+'</span><input data-f="kg" inputmode="decimal" placeholder="'+esc(pk||'kg')+'" value="'+esc(s.kg)+'" aria-label="Weight in kg"><input data-f="reps" inputmode="numeric" placeholder="'+esc(pr||'reps')+'" value="'+esc(s.reps)+'" aria-label="Reps"><button type="button" class="lb-tick" data-x="tick" aria-label="Set done">✓</button></div>'}).join('');
        return '<div class="lb-ex" data-e="'+i+'"><div class="lb-eh"><div><b>'+(e.ss?'<span class="sspill">'+esc(e.ss)+'</span> ':'')+esc(e.name)+'</b>'+(e.target?'<small>'+esc(e.target)+'</small>':'')+'</div><button type="button" class="lb-more" data-x="menu" aria-label="Exercise options">⋯</button></div>'+
          '<div class="lb-menu" hidden><button type="button" data-x="rename">✏️ Change exercise</button><button type="button" data-x="up">⬆ Move up</button><button type="button" data-x="down">⬇ Move down</button><button type="button" data-x="note">📝 Add a note</button><button type="button" data-x="rest">⏱ Rest time ('+fmtT(e.rest||90)+')</button><button type="button" data-x="remove" class="red">🗑 Remove exercise</button></div>'+
          (e.coach?'<p class="lb-coach">💬 '+esc(e.coach)+'</p>':'')+
          '<div class="lb-set lb-hd"><span>Set</span><span>Previous</span><span>kg</span><span>Reps</span><span>✓</span></div>'+rows+
          '<button type="button" class="lb-add" data-x="addset">＋ Add set</button>'+
          '<textarea class="lb-note" data-f="note" rows="1" placeholder="Notes for this exercise"'+(e.notes?'':' hidden')+'>'+esc(e.notes)+'</textarea></div>'}).join('');
      h+='<div class="lb-addex"><input id="lbNew" list="lbNames" placeholder="＋ Add an exercise (type a name)"><datalist id="lbNames">'+names.map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist><button class="btn g" type="button" data-a="addex">Add</button></div>';
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
        if(x==='setmenu'){var s2=e.sets[k];if((s2.kg||s2.reps)&&!confirm('Delete set '+(k+1)+'?'))return;e.sets.splice(k,1);save();drawActive();return}
        if(x==='addset'){var last=e.sets[e.sets.length-1]||{};e.sets.push({kg:last.kg||'',reps:last.reps||'',done:false});save();drawActive();return}
        if(x==='menu'){var m=b.closest('.lb-ex').querySelector('.lb-menu');m.hidden=!m.hidden;return}
        if(x==='rename'){var nn=prompt('Change exercise to:',e.name);if(nn&&nn.trim()){e.name=nn.trim();e.target=e.target||'';save();drawActive()}return}
        if(x==='up'&&i>0){W.exercises.splice(i-1,0,W.exercises.splice(i,1)[0]);save();drawActive();return}
        if(x==='down'&&i<W.exercises.length-1){W.exercises.splice(i+1,0,W.exercises.splice(i,1)[0]);save();drawActive();return}
        if(x==='note'){var t=b.closest('.lb-ex').querySelector('.lb-note');t.hidden=false;t.focus();b.closest('.lb-menu').hidden=true;return}
        if(x==='rest'){var r=prompt('Rest between sets, in seconds:',String(e.rest||90));if(r&&+r>0){e.rest=Math.min(900,Math.round(+r));save();drawActive()}return}
        if(x==='remove'){if(confirm('Remove '+e.name+' from this workout?')){W.exercises.splice(i,1);save();drawActive()}return}
      }});
      var add=function(){var inp=el.querySelector('#lbNew'),n=inp.value.trim();if(!n){inp.focus();return}var prev=prevFor(n,W.id),c=prev?Math.max(prev.sets.length,1):3;W.exercises.push({name:n,ss:'',notes:'',target:'',rest:90,sets:Array.apply(null,Array(c)).map(function(){return {kg:'',reps:'',done:false}})});save();drawActive();var cards=el.querySelectorAll('.lb-ex');if(cards.length)cards[cards.length-1].scrollIntoView({block:'center'})};
      act('addex',add);el.querySelector('#lbNew').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();add()}};
      act('discard',function(){if(!W.id&&nSets(W.exercises)&&!confirm('Throw this workout away? Nothing will be saved.'))return;W=null;store.del();stopRest();show('home')});
      act('finish',finish);
    }
    function startRest(sec){stopRest();rest={end:Date.now()+sec*1000};var bar=document.createElement('div');bar.className='lb-rest';bar.id='lbRest';bar.innerHTML='<span>⏱ Rest <b id="lbRestT">'+fmtT(sec)+'</b></span><button type="button" data-r="-15">−15s</button><button type="button" data-r="15">+15s</button><button type="button" data-r="0">Skip</button>';document.body.appendChild(bar);
      [].forEach.call(bar.querySelectorAll('[data-r]'),function(b){b.onclick=function(){var d=+b.getAttribute('data-r');if(!d){stopRest();return}rest.end+=d*1000}});
      restTmr=setInterval(function(){var left=(rest.end-Date.now())/1000,t=document.getElementById('lbRestT');if(!t){stopRest();return}if(left<=0){t.textContent='Go! 💪';bar.classList.add('go');try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}clearInterval(restTmr);setTimeout(stopRest,4000);return}t.textContent=fmtT(left)},250)}
    function stopRest(){clearInterval(restTmr);var b=document.getElementById('lbRest');if(b)b.remove();rest=null}
    function finish(){
      var m=el.querySelector('#lbMsg');
      var ex=W.exercises.map(function(e){return {name:e.name,ss:e.ss||'',notes:e.notes||'',sets:e.sets.filter(function(s){return s.kg||s.reps}).map(function(s){return {kg:s.kg,reps:s.reps,done:!!s.done}})}}).filter(function(e){return e.sets.length||e.notes});
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
        '<div class="lb-hb">'+ex.map(function(e){return '<div class="lb-he"><b>'+esc(e.name)+'</b><div class="lb-chips">'+e.sets.filter(function(x){return x.kg||x.reps}).map(function(x){return '<span>'+esc((x.kg?x.kg+'kg':'')+(x.kg&&x.reps?' × ':'')+(x.reps||''))+'</span>'}).join('')+'</div>'+(e.notes?'<i>'+esc(e.notes)+'</i>':'')+'</div>'}).join('')+(s.notes?'<p class="lb-sn">'+esc(s.notes)+'</p>':'')+
        (o.readOnly?'':'<div class="lb-hact"><button type="button" class="btn g" data-h="again">↻ Do again</button><button type="button" class="btn g" data-h="edit">✏️ Edit</button><button type="button" class="btn g red" data-h="del">🗑 Delete</button></div>')+'</div></details>'}
    function bindCards(){[].forEach.call(el.querySelectorAll('[data-h]'),function(b){b.onclick=function(){var card=b.closest('.lb-hist'),id=card.getAttribute('data-id'),s=sessions.filter(function(x){return x.id===id})[0];if(!s)return;var h=b.getAttribute('data-h');
      if(h==='again'){if(!confirmReplace())return;begin({workout:s.workout,programme:s.programme,exercises:s.exercises.map(function(e){return {name:e.name,ss:e.ss||'',notes:'',target:'',rest:90,sets:e.sets.filter(function(x){return x.kg||x.reps}).map(function(){return {kg:'',reps:'',done:false}})}})})}
      if(h==='edit'){if(!confirmReplace())return;W={id:s.id,oldDate:s.date,date:s.date,workout:s.workout,programme:s.programme||'',notes:s.notes||'',start:Date.now(),exercises:s.exercises.map(function(e){return {name:e.name,ss:e.ss||'',notes:e.notes||'',target:'',rest:90,sets:e.sets.map(function(x){return {kg:x.kg,reps:x.reps,done:true}})}})};save();show('active');window.scrollTo(0,0)}
      if(h==='del'){if(!confirm('Delete '+s.workout+' on '+nice(s.date)+'? This cannot be undone.'))return;(demo?Promise.resolve():api('/portal/api/workout',{id:s.id,date:s.date,delete:true})).then(function(){sessions=sessions.filter(function(x){return x.id!==id});show(view)}).catch(function(){alert('Not deleted. Try again.')})}
    }})}
    function drawHistory(){
      var h='<div class="lb-row-h"><h3 class="lb-h">My logbook</h3><button type="button" class="lb-link" data-a="home">‹ Back</button></div>';
      if(!sessions.length){el.innerHTML=h+'<p class="ci-note">No workouts logged yet.</p>';act('home',function(){show('home')});return}
      var names=allNames().filter(function(n){return bestFor(n)>0});
      h+='<div class="lb-prog"><label>📈 Track an exercise <select id="lbEx"><option value="">Pick an exercise…</option>'+names.map(function(n){return '<option>'+esc(n)+'</option>'}).join('')+'</select></label><div id="lbExOut"></div></div>';
      var by={};sessions.forEach(function(s){var m=s.date.slice(0,7);(by[m]=by[m]||[]).push(s)});
      h+=Object.keys(by).sort().reverse().map(function(m){return '<h4 class="lb-month">'+new Date(m+'-15T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})+' <small>'+by[m].length+' workouts</small></h4>'+by[m].map(sessCard).join('')}).join('');
      el.innerHTML=h;bindCards();act('home',function(){show('home')});
      el.querySelector('#lbEx').onchange=function(e){var n=e.target.value,out=el.querySelector('#lbExOut');if(!n){out.innerHTML='';return}var k=nk(n),pts=[];sessions.slice().reverse().forEach(function(s){(s.exercises||[]).forEach(function(x){if(nk(x.name)!==k)return;var top=null;(x.sets||[]).forEach(function(st){if(!top||e1rm(st)>e1rm(top)||(!e1rm(top)&&num(st.reps)>num(top.reps)))top=st});if(top&&(top.kg||top.reps))pts.push({d:s.date,s:top})})});
        if(!pts.length){out.innerHTML='';return}var best=pts.reduce(function(a,b){return e1rm(b.s)>e1rm(a.s)?b:a});
        out.innerHTML='<p class="lb-sub">Best set: <b>'+esc(best.s.kg)+'kg × '+esc(best.s.reps)+'</b> on '+nice(best.d,{day:'numeric',month:'short'})+' · done '+pts.length+' times</p><div class="lb-trend">'+pts.slice(-12).map(function(p){return '<div><small>'+nice(p.d,{day:'numeric',month:'short'})+'</small><b>'+esc((p.s.kg?p.s.kg+'kg':'')+(p.s.kg&&p.s.reps?' × ':'')+(p.s.reps||''))+'</b></div>'}).join('')+'</div>'}
    }

    var d0=store.get();if(d0&&d0.exercises&&o.resume!==false){W=d0;view='active'}
    load();
    return {show:function(v){if(sessions)show(v)},start:function(i){if(curProg&&curProg.workouts[i])startFrom(curProg,curProg.workouts[i])},view:function(){return view}};
  }
  window.MPFLogbook={Mount:Mount};
})();
