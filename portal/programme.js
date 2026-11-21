/* MPF training programme: read-only view (client) and editor (coach). Stored on the website, not in Google Sheets. */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var COLS=[{k:'name',l:'Exercise',w:'w-name'},{k:'sets',l:'Sets',w:'w-s'},{k:'reps',l:'Reps',w:'w-s'},{k:'load',l:'Weight',w:'w-s'},{k:'tempo',l:'Tempo',w:'w-s'},{k:'rir',l:'RIR',w:'w-s'},{k:'rest',l:'Rest',w:'w-s'},{k:'notes',l:'Notes',w:'w-notes'}];
  function upd(p){return p&&p.updated?new Date(p.updated).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):''}

  /* ---------- client: read-only ---------- */
  function order(doc){var cur=doc.current,ps=(doc.programmes||[]).slice();ps.sort(function(a,b){return (b.id===cur)-(a.id===cur)||(b.created>a.created?1:-1)});return ps}
  function View(el,doc){
    var ps=doc&&doc.programmes?order(doc):[];
    if(!ps.length){el.innerHTML='<div class="pg-empty">Your programme will appear here once Maria has set it up.</div>';return}
    var pi=0,cur=0;
    function draw(){
      var prog=ps[pi],isCur=prog.id===doc.current,w=prog.workouts[cur]||{exercises:[]};
      var h='<div class="pg-list"><small>My programmes</small><div class="pg-tabs">'+ps.map(function(p,i){return '<button type="button" data-p="'+i+'" class="'+(i===pi?'on':'')+'">'+(p.id===doc.current?'★ ':'')+esc(p.title)+'</button>'}).join('')+'</div></div>';
      h+='<div class="pg-top"><h3>'+esc(prog.title)+' <span class="pill '+(isCur?'ok':'off')+'">'+(isCur?'Current':'Past programme')+'</span></h3><small>Updated '+esc(upd(prog))+'</small></div>';
      if(prog.notes)h+='<div class="pg-note">'+esc(prog.notes)+'</div>';
      if(!prog.workouts.length){el.innerHTML=h+'<div class="pg-empty">No workouts in this programme yet.</div>';bind();return}
      h+='<div class="pg-tabs">'+prog.workouts.map(function(x,i){return '<button type="button" data-i="'+i+'" class="'+(i===cur?'on':'')+'">'+esc(x.name)+'</button>'}).join('')+'</div>';
      if(w.notes)h+='<div class="pg-note">'+esc(w.notes)+'</div>';
      h+='<div class="pg-wrap"><table class="pg"><thead><tr><th>#</th>'+COLS.map(function(c){return '<th class="'+c.w+'">'+c.l+'</th>'}).join('')+'</tr></thead><tbody>'+
        w.exercises.map(function(e,i){return '<tr><td class="n">'+(i+1)+'</td>'+COLS.map(function(c){return '<td class="'+c.w+'">'+esc(e[c.k])+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
      h+='<p class="pg-key"><b>RIR</b> = reps in reserve: how many more good reps you could have done. <b>Tempo</b> e.g. 3-1-1-0 = 3 seconds down, 1 second pause, 1 second up, 0 at the top.</p>';
      el.innerHTML=h;bind();
    }
    function bind(){
      [].forEach.call(el.querySelectorAll('[data-p]'),function(b){b.onclick=function(){pi=+b.getAttribute('data-p');cur=0;draw()}});
      [].forEach.call(el.querySelectorAll('[data-i]'),function(b){b.onclick=function(){cur=+b.getAttribute('data-i');draw()}});
    }
    draw();
  }

  /* ---------- coach: editor ---------- */
  function Editor(el,o){
    var doc=null,prog=null,cur=0,dirty=false;
    function nid(){return Math.random().toString(36).slice(2,10)}
    function blank(){var t=new Date().toISOString();return {id:nid(),title:'New programme',notes:'',created:t,updated:'',workouts:[{name:'Workout A',notes:'',exercises:[{},{},{},{}]}]}}
    function pad(p){if(!p.workouts.length)p.workouts.push({name:'Workout A',notes:'',exercises:[]});p.workouts.forEach(function(w){if(!w.exercises.length)w.exercises.push({})})}
    function load(d){doc=d&&d.programmes&&d.programmes.length?JSON.parse(JSON.stringify(d)):{current:'',programmes:[]};
      if(!doc.programmes.length){var b=blank();b.title='Programme 1';doc.programmes.push(b);doc.current=b.id}
      doc.programmes.forEach(pad);prog=doc.programmes.filter(function(p){return p.id===doc.current})[0]||doc.programmes[0];cur=0;dirty=false;draw()}
    function readInputs(){
      var t=el.querySelector('[name=title]');if(!t)return;
      prog.title=t.value;prog.notes=el.querySelector('[name=pnotes]').value;
      var w=prog.workouts[cur];w.name=el.querySelector('[name=wname]').value||'Workout';w.notes=el.querySelector('[name=wnotes]').value;
      [].forEach.call(el.querySelectorAll('tr[data-r]'),function(tr){var e=w.exercises[+tr.getAttribute('data-r')];COLS.forEach(function(c){e[c.k]=tr.querySelector('[data-k="'+c.k+'"]').value})});
    }
    function draw(){
      var w=prog.workouts[cur],isCur=prog.id===doc.current;
      var h='<div class="pg-list"><small>Programmes</small><div class="pg-tabs">'+doc.programmes.map(function(p){return '<button type="button" data-pid="'+esc(p.id)+'" class="'+(p===prog?'on':'')+'">'+(p.id===doc.current?'★ ':'')+esc(p.title||'Programme')+'</button>'}).join('')+'<button type="button" class="add" data-a="newp">+ New programme</button></div></div>'+
        '<div class="pe-mini" style="margin-bottom:12px"><span class="pill '+(isCur?'ok':'off')+'" style="align-self:center">'+(isCur?'★ Current: the client sees this first':'Past programme: the client can still look back at it')+'</span>'+(isCur?'':'<button type="button" data-a="makecur">Make this the current programme</button>')+'<button type="button" data-a="copyp">Copy into a new programme</button><button type="button" data-a="delp" class="del">Delete programme</button></div>'+
        '<div class="pe-row"><label>Programme name<input name="title" placeholder="e.g. Phase 1: Full body" value="'+esc(prog.title)+'"></label></div>'+
        '<label class="pe-full">Notes for the whole programme<textarea name="pnotes" rows="2" placeholder="e.g. Warm up for 5 minutes before every session">'+esc(prog.notes)+'</textarea></label>'+
        '<div class="pg-tabs">'+prog.workouts.map(function(x,i){return '<button type="button" data-i="'+i+'" class="'+(i===cur?'on':'')+'">'+esc(x.name||'Workout')+'</button>'}).join('')+'<button type="button" class="add" data-a="addw">+ Add workout</button></div>'+
        '<div class="pe-row"><label>Workout name<input name="wname" value="'+esc(w.name)+'"></label><div class="pe-mini"><button type="button" data-a="dupw">Duplicate</button><button type="button" data-a="lw">← Move</button><button type="button" data-a="rw">Move →</button><button type="button" data-a="delw" class="del">Delete workout</button></div></div>'+
        '<label class="pe-full">Workout notes<textarea name="wnotes" rows="2" placeholder="Optional">'+esc(w.notes)+'</textarea></label>'+
        '<div class="pg-wrap"><table class="pg pe"><thead><tr><th>#</th>'+COLS.map(function(c){return '<th class="'+c.w+'">'+c.l+'</th>'}).join('')+'<th></th></tr></thead><tbody>'+
        w.exercises.map(function(e,i){return '<tr data-r="'+i+'"><td class="n">'+(i+1)+'</td>'+COLS.map(function(c){return '<td class="'+c.w+'"><input data-k="'+c.k+'" value="'+esc(e[c.k]||'')+'"'+(c.k==='name'?' placeholder="Exercise"':'')+'></td>'}).join('')+'<td class="act"><button type="button" data-a="up" data-r="'+i+'" title="Move up">↑</button><button type="button" data-a="down" data-r="'+i+'" title="Move down">↓</button><button type="button" data-a="delr" data-r="'+i+'" title="Delete row" class="del">✕</button></td></tr>'}).join('')+
        '</tbody></table></div><div class="pe-mini" style="margin-top:8px"><button type="button" data-a="addr">+ Add exercise</button></div>'+
        '<div class="lg-save"><span class="lg-msg">'+(prog.updated?'Last saved '+esc(upd(prog)):'Not saved yet')+'</span><button class="btn" type="button" data-a="save">Save programme</button></div>';
      el.innerHTML=h;
      el.oninput=function(){dirty=true;var m=el.querySelector('.lg-msg');m.textContent='Not saved yet';m.className='lg-msg warn'};
      [].forEach.call(el.querySelectorAll('.pg-tabs button[data-i]'),function(b){b.onclick=function(){readInputs();cur=+b.getAttribute('data-i');draw()}});
      [].forEach.call(el.querySelectorAll('[data-pid]'),function(b){b.onclick=function(){readInputs();prog=doc.programmes.filter(function(p){return p.id===b.getAttribute('data-pid')})[0];cur=0;draw();if(dirty)warn()}});
      [].forEach.call(el.querySelectorAll('[data-a]'),function(b){b.onclick=function(){act(b.getAttribute('data-a'),+b.getAttribute('data-r'))}});
    }
    function act(a,r){
      readInputs();var W=prog.workouts,w=W[cur],ex=w.exercises,touched=true;
      if(a==='newp'||a==='copyp'){var np=a==='newp'?blank():JSON.parse(JSON.stringify(prog));if(a==='copyp'){np.id=nid();np.title=prog.title+' (new)';np.created=new Date().toISOString();np.updated=''}
        doc.programmes.push(np);prog=np;cur=0;if(confirm('Make "'+np.title+'" the current programme? The client will see it first, and the old one moves to their past programmes.'))doc.current=np.id}
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
    function warn(){var m=el.querySelector('.lg-msg');m.textContent='Not saved yet';m.className='lg-msg warn'}
    function save(){
      var btn=el.querySelector('[data-a=save]'),m=el.querySelector('.lg-msg');btn.disabled=true;m.textContent='Saving…';m.className='lg-msg';
      readInputs();prog.updated=new Date().toISOString();var keep=prog.id;
      if(o.demo){setTimeout(function(){dirty=false;btn.disabled=false;m.textContent='Saved ✓ (preview only)';m.className='lg-msg ok'},300);return}
      fetch('/portal/api/coach/programmes?id='+encodeURIComponent(o.id),{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(doc)})
        .then(function(r){return r.json().then(function(j){if(!r.ok)throw 0;return j})})
        .then(function(j){doc={current:j.current,programmes:j.programmes};doc.programmes.forEach(pad);prog=doc.programmes.filter(function(p){return p.id===keep})[0]||doc.programmes[0];cur=Math.min(cur,prog.workouts.length-1);dirty=false;draw();var mm=el.querySelector('.lg-msg');mm.textContent='Saved ✓ '+o.name+' can see it now';mm.className='lg-msg ok'})
        .catch(function(){btn.disabled=false;m.textContent='Not saved. Try again.';m.className='lg-msg warn'});
    }
    if(o.demo)load(o.demoDoc);
    else{el.innerHTML='<p style="color:var(--mute)">Loading…</p>';fetch('/portal/api/coach/programmes?id='+encodeURIComponent(o.id),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){load(j)}).catch(function(){load(null)})}
    return {dirty:function(){return dirty}};
  }

  var DEMO1={id:'p1',created:'2026-09-01',title:'Phase 1: Full body',notes:'Warm up for 5 to 10 minutes before every session. Log your weights after each set.',updated:new Date().toISOString(),workouts:[
    {name:'Workout A',notes:'Lower body focus',exercises:[{name:'Hack squat',sets:'3',reps:'8-10',load:'',tempo:'3-1-1-0',rir:'2',rest:'2-3 min',notes:'Full depth'},{name:'Romanian deadlift',sets:'3',reps:'8-10',tempo:'3-0-1-0',rir:'2',rest:'2 min'},{name:'Leg extension',sets:'2',reps:'12-15',rir:'1',rest:'90s'},{name:'Seated leg curl',sets:'2',reps:'12-15',rir:'1',rest:'90s'}]},
    {name:'Workout B',notes:'Upper body focus',exercises:[{name:'Incline DB press',sets:'3',reps:'8-10',tempo:'3-1-1-0',rir:'2',rest:'2 min'},{name:'Lat pulldown',sets:'3',reps:'10-12',rir:'2',rest:'2 min'},{name:'Cable lateral raise',sets:'3',reps:'12-15',rir:'1',rest:'60s'}]}]};
  var DEMO2=JSON.parse(JSON.stringify(DEMO1));DEMO2.id='p2';DEMO2.created='2026-11-01';DEMO2.title='Phase 2: Upper / lower';DEMO2.workouts[0].name='Lower';DEMO2.workouts[1].name='Upper';
  window.MPFProgramme={View:View,Editor:Editor,demo:{current:'p2',programmes:[DEMO1,DEMO2]}};
})();
