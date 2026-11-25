/* MPF training programme: read-only view (client) and editor (coach). Stored on the website, not in Google Sheets. */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var COLS=[{k:'ss',l:'SS',w:'w-ss'},{k:'name',l:'Exercise',w:'w-name'},{k:'opts',l:'Pick from (comma separated)',w:'w-notes'},{k:'sets',l:'Sets',w:'w-s'},{k:'reps',l:'Reps',w:'w-s'},{k:'tempo',l:'Tempo',w:'w-s'},{k:'rir',l:'RIR',w:'w-s'},{k:'rest',l:'Rest',w:'w-s'},{k:'notes',l:'Notes',w:'w-notes'}];
  function upd(p){return p&&p.updated?new Date(p.updated).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):''}

  /* ---------- client: read-only ---------- */
  function order(doc){var cur=doc.current,ps=(doc.programmes||[]).slice();ps.sort(function(a,b){return (b.id===cur)-(a.id===cur)||(b.created>a.created?1:-1)});return ps}
  function View(el,doc,opts){opts=opts||{};
    var ps=doc&&doc.programmes?order(doc):[];
    if(!ps.length){el.innerHTML='<div class="pg-empty">Your coach will assign your training programme soon. It will appear here as soon as it is ready.</div>';return}
    var pi=0,cur=0;
    function draw(){
      var prog=ps[pi],isCur=prog.id===doc.current,w=prog.workouts[cur]||{exercises:[]};
      var past=ps.filter(function(p,i){return i!==pi});
      var h='<div class="pv-head"><div><h3>'+esc(prog.title)+'</h3><small>'+(isCur?'<span class="pv-cur">Current</span> · ':'<span class="pv-old">Past programme</span> · ')+'Updated '+esc(upd(prog))+'</small></div>'+
        (ps.length>1?'<label class="pv-pick"><span><i class="ti ti-history" aria-hidden="true"></i> '+(isCur?'Past ('+(ps.length-1)+')':'Switch')+' <i class="ti ti-chevron-down" aria-hidden="true"></i></span><select aria-label="Choose programme">'+ps.map(function(p,i){return '<option value="'+i+'"'+(i===pi?' selected':'')+'>'+(p.id===doc.current?'★ ':'')+esc(p.title)+'</option>'}).join('')+'</select></label>':'')+'</div>';
      if(prog.goal||prog.schedule||prog.notes)h+='<details class="pv-info"><summary>'+(prog.goal?'<b>Goal:</b> '+esc(prog.goal):'Notes from Maria')+'</summary>'+(prog.schedule?'<p><b>Weekly schedule</b><br>'+esc(prog.schedule)+'</p>':'')+(prog.notes?'<p>'+esc(prog.notes)+'</p>':'')+'</details>';
      if(!prog.workouts.length){el.innerHTML=h+'<div class="pg-empty">No workouts in this programme yet.</div>';bind();return}
      h+='<div class="pv-tabs">'+prog.workouts.map(function(x,i){return '<button type="button" data-i="'+i+'" class="'+(i===cur?'on':'')+'">'+esc(x.name)+'</button>'}).join('')+'</div>';
      var n=w.exercises.length,sets=w.exercises.reduce(function(a,e){return a+(parseInt(e.sets,10)||0)},0);
      h+='<div class="pv-sum"><span>'+n+' exercise'+(n===1?'':'s')+(sets?' · '+sets+' sets':'')+(w.focus?' · '+esc(w.focus):'')+'</span>'+(isCur?'<button class="btn" type="button" id="logW"><i class="ti ti-player-play" aria-hidden="true"></i> Start</button>':'')+'</div><div id="logBox"></div>';
      if(w.notes)h+='<div class="pv-note">'+esc(w.notes)+'</div>';
      var hasSS=w.exercises.some(function(e){return e.ss});
      h+='<ol class="pv-list">'+w.exercises.map(function(e,i){
        var ch=[];if(e.rir)ch.push('RIR '+esc(e.rir));if(e.tempo)ch.push('Tempo '+esc(e.tempo));if(e.rest)ch.push('Rest '+esc(e.rest));
        var sr=(e.sets?esc(e.sets):'')+(e.sets&&e.reps?' × ':'')+(e.reps?esc(e.reps):'');
        return '<li class="pv-ex'+(e.ss?' ss':'')+'"><span class="pv-n">'+(e.ss?esc(e.ss):i+1)+'</span><div class="pv-b"><b>'+esc(e.name)+'</b>'+(e.opts?'<small class="pv-o">or: '+esc(e.opts)+'</small>':'')+(ch.length?'<div class="pv-ch">'+ch.map(function(c){return '<em>'+c+'</em>'}).join('')+'</div>':'')+(e.notes?'<small class="pv-nt">'+esc(e.notes)+'</small>':'')+'</div>'+(sr?'<span class="pv-sr">'+sr+'</span>':'')+'</li>'}).join('')+'</ol>';
      h+='<details class="pv-key"><summary>What do '+(hasSS?'SS, ':'')+'RIR and tempo mean?</summary>'+(hasSS?'<p><b>SS</b> = superset: exercises with the same letter (A1, A2) are done back to back, then rest.</p>':'')+'<p><b>RIR</b> = reps in reserve: how many more good reps you could have done.</p><p><b>Tempo</b> e.g. 3-1-1-0 = 3 seconds down, 1 second pause, 1 second up, 0 at the top.</p></details>';
      el.innerHTML=h;bind();
    }
    function bind(){
      var sel=el.querySelector('.pv-pick select');if(sel)sel.onchange=function(){pi=+sel.value;cur=0;draw()};
      [].forEach.call(el.querySelectorAll('[data-i]'),function(b){b.onclick=function(){cur=+b.getAttribute('data-i');draw()}});
      var lb=el.querySelector('#logW');if(lb)lb.onclick=function(){if(window.__lbStart){window.__lbStart(cur);return}lb.hidden=true;Logger(el.querySelector('#logBox'),ps[pi],ps[pi].workouts[cur],opts)};
    }
    draw();
  }

  /* ---------- coach: editor ---------- */
  function Editor(el,o){
    var doc=null,prog=null,cur=0,dirty=false,tpl=!!o.tpl,EP=tpl?'/portal/api/coach/templates':'/portal/api/coach/programmes?id='+encodeURIComponent(o.id);
    function nid(){return Math.random().toString(36).slice(2,10)}
    function blank(){var t=new Date().toISOString();return {id:nid(),title:'New programme',notes:'',created:t,updated:'',workouts:[{name:'Workout A',notes:'',exercises:[{},{},{},{}]}]}}
    function pad(p){if(!p.workouts.length)p.workouts.push({name:'Workout A',notes:'',exercises:[]});p.workouts.forEach(function(w){if(!w.exercises.length)w.exercises.push({})})}
    function load(d){doc=d&&d.programmes&&d.programmes.length?JSON.parse(JSON.stringify(d)):{current:'',programmes:[]};
      if(!doc.programmes.length){var b=blank();b.title=tpl?'Template 1':'Programme 1';doc.programmes.push(b);doc.current=b.id}
      doc.programmes.forEach(pad);prog=doc.programmes.filter(function(p){return p.id===doc.current})[0]||doc.programmes[0];cur=0;dirty=false;draw()}
    function readInputs(){
      var t=el.querySelector('[name=title]');if(!t)return;
      prog.title=t.value;var fo=el.querySelector('[name=pfolder]');if(fo)prog.folder=fo.value.trim();prog.notes=el.querySelector('[name=pnotes]').value;prog.goal=el.querySelector('[name=pgoal]').value;prog.schedule=el.querySelector('[name=psched]').value;
      var w=prog.workouts[cur];w.name=el.querySelector('[name=wname]').value||'Workout';w.notes=el.querySelector('[name=wnotes]').value;w.focus=el.querySelector('[name=wfocus]').value;
      [].forEach.call(el.querySelectorAll('tr[data-r]'),function(tr){var e=w.exercises[+tr.getAttribute('data-r')];COLS.forEach(function(c){e[c.k]=tr.querySelector('[data-k="'+c.k+'"]').value})});
    }
    function draw(){
      var w=prog.workouts[cur],isCur=prog.id===doc.current;
      var folders={};if(tpl)doc.programmes.forEach(function(p){var f=p.folder||'Unsorted';(folders[f]=folders[f]||[]).push(p)});
      var side=tpl?'<aside class="tpl-side"><div class="ts-h">📁 Your templates</div>'+Object.keys(folders).sort(function(a,b){return a==='Unsorted'?1:b==='Unsorted'?-1:a.localeCompare(b)}).map(function(f){return '<details class="ts-f" open><summary>📁 '+esc(f)+' <span>'+folders[f].length+'</span></summary>'+folders[f].map(function(p){return '<button type="button" data-pid="'+esc(p.id)+'" class="'+(p===prog?'on ':'')+(!tpl&&p.id===doc.current?'cur':'')+'">'+esc(p.title||'Template')+'<small>'+p.workouts.length+' workouts</small></button>'}).join('')+'</details>'}).join('')+'<button type="button" class="add" data-a="newp">+ New template</button></aside>':'';
      var h=(tpl?'':'<div class="pg-list"><small>Programmes</small><div class="pg-tabs">'+doc.programmes.map(function(p){return '<button type="button" data-pid="'+esc(p.id)+'" class="'+(p===prog?'on':'')+'">'+(!tpl&&p.id===doc.current?'★ ':'')+esc(p.title||'Programme')+'</button>'}).join('')+'<button type="button" class="add" data-a="newp">+ New '+(tpl?'template':'programme')+'</button>'+'<button type="button" class="add" data-a="fromtpl">+ From a template</button></div></div>')+
        '<div class="pe-mini" style="margin-bottom:12px">'+(tpl?'':'<span class="pill '+(isCur?'ok':'off')+'" style="align-self:center">'+(isCur?'★ Current: the client sees this first':'Past programme: the client can still look back at it')+'</span>'+(isCur?'':'<button type="button" data-a="makecur">Make this the current programme</button>'))+'<button type="button" data-a="copyp">Copy into a new '+(tpl?'template':'programme')+'</button>'+(tpl?'<button type="button" data-a="assign" class="asg">👤 Assign to a client</button>':'<button type="button" data-a="savetpl">Save as a template</button>')+'<button type="button" data-a="delp" class="del">Delete '+(tpl?'template':'programme')+'</button></div><div id="tplPick"></div><div id="asgBox"></div>'+
        '<div class="pe-row"><label>Programme name<input name="title" placeholder="e.g. Phase 1: Full body" value="'+esc(prog.title)+'"></label>'+(tpl?'<label>Folder<input name="pfolder" list="tplFolders" placeholder="e.g. Women, Men, Beginners" value="'+esc(prog.folder||'')+'"><datalist id="tplFolders">'+Object.keys(folders).filter(function(f){return f!=='Unsorted'}).map(function(f){return '<option value="'+esc(f)+'">'}).join('')+'</datalist></label>':'')+'</div>'+
        '<label class="pe-full">Goal<input name="pgoal" value="'+esc(prog.goal||'')+'" placeholder="e.g. Hypertrophy and strength"></label>'+
        '<label class="pe-full">Notes for the whole programme<textarea name="pnotes" rows="3" placeholder="e.g. Warm up for 5 minutes before every session">'+esc(prog.notes)+'</textarea></label>'+
        '<label class="pe-full">Weekly schedule<textarea name="psched" rows="2" placeholder="e.g. Monday: Push · Tuesday: Pull · Wednesday: Rest">'+esc(prog.schedule||'')+'</textarea></label>'+
        '<div class="pg-tabs">'+prog.workouts.map(function(x,i){return '<button type="button" data-i="'+i+'" class="'+(i===cur?'on':'')+'">'+esc(x.name||'Workout')+'</button>'}).join('')+'<button type="button" class="add" data-a="addw">+ Add workout</button></div>'+
        '<div class="pe-row"><label>Workout name<input name="wname" value="'+esc(w.name)+'"></label><div class="pe-mini"><button type="button" data-a="dupw">Duplicate</button><button type="button" data-a="lw">← Move</button><button type="button" data-a="rw">Move →</button><button type="button" data-a="delw" class="del">Delete workout</button></div></div>'+
        '<label class="pe-full">Focus<input name="wfocus" value="'+esc(w.focus||'')+'" placeholder="e.g. Quads, chest, shoulders, triceps"></label>'+
        '<label class="pe-full">Workout notes<textarea name="wnotes" rows="2" placeholder="Optional">'+esc(w.notes)+'</textarea></label>'+
        '<div class="pg-wrap"><table class="pg pe"><thead><tr><th>#</th>'+COLS.map(function(c){return '<th class="'+c.w+'">'+c.l+'</th>'}).join('')+'<th></th></tr></thead><tbody>'+
        w.exercises.map(function(e,i){return '<tr data-r="'+i+'"><td class="n">'+(i+1)+'</td>'+COLS.map(function(c){return '<td class="'+c.w+'"><input data-k="'+c.k+'" value="'+esc(e[c.k]||'')+'"'+(c.k==='name'?' placeholder="Exercise" list="mpfExList"':c.k==='ss'?' placeholder="A1"':'')+'></td>'}).join('')+'<td class="act"><button type="button" data-a="up" data-r="'+i+'" title="Move up">↑</button><button type="button" data-a="down" data-r="'+i+'" title="Move down">↓</button><button type="button" data-a="delr" data-r="'+i+'" title="Delete row" class="del">✕</button></td></tr>'}).join('')+
        '</tbody></table></div><div class="pe-mini" style="margin-top:8px"><button type="button" data-a="addr">+ Add exercise</button></div>'+
        '<div class="lg-save"><span class="lg-msg">'+(prog.updated?'Last saved '+esc(upd(prog)):'Not saved yet')+'</span><button class="btn" type="button" data-a="save">Save '+(tpl?'template':'programme')+'</button></div>';
      el.innerHTML=tpl?'<div class="tpl-lay">'+side+'<div class="tpl-main">'+h+'</div></div>':h;
      el.oninput=function(){dirty=true;var m=el.querySelector('.lg-msg');m.textContent='Not saved yet';m.className='lg-msg warn'};
      [].forEach.call(el.querySelectorAll('.pg-tabs button[data-i]'),function(b){b.onclick=function(){readInputs();cur=+b.getAttribute('data-i');draw()}});
      [].forEach.call(el.querySelectorAll('[data-pid]'),function(b){b.onclick=function(){readInputs();prog=doc.programmes.filter(function(p){return p.id===b.getAttribute('data-pid')})[0];cur=0;draw();if(dirty)warn()}});
      [].forEach.call(el.querySelectorAll('[data-a]'),function(b){b.onclick=function(){act(b.getAttribute('data-a'),+b.getAttribute('data-r'))}});
    }
    function act(a,r){
      readInputs();var W=prog.workouts,w=W[cur],ex=w.exercises,touched=true;
      if(a==='fromtpl'){pickTemplate();return}
      if(a==='savetpl'){saveAsTemplate();return}
      if(a==='assign'){assign();return}
      if(a==='newp'||a==='copyp'){var np=a==='newp'?blank():JSON.parse(JSON.stringify(prog));if(a==='copyp'){np.id=nid();np.title=prog.title+' (new)';np.created=new Date().toISOString();np.updated=''}
        doc.programmes.push(np);prog=np;cur=0;if(!tpl&&confirm('Make "'+np.title+'" the current programme? The client will see it first, and the old one moves to their past programmes.'))doc.current=np.id}
      else if(a==='makecur'){doc.current=prog.id}
      else if(a==='delp'){if(doc.programmes.length===1){alert('Keep at least one programme.');return}if(!confirm('Delete "'+prog.title+'"? The client will no longer see it.'))return;doc.programmes.splice(doc.programmes.indexOf(prog),1);if(doc.current===prog.id)doc.current=doc.programmes[0].id;prog=doc.programmes[0];cur=0}
      else if(a==='addw'){W.push({name:'Workout '+String.fromCharCode(65+W.length),notes:'',exercises:[{},{},{},{}]});cur=W.length-1}
      else if(a==='dupw'){W.splice(cur+1,0,JSON.parse(JSON.stringify(w)));W[cur+1].name=w.name+' (copy)';cur++}
      else if(a==='delw'){if(W.length===1){alert('A programme needs at least one workout.');return}if(!confirm('Delete '+w.name+'?'))return;W.splice(cur,1);cur=Math.max(0,cur-1)}
      else if(a==='lw'&&cur>0){W.splice(cur-1,0,W.splice(cur,1)[0]);cur--}
      else if(a==='rw'&&cur<W.length-1){W.splice(cur+1,0,W.splice(cur,1)[0]);cur++}
      else if(a==='addr')ex.push({});
      else if(a==='delr'){ex.splice(r,1);if(!ex.length)ex.push({})}
      else if(a==='up'&&r>0)ex.splice(r-1,0,ex.splice(r,1)[0]);
      else if(a==='down'&&r<ex.length-1)ex.splice(r+1,0,ex.splice(r,1)[0]);
      else if(a==='save'){save();return}
      else touched=false;
      if(touched)dirty=true;draw();if(dirty)warn();
    }
    function addFrom(t){
      var np=JSON.parse(JSON.stringify(t));np.id=nid();np.created=new Date().toISOString();np.updated='';pad(np);
      doc.programmes.push(np);prog=np;cur=0;dirty=true;
      if(confirm('Make "'+np.title+'" '+o.name+'\'s current programme? Their old one moves to their past programmes.'))doc.current=np.id;
      draw();warn();
    }
    function pickTemplate(){
      var box=el.querySelector('#tplPick');box.innerHTML='<p style="color:var(--mute)">Loading templates…</p>';
      var show=function(d){var ts=(d&&d.programmes)||[];
        if(!ts.length){box.innerHTML='<div class="pg-note">No templates yet. Open <b>Programme templates</b> at the top of your coach view to make some, or use <b>Save as a template</b> on any programme.</div>';return}
        box.innerHTML='<div class="pg-note"><b>Pick a template to copy in:</b><div class="pe-mini" style="margin-top:8px">'+ts.map(function(t,i){return '<button type="button" data-t="'+i+'">'+esc(t.title)+' ('+t.workouts.length+' workouts)</button>'}).join('')+'<button type="button" data-t="x" class="del">Cancel</button></div></div>';
        [].forEach.call(box.querySelectorAll('[data-t]'),function(b){b.onclick=function(){var v=b.getAttribute('data-t');if(v==='x'){box.innerHTML='';return}readInputs();addFrom(ts[+v])}});
      };
      if(o.demo){show({programmes:[MPFProgramme.demo.programmes[0]]});return}
      fetch('/portal/api/coach/templates',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(show).catch(function(){box.innerHTML='<p style="color:#ef8f85">Templates could not load. Try again.</p>'});
    }
    function assign(){
      var box=el.querySelector('#asgBox'),cl=(typeof o.clients==='function'?o.clients():(o.clients||[])).slice().sort(function(a,b){return String(a.name).localeCompare(b.name)});
      if(dirty){alert('Save this template first, then assign it.');return}
      if(!cl.length){box.innerHTML='<div class="pg-note">No clients to assign to.</div>';return}
      var row=function(t,lbl){var arr=cl.filter(function(c){return c.type===t});return arr.length?'<div class="asg-g"><b>'+lbl+'</b>'+arr.map(function(c){return '<button type="button" data-cid="'+esc(c.id)+'">'+esc(c.name)+'</button>'}).join('')+'</div>':''};
      box.innerHTML='<div class="pg-note asg-p"><b>Assign "'+esc(prog.title)+'" to:</b><input class="asg-s" placeholder="🔍 Search clients" autocomplete="off"><div class="asg-l">'+row('online','💻 Online')+row('pt','🏋️ Face to face')+'</div><button type="button" class="asg-x">Cancel</button></div>';
      var srch=box.querySelector('.asg-s');srch.focus();srch.oninput=function(){var q=srch.value.toLowerCase();[].forEach.call(box.querySelectorAll('[data-cid]'),function(b){b.hidden=q&&b.textContent.toLowerCase().indexOf(q)<0})};
      box.querySelector('.asg-x').onclick=function(){box.innerHTML=''};
      [].forEach.call(box.querySelectorAll('[data-cid]'),function(b){b.onclick=function(){var id=b.getAttribute('data-cid'),nm=b.textContent;
        var mk=confirm('Give '+nm+' "'+prog.title+'" as their current programme?\n\nOK = make it their current programme\nCancel = add it without switching');
        var t=JSON.parse(JSON.stringify(prog));t.id=nid();t.created=t.updated=new Date().toISOString();delete t.folder;
        box.innerHTML='<div class="pg-note">Assigning to '+esc(nm)+'…</div>';
        if(o.demo){box.innerHTML='<div class="pg-note ok">✓ Assigned to '+esc(nm)+' (preview only)</div>';return}
        var EPc='/portal/api/coach/programmes?id='+encodeURIComponent(id);
        fetch(EPc,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(d){d=d&&d.programmes?d:{current:'',programmes:[]};d.programmes.push(t);if(mk||!d.current)d.current=t.id;
          return fetch(EPc,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(d)})}).then(function(r){if(!r.ok)throw 0;
          box.innerHTML='<div class="pg-note" style="border-color:#5fbf7f">✅ "'+esc(t.title)+'" assigned to <b>'+esc(nm)+'</b>'+(mk?'. It\'s now their current programme':' as a past programme')+'. You can tweak weights for them in their Programmes tab.</div>'}).catch(function(){box.innerHTML='<div class="pg-note" style="color:#ef8f85">Not assigned. Try again.</div>'})}});
    }
    function saveAsTemplate(){
      var name=prompt('Name this template:',prog.title);if(name===null)return;
      var t=JSON.parse(JSON.stringify(prog));t.id=nid();t.title=name||prog.title;t.created=t.updated=new Date().toISOString();
      t.workouts.forEach(function(w){w.exercises=w.exercises.map(function(e){var c=Object.assign({},e);c.load='';return c})}); // templates don't carry a client's weights
      if(o.demo){alert('Saved as a template (preview only)');return}
      fetch('/portal/api/coach/templates',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
        d=d&&d.programmes?d:{current:'',programmes:[]};d.programmes.push(t);
        return fetch('/portal/api/coach/templates',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(d)});
      }).then(function(r){if(!r.ok)throw 0;alert('Saved "'+t.title+'" to your templates ✓')}).catch(function(){alert('Sorry, the template did not save. Try again.')});
    }
    function warn(){var m=el.querySelector('.lg-msg');m.textContent='Not saved yet';m.className='lg-msg warn'}
    function save(){
      var btn=el.querySelector('[data-a=save]'),m=el.querySelector('.lg-msg');btn.disabled=true;m.textContent='Saving…';m.className='lg-msg';
      readInputs();prog.updated=new Date().toISOString();var keep=prog.id;
      if(o.demo){setTimeout(function(){dirty=false;btn.disabled=false;m.textContent='Saved ✓ (preview only)';m.className='lg-msg ok'},300);return}
      fetch(EP,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(doc)})
        .then(function(r){return r.json().then(function(j){if(!r.ok)throw 0;return j})})
        .then(function(j){doc={current:j.current,programmes:j.programmes};doc.programmes.forEach(pad);prog=doc.programmes.filter(function(p){return p.id===keep})[0]||doc.programmes[0];cur=Math.min(cur,prog.workouts.length-1);dirty=false;draw();var mm=el.querySelector('.lg-msg');mm.textContent=tpl?'Template saved ✓':'Saved ✓ '+o.name+' can see it now';mm.className='lg-msg ok'})
        .catch(function(){btn.disabled=false;m.textContent='Not saved. Try again.';m.className='lg-msg warn'});
    }
    if(o.demo)load(o.demoDoc);
    else{el.innerHTML='<p style="color:var(--mute)">Loading…</p>';fetch(EP,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){load(j)}).catch(function(){load(null)})}
    return {dirty:function(){return dirty}};
  }

  var DEMO1={id:'p1',created:'2026-09-01',title:'Phase 1: Full body',notes:'Warm up for 5 to 10 minutes before every session. Log your weights after each set.',updated:new Date().toISOString(),workouts:[
    {name:'Workout A',notes:'Lower body focus',exercises:[{name:'Hack squat',sets:'3',reps:'8-10',load:'',tempo:'3-1-1-0',rir:'2',rest:'2-3 min',notes:'Full depth'},{name:'Romanian deadlift',sets:'3',reps:'8-10',tempo:'3-0-1-0',rir:'2',rest:'2 min'},{name:'Leg extension',sets:'2',reps:'12-15',rir:'1',rest:'90s'},{name:'Seated leg curl',sets:'2',reps:'12-15',rir:'1',rest:'90s'}]},
    {name:'Workout B',notes:'Upper body focus',exercises:[{name:'Incline DB press',sets:'3',reps:'8-10',tempo:'3-1-1-0',rir:'2',rest:'2 min'},{name:'Lat pulldown',sets:'3',reps:'10-12',rir:'2',rest:'2 min'},{name:'Cable lateral raise',sets:'3',reps:'12-15',rir:'1',rest:'60s'}]}]};
  var DEMO2=JSON.parse(JSON.stringify(DEMO1));DEMO2.id='p2';DEMO2.created='2026-11-01';DEMO2.title='Phase 2: Upper / lower';DEMO2.workouts[0].name='Lower';DEMO2.workouts[1].name='Upper';
  /* ---------- client: log a workout (weight and reps per set) ---------- */
  var today=function(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}};
  var nk=function(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()};
  function lastFor(sessions,name){var k=nk(name);for(var i=0;i<(sessions||[]).length;i++){var e=(sessions[i].exercises||[]).filter(function(x){return nk(x.name)===k})[0];if(e&&e.sets.some(function(s){return s.kg||s.reps}))return {date:sessions[i].date,sets:e.sets}}return null}
  function setsTxt(sets){return sets.filter(function(s){return s.kg||s.reps}).map(function(s){return (s.kg?s.kg+'kg':'')+(s.kg&&s.reps?' × ':'')+(s.reps||'')}).join(', ')}
  function Logger(box,prog,w,opts){
    var sessions=null;
    function draw(){
      var nSets=function(e){var n=parseInt(e.sets,10);return n>0&&n<13?n:3};
      box.innerHTML='<div class="wl"><div class="wl-top"><h3>'+esc(w.name)+'</h3><label>Date <input type="date" id="wlDate" value="'+today()+'"></label></div>'+
        w.exercises.map(function(e,i){var last=lastFor(sessions,e.name);var rows='';for(var k=0;k<nSets(e);k++)rows+='<div class="wl-set" data-s="'+k+'"><span>Set '+(k+1)+'</span><input data-f="kg" inputmode="decimal" placeholder="kg"><input data-f="reps" inputmode="numeric" placeholder="reps"><button type="button" class="wl-done" aria-label="Set done">✓</button></div>';
          return '<div class="wl-ex" data-e="'+i+'"><div class="wl-h">'+(e.ss?'<span class="sspill">'+esc(e.ss)+'</span> ':'')+'<b>'+esc(e.name)+'</b><small>'+esc([e.sets&&e.sets+' sets',e.reps&&e.reps+' reps',e.tempo&&'tempo '+e.tempo,e.rest&&'rest '+e.rest].filter(Boolean).join(' · '))+'</small></div>'+
            (last?'<p class="wl-last">Last time ('+new Date(last.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})+'): '+esc(setsTxt(last.sets))+'</p>':'')+rows+'<input class="wl-note" data-f="note" placeholder="Notes (optional)"></div>'}).join('')+
        '<label class="pe-full">How did the session go?<textarea id="wlNotes" rows="2"></textarea></label><div class="ci-btns"><span class="lg-msg" id="wlMsg"></span><button class="btn" type="button" id="wlSave">Save workout</button></div></div>';
      [].forEach.call(box.querySelectorAll('.wl-done'),function(b){b.onclick=function(){b.classList.toggle('on')}});
      box.querySelector('#wlSave').onclick=save;
    }
    function save(){
      var ex=w.exercises.map(function(e,i){var eb=box.querySelector('[data-e="'+i+'"]');return {name:e.name,ss:e.ss||'',notes:eb.querySelector('[data-f=note]').value,sets:[].map.call(eb.querySelectorAll('.wl-set'),function(r){return {kg:r.querySelector('[data-f=kg]').value,reps:r.querySelector('[data-f=reps]').value,done:r.querySelector('.wl-done').classList.contains('on')}})}});
      if(!ex.some(function(e){return e.sets.some(function(s){return s.kg||s.reps})})){box.querySelector('#wlMsg').textContent='Add at least one set first.';return}
      var body={date:box.querySelector('#wlDate').value,programme:prog.title,workout:w.name,notes:box.querySelector('#wlNotes').value,exercises:ex},m=box.querySelector('#wlMsg');m.textContent='Saving…';
      if(opts.demo){m.textContent='Saved ✓ (preview only)';m.className='lg-msg ok';return}
      fetch('/portal/api/workout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw 0;m.textContent='Saved ✓ Great work 💪';m.className='lg-msg ok';box.querySelector('#wlSave').disabled=true}).catch(function(){m.textContent='Not saved. Check your signal and try again.';m.className='lg-msg warn'});
    }
    if(opts.demo){sessions=[];draw();return}
    box.innerHTML='<p style="color:var(--mute)">Loading…</p>';
    fetch('/portal/api/workouts',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){sessions=j.sessions||[];draw()}).catch(function(){sessions=[];draw()});
  }
  function historyHTML(sessions){
    if(!sessions||!sessions.length)return '<p class="ci-note">No workouts logged yet.</p>';
    return sessions.map(function(s,n){return '<details class="ci-card"'+(n===0?' open':'')+'><summary><b>'+esc(s.workout)+'</b><span>'+new Date(s.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</span></summary><div class="ci-ans">'+s.exercises.filter(function(e){return e.sets.some(function(x){return x.kg||x.reps})||e.notes}).map(function(e){return '<div><b>'+(e.ss?esc(e.ss)+' · ':'')+esc(e.name)+'</b><p>'+esc(setsTxt(e.sets))+(e.notes?'<br><i>'+esc(e.notes)+'</i>':'')+'</p></div>'}).join('')+(s.notes?'<div><b>Session notes</b><p>'+esc(s.notes)+'</p></div>':'')+'</div></details>'}).join('');
  }
  window.MPFProgramme={historyHTML:historyHTML,View:View,Editor:Editor,demo:{current:'p2',programmes:[DEMO1,DEMO2]}};
})();

/* exercise name suggestions for the coach editor, from the shared library */
(function(){function mk(){if(!window.MPFEX||document.getElementById('mpfExList'))return;var d=document.createElement('datalist');d.id='mpfExList';var seen={};Object.keys(MPFEX).forEach(function(g){MPFEX[g].forEach(function(n){if(seen[n])return;seen[n]=1;var o=document.createElement('option');o.value=n;d.appendChild(o)})});document.body.appendChild(d)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mk);else mk()})();
