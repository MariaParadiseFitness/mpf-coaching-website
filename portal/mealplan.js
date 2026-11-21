/* MPF meal plans: client view + coach builder (uses the MPF food database in foods.js). */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isNaN(n)?0:n};
  var r1=function(n){return Math.round(n*10)/10};
  function tot(foods){var t={kcal:0,p:0,c:0,f:0};(foods||[]).forEach(function(x){t.kcal+=num(x.kcal);t.p+=num(x.p);t.c+=num(x.c);t.f+=num(x.f)});return t}
  function dayTot(d){var t={kcal:0,p:0,c:0,f:0};(d.meals||[]).forEach(function(m){var x=tot(m.foods);t.kcal+=x.kcal;t.p+=x.p;t.c+=x.c;t.f+=x.f});return t}
  function totLine(t,tg){
    var cell=function(l,v,u,k){var target=tg&&num(tg[k]);var diff=target?Math.round(v-target):null;return '<div><small>'+l+'</small><b>'+Math.round(v)+u+'</b>'+(target?'<span class="'+(Math.abs(diff)<=(k==='kcal'?50:5)?'okc':'offc')+'">target '+Math.round(target)+u+'</span>':'')+'</div>'};
    return '<div class="lg-stats mp-tot">'+cell('Calories',t.kcal,'','cals')+cell('Protein',t.p,'g','protein')+cell('Carbs',t.c,'g','carbs')+cell('Fat',t.f,'g','fat')+'</div>';
  }
  function upd(p){return p&&p.updated?new Date(p.updated).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):''}

  /* ---------- client view ---------- */
  function View(el,doc,targets){
    var ps=(doc&&doc.plans||[]).slice().sort(function(a,b){return (b.id===doc.current)-(a.id===doc.current)||(b.created>a.created?1:-1)});
    if(!ps.length){el.innerHTML='<div class="pg-empty">Your coach will build your meal plan soon. It will appear here as soon as it is ready.</div>';return}
    var pi=0,di=0;
    function draw(){
      var p=ps[pi],d=p.days[di]||{meals:[]},isCur=p.id===doc.current;
      var h=(ps.length>1?'<div class="pg-list"><small>My meal plans</small><div class="pg-tabs">'+ps.map(function(x,i){return '<button type="button" data-p="'+i+'" class="'+(i===pi?'on':'')+'">'+(x.id===doc.current?'★ ':'')+esc(x.title)+'</button>'}).join('')+'</div></div>':'')+
        '<div class="pg-top"><h3>'+esc(p.title)+(ps.length>1?' <span class="pill '+(isCur?'ok':'off')+'">'+(isCur?'Current':'Past plan')+'</span>':'')+'</h3><small>Updated '+esc(upd(p))+'</small></div>'+(p.notes?'<div class="pg-note">'+esc(p.notes)+'</div>':'');
      if(p.days.length>1)h+='<div class="pg-tabs">'+p.days.map(function(x,i){return '<button type="button" data-d="'+i+'" class="'+(i===di?'on':'')+'">'+esc(x.name)+'</button>'}).join('')+'</div>';
      if(d.notes)h+='<div class="pg-note">'+esc(d.notes)+'</div>';
      h+=totLine(dayTot(d),null);
      h+=d.meals.filter(function(m){return (m.foods||[]).length}).map(function(m){var t=tot(m.foods);return '<div class="mp-meal"><div class="mp-mh"><b>'+esc(m.name)+'</b><span>'+Math.round(t.kcal)+' kcal · P '+r1(t.p)+' · C '+r1(t.c)+' · F '+r1(t.f)+'</span></div>'+(m.notes?'<p class="mp-note">'+esc(m.notes)+'</p>':'')+'<ul>'+m.foods.map(function(f){return '<li><span>'+esc(f.food)+'</span><b>'+esc(f.amount)+' '+esc(f.unit)+'</b></li>'}).join('')+'</ul></div>'}).join('');
      h+='<p class="pg-key">Weigh your food using the same state as listed (raw, cooked or dry). Swaps are fine if they fit your macros.</p>';
      el.innerHTML=h;
      [].forEach.call(el.querySelectorAll('[data-p]'),function(b){b.onclick=function(){pi=+b.getAttribute('data-p');di=0;draw()}});
      [].forEach.call(el.querySelectorAll('[data-d]'),function(b){b.onclick=function(){di=+b.getAttribute('data-d');draw()}});
    }
    draw();
  }

  /* ---------- coach builder ---------- */
  var FOODS=null;
  function foodList(){if(FOODS)return FOODS;FOODS=(window.MPF_FOODS||[]).map(function(f){return {name:f[0],amount:f[1],unit:f[2],kcal:f[3],p:f[4],c:f[5],f:f[6]}});return FOODS}
  function findFood(name){name=String(name||'').toLowerCase().trim();return foodList().filter(function(f){return f.name.toLowerCase()===name})[0]}
  function Editor(el,o){
    var doc,plan,di=0,dirty=false,tpl=!!o.tpl,EP=tpl?'/portal/api/coach/mealtemplates':'/portal/api/coach/mealplans?id='+encodeURIComponent(o.id),tg=o.targets||null;
    function nid(){return Math.random().toString(36).slice(2,10)}
    function meal(n){return {name:'Meal '+n,notes:'',foods:[{},{},{}]}}
    function blank(){return {id:nid(),title:tpl?'New template':'Meal plan',notes:'',created:new Date().toISOString(),updated:'',days:[{name:'Every day',notes:'',meals:[meal(1),meal(2),meal(3),meal(4)]}]}}
    function pad(p){if(!p.days.length)p.days.push({name:'Every day',notes:'',meals:[]});p.days.forEach(function(d){if(!d.meals.length)d.meals.push(meal(1));d.meals.forEach(function(m){if(!m.foods.length)m.foods.push({})})})}
    function load(d){doc=d&&d.plans&&d.plans.length?JSON.parse(JSON.stringify(d)):{current:'',plans:[]};if(!doc.plans.length){var b=blank();doc.plans.push(b);doc.current=b.id}doc.plans.forEach(pad);plan=doc.plans.filter(function(p){return p.id===doc.current})[0]||doc.plans[0];di=0;dirty=false;draw()}
    function read(){
      var t=el.querySelector('[name=mtitle]');if(!t)return;plan.title=t.value;plan.notes=el.querySelector('[name=mnotes]').value;
      var d=plan.days[di];d.name=el.querySelector('[name=dname]').value||'Day';d.notes=el.querySelector('[name=dnotes]').value;
      [].forEach.call(el.querySelectorAll('[data-m]'),function(mb){var m=d.meals[+mb.getAttribute('data-m')];m.name=mb.querySelector('[name=mname]').value;m.notes=mb.querySelector('[name=mnote]').value;
        [].forEach.call(mb.querySelectorAll('tr[data-f]'),function(tr){var f=m.foods[+tr.getAttribute('data-f')];['food','amount','unit','kcal','p','c','f'].forEach(function(k){f[k]=tr.querySelector('[data-k='+k+']').value})})});
    }
    function draw(){
      var d=plan.days[di],isCur=plan.id===doc.current;
      var h='<datalist id="mpFoods">'+foodList().map(function(f){return '<option value="'+esc(f.name)+'">'}).join('')+'</datalist>'+
        '<div class="pg-list"><small>'+(tpl?'Meal plan templates':'Meal plans')+'</small><div class="pg-tabs">'+doc.plans.map(function(p){return '<button type="button" data-pid="'+esc(p.id)+'" class="'+(p===plan?'on':'')+'">'+(!tpl&&p.id===doc.current?'★ ':'')+esc(p.title||'Plan')+'</button>'}).join('')+'<button type="button" class="add" data-a="newp">+ New</button>'+(tpl?'':'<button type="button" class="add" data-a="fromtpl">+ From a template</button>')+'</div></div>'+
        '<div class="pe-mini" style="margin-bottom:10px">'+(tpl?'':'<span class="pill '+(isCur?'ok':'off')+'" style="align-self:center">'+(isCur?'★ Current: the client sees this':'Past plan')+'</span>'+(isCur?'':'<button type="button" data-a="makecur">Make current</button>'))+'<button type="button" data-a="copyp">Copy into a new plan</button>'+(tpl?'':'<button type="button" data-a="savetpl">Save as a template</button>')+'<button type="button" data-a="delp" class="del">Delete</button></div><div id="mpPick"></div>'+
        '<div class="pe-row"><label>Plan name<input name="mtitle" value="'+esc(plan.title)+'"></label></div><label class="pe-full">Notes for the whole plan<textarea name="mnotes" rows="2" placeholder="e.g. Drink 3L of water a day. Swap any carb source for one in your guide.">'+esc(plan.notes)+'</textarea></label>'+
        '<div class="pg-tabs">'+plan.days.map(function(x,i){return '<button type="button" data-di="'+i+'" class="'+(i===di?'on':'')+'">'+esc(x.name||'Day')+'</button>'}).join('')+'<button type="button" class="add" data-a="addday">+ Add a day (e.g. refeed)</button></div>'+
        '<div class="pe-row"><label>Day name<input name="dname" value="'+esc(d.name)+'"></label><div class="pe-mini"><button type="button" data-a="dupday">Duplicate day</button><button type="button" data-a="delday" class="del">Delete day</button></div></div><label class="pe-full">Day notes<textarea name="dnotes" rows="2">'+esc(d.notes)+'</textarea></label>'+
        '<div id="mpTot">'+totLine(dayTot(d),tg)+'</div>'+
        d.meals.map(function(m,mi){return '<div class="mp-meal ed" data-m="'+mi+'"><div class="pe-row"><label>Meal<input name="mname" value="'+esc(m.name)+'"></label><div class="pe-mini"><button type="button" data-a="mup" data-mi="'+mi+'">↑</button><button type="button" data-a="mdown" data-mi="'+mi+'">↓</button><button type="button" data-a="mdel" data-mi="'+mi+'" class="del">Delete meal</button></div></div>'+
          '<div class="pg-wrap"><table class="pg pe mp"><thead><tr><th>Food</th><th>Amount</th><th>Unit</th><th>Kcal</th><th>P</th><th>C</th><th>F</th><th></th></tr></thead><tbody>'+m.foods.map(function(f,fi){return '<tr data-f="'+fi+'"><td class="w-name"><input data-k="food" list="mpFoods" placeholder="Start typing a food" value="'+esc(f.food||'')+'"></td><td><input data-k="amount" inputmode="decimal" value="'+esc(f.amount||'')+'"></td><td><input data-k="unit" value="'+esc(f.unit||'')+'"></td><td><input data-k="kcal" inputmode="decimal" value="'+esc(f.kcal||'')+'"></td><td><input data-k="p" inputmode="decimal" value="'+esc(f.p||'')+'"></td><td><input data-k="c" inputmode="decimal" value="'+esc(f.c||'')+'"></td><td><input data-k="f" inputmode="decimal" value="'+esc(f.f||'')+'"></td><td class="act"><button type="button" data-a="fdel" data-mi="'+mi+'" data-fi="'+fi+'" class="del">✕</button></td></tr>'}).join('')+'</tbody></table></div>'+
          '<div class="pe-mini" style="margin-top:6px"><button type="button" data-a="fadd" data-mi="'+mi+'">+ Add food</button><span class="mp-mt" data-mt="'+mi+'"></span></div><label class="pe-full" style="margin-top:6px">Meal notes<input name="mnote" value="'+esc(m.notes||'')+'" placeholder="Optional"></label></div>'}).join('')+
        '<div class="pe-mini" style="margin:8px 0"><button type="button" data-a="madd">+ Add meal</button></div>'+
        '<div class="lg-save"><span class="lg-msg">'+(plan.updated?'Last saved '+esc(upd(plan)):'Not saved yet')+'</span><button class="btn" type="button" data-a="save">Save '+(tpl?'template':'meal plan')+'</button></div>';
      el.innerHTML=h;refreshTotals();
      el.oninput=function(e){dirty=true;warn();var tr=e.target.closest('tr[data-f]');if(tr&&(e.target.getAttribute('data-k')==='food'||e.target.getAttribute('data-k')==='amount'))autofill(tr,e.target.getAttribute('data-k'));refreshTotals()};
      [].forEach.call(el.querySelectorAll('[data-pid]'),function(b){b.onclick=function(){read();plan=doc.plans.filter(function(p){return p.id===b.getAttribute('data-pid')})[0];di=0;draw();if(dirty)warn()}});
      [].forEach.call(el.querySelectorAll('[data-di]'),function(b){b.onclick=function(){read();di=+b.getAttribute('data-di');draw();if(dirty)warn()}});
      [].forEach.call(el.querySelectorAll('[data-a]'),function(b){b.onclick=function(){act(b.getAttribute('data-a'),+b.getAttribute('data-mi'),+b.getAttribute('data-fi'))}});
    }
    // pick a food from the database: fill unit and macros, scaled to the amount
    function autofill(tr,changed){
      var g=function(k){return tr.querySelector('[data-k='+k+']')},db=findFood(g('food').value);if(!db)return;
      if(changed==='food'&&!g('amount').value){g('amount').value=db.amount;g('unit').value=db.unit}
      if(changed==='food')g('unit').value=db.unit;
      var x=num(g('amount').value)/(db.amount||1);if(!x)return;
      g('kcal').value=Math.round(db.kcal*x);g('p').value=r1(db.p*x);g('c').value=r1(db.c*x);g('f').value=r1(db.f*x);
    }
    function refreshTotals(){
      var d={meals:[]};[].forEach.call(el.querySelectorAll('[data-m]'),function(mb){var foods=[].map.call(mb.querySelectorAll('tr[data-f]'),function(tr){var o2={};['kcal','p','c','f'].forEach(function(k){o2[k]=tr.querySelector('[data-k='+k+']').value});return o2});d.meals.push({foods:foods});var t=tot(foods);var s=mb.querySelector('.mp-mt');if(s)s.textContent=Math.round(t.kcal)+' kcal · P '+r1(t.p)+' · C '+r1(t.c)+' · F '+r1(t.f)});
      var b=el.querySelector('#mpTot');if(b)b.innerHTML=totLine(dayTot(d),tg);
    }
    function warn(){var m=el.querySelector('.lg-msg');if(m){m.textContent='Not saved yet';m.className='lg-msg warn'}}
    function act(a,mi,fi){
      if(a==='save'){save();return}
      if(a==='fromtpl'){pick();return}
      if(a==='savetpl'){saveTpl();return}
      read();var d=plan.days[di],P=doc.plans;
      if(a==='newp'||a==='copyp'){var np=a==='newp'?blank():JSON.parse(JSON.stringify(plan));np.id=nid();if(a==='copyp')np.title=plan.title+' (new)';np.created=new Date().toISOString();np.updated='';P.push(np);plan=np;di=0;if(!tpl&&confirm('Make "'+np.title+'" the current meal plan? The client will see it straight away after you save.'))doc.current=np.id}
      else if(a==='makecur')doc.current=plan.id;
      else if(a==='delp'){if(P.length===1){alert('Keep at least one plan.');return}if(!confirm('Delete "'+plan.title+'"?'))return;P.splice(P.indexOf(plan),1);if(doc.current===plan.id)doc.current=P[0].id;plan=P[0];di=0}
      else if(a==='addday'){plan.days.push({name:'Refeed day',notes:'',meals:[meal(1),meal(2),meal(3),meal(4)]});di=plan.days.length-1}
      else if(a==='dupday'){var nd=JSON.parse(JSON.stringify(d));nd.name=d.name+' (copy)';plan.days.splice(di+1,0,nd);di++}
      else if(a==='delday'){if(plan.days.length===1){alert('A plan needs at least one day.');return}if(!confirm('Delete '+d.name+'?'))return;plan.days.splice(di,1);di=Math.max(0,di-1)}
      else if(a==='madd')d.meals.push(meal(d.meals.length+1));
      else if(a==='mdel'){if(!confirm('Delete '+d.meals[mi].name+'?'))return;d.meals.splice(mi,1);if(!d.meals.length)d.meals.push(meal(1))}
      else if(a==='mup'&&mi>0)d.meals.splice(mi-1,0,d.meals.splice(mi,1)[0]);
      else if(a==='mdown'&&mi<d.meals.length-1)d.meals.splice(mi+1,0,d.meals.splice(mi,1)[0]);
      else if(a==='fadd')d.meals[mi].foods.push({});
      else if(a==='fdel'){d.meals[mi].foods.splice(fi,1);if(!d.meals[mi].foods.length)d.meals[mi].foods.push({})}
      dirty=true;draw();warn();
    }
    function pick(){
      var box=el.querySelector('#mpPick');box.innerHTML='<p style="color:var(--mute)">Loading templates…</p>';
      fetch('/portal/api/coach/mealtemplates',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(t){var ts=t.plans||[];
        if(!ts.length){box.innerHTML='<div class="pg-note">No meal plan templates yet. Use <b>Save as a template</b> on any plan, or open <b>Meal plan templates</b> at the top of your coach view.</div>';return}
        box.innerHTML='<div class="pg-note"><b>Pick a template:</b><div class="pe-mini" style="margin-top:8px">'+ts.map(function(x,i){return '<button type="button" data-t="'+i+'">'+esc(x.title)+'</button>'}).join('')+'<button type="button" data-t="x" class="del">Cancel</button></div></div>';
        [].forEach.call(box.querySelectorAll('[data-t]'),function(b){b.onclick=function(){var v=b.getAttribute('data-t');if(v==='x'){box.innerHTML='';return}read();var np=JSON.parse(JSON.stringify(ts[+v]));np.id=nid();np.created=new Date().toISOString();np.updated='';pad(np);doc.plans.push(np);plan=np;di=0;if(confirm('Make "'+np.title+'" the current meal plan?'))doc.current=np.id;dirty=true;draw();warn()}});
      }).catch(function(){box.innerHTML='<p style="color:#ef8f85">Templates could not load.</p>'});
    }
    function saveTpl(){
      read();var name=prompt('Name this template:',plan.title);if(name===null)return;
      var t=JSON.parse(JSON.stringify(plan));t.id=nid();t.title=name||plan.title;t.created=t.updated=new Date().toISOString();
      fetch('/portal/api/coach/mealtemplates',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(d){d=d&&d.plans?d:{current:'',plans:[]};d.plans.push(t);return fetch('/portal/api/coach/mealtemplates',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(d)})}).then(function(r){if(!r.ok)throw 0;alert('Saved "'+t.title+'" to your meal plan templates ✓')}).catch(function(){alert('Sorry, the template did not save.')});
    }
    function save(){
      read();plan.updated=new Date().toISOString();var keep=plan.id,btn=el.querySelector('[data-a=save]'),m=el.querySelector('.lg-msg');btn.disabled=true;m.textContent='Saving…';m.className='lg-msg';
      if(o.demo){setTimeout(function(){btn.disabled=false;dirty=false;m.textContent='Saved ✓ (preview only)';m.className='lg-msg ok'},300);return}
      fetch(EP,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(doc)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw 0;return j})}).then(function(j){doc={current:j.current,plans:j.plans};doc.plans.forEach(pad);plan=doc.plans.filter(function(p){return p.id===keep})[0]||doc.plans[0];di=Math.min(di,plan.days.length-1);dirty=false;draw();var mm=el.querySelector('.lg-msg');mm.textContent=tpl?'Template saved ✓':'Saved ✓ '+o.name+' can see it now';mm.className='lg-msg ok'}).catch(function(){btn.disabled=false;m.textContent='Not saved. Try again.';m.className='lg-msg warn'});
    }
    if(o.demo){load(null);return {}}
    el.innerHTML='<p style="color:var(--mute)">Loading…</p>';
    fetch(EP,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(load).catch(function(){load(null)});
    return {setTargets:function(t){tg=t;refreshTotals()}};
  }
  window.MPFMeal={View:View,Editor:Editor};
})();
