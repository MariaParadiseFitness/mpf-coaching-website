/* MPF "Generate me a meal plan": builds a 1-day plan from the client's calories and macros.
   Rule-based (no AI): picks meals that match the client's food style and diet, then sizes every
   portion so the day lands on their targets. Values are per 100 g/ml unless the unit is "each". */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  // key: [name, unit, perUnit(1 = per item, 100 = per 100), kcal, p, c, f, min, max, step, start, tags]
  var F={
    chicken:['Chicken breast (raw)','g',100,106,24,0,1.1,100,250,25,150,'meat'],
    turkey:['2% turkey mince (raw)','g',100,113,23,0,2,100,250,25,150,'meat'],
    beef:['5% lean beef mince (raw)','g',100,125,21.5,0,5,100,225,25,150,'meat beef'],
    pork:['Pork loin steak, fat trimmed (raw)','g',100,123,22,0,4,100,225,25,150,'meat pork'],
    salmon:['Salmon fillet (raw)','g',100,208,20,0,13.5,80,180,10,120,'fish'],
    cod:['Cod fillet (raw)','g',100,80,18,0,0.7,120,280,20,180,'fish'],
    prawns:['Cooked prawns','g',100,65,15,0,0.8,100,250,25,150,'fish'],
    tuna:['Tuna in spring water (drained)','g',100,110,25,0,1,80,200,20,120,'fish'],
    tofu:['Firm tofu','g',100,120,13,1.5,7,100,300,25,150,''],
    soya:['Soya chunks (dry)','g',100,345,52,33,0.5,20,80,5,40,''],
    paneer:['Light paneer','g',100,200,20,3,12,50,200,25,100,'dairy'],
    egg:['Medium eggs','egg',1,72,6,0.4,4.8,1,4,1,2,'egg'],
    ew:['Liquid egg whites','ml',100,43,10.8,0,0,0,250,50,100,'egg'],
    yog:['0% Greek yogurt','g',100,54,10.3,3,0,100,350,25,150,'dairy'],
    skyr:['Skyr / quark','g',100,64,11,4,0.2,100,350,25,150,'dairy'],
    syog:['High-protein soya yogurt','g',100,70,7,3,3,100,300,25,150,''],
    whey:['Whey protein','g',100,400,80,8,5,15,40,5,25,'dairy'],
    vprot:['Vegan protein powder','g',100,380,75,8,6,15,40,5,25,''],
    milk:['Semi-skimmed milk','ml',100,47,3.5,4.8,1.7,0,300,50,150,'dairy'],
    oatm:['Oat or soya milk (unsweetened)','ml',100,40,3,3,1.8,0,300,50,150,''],
    chick:['Chickpeas (drained)','g',100,120,7,15,2.5,80,240,20,120,''],
    dal:['Red lentils / masoor dal (dry)','g',100,318,24,48,1.3,20,80,10,40,''],
    beans:['Mixed beans (drained)','g',100,100,7,14,0.5,80,240,20,120,''],
    rice:['Basmati rice (dry)','g',100,355,8,78,0.9,30,130,10,60,''],
    pasta:['Pasta (dry)','g',100,355,12,71,1.5,40,130,10,70,'gluten'],
    pot:['Potatoes (raw)','g',100,77,2,17,0.1,100,450,25,250,''],
    spot:['Sweet potato (raw)','g',100,86,1.6,20,0.1,100,400,25,200,''],
    cous:['Couscous (dry)','g',100,360,13,72,1.5,30,100,10,60,'gluten'],
    oats:['Oats','g',100,375,11,60,8,20,90,5,40,'gluten'],
    sour:['Sourdough bread','g',100,236,8,50,1,30,120,10,60,'gluten'],
    wrap:['Wholemeal wrap','wrap',1,179,5.5,29,3.6,1,2,1,1,'gluten'],
    chap:['Wholemeal chapati','chapati',1,100,3,18,1.5,1,4,1,2,'gluten'],
    pitta:['Wholemeal pitta','pitta',1,150,6,28,1.5,1,2,1,1,'gluten'],
    ricecake:['Rice cakes','cake',1,28,0.6,6,0.2,1,4,1,2,''],
    banana:['Banana','g',100,89,1.1,23,0.3,0,180,60,120,''],
    berries:['Mixed berries','g',100,45,1,9,0.3,50,200,25,80,''],
    apple:['Apple','apple',1,78,0.4,18,0.3,1,1,1,1,''],
    honey:['Honey','g',100,304,0,82,0,0,20,5,0,'honey'],
    veg:['Mixed veg','g',100,30,1,6,0.2,150,150,1,150,''],
    salad:['Salad (leaves, cucumber, tomato)','g',100,18,1,3,0.2,100,100,1,100,''],
    onion:['Onion, tomato & green chilli','g',100,30,1,6,0.2,60,60,1,60,''],
    cuc:['Cucumber','g',100,12,0.6,2,0.1,60,60,1,60,''],
    oil:['Olive oil','ml',100,820,0,0,92,0,15,5,5,''],
    ghee:['Oil or ghee','ml',100,820,0,0,92,0,15,5,5,''],
    pb:['Peanut butter','g',100,600,25,12,50,0,30,5,10,''],
    feta:['Light feta','g',100,180,18,1,11,0,60,10,30,'dairy'],
    avo:['Avocado','g',100,160,2,2,15,0,100,25,50,''],
    nuts:['Mixed nuts','g',100,600,20,12,52,0,30,5,15,'nuts'],
    chana:['Roasted chana (chickpeas)','g',100,370,19,50,6,0,50,10,30,''],
    bulgur:['Bulgur (dry)','g',100,342,12,76,1.3,30,100,10,60,'gluten'],
    peynir:['Light white cheese (beyaz peynir / sirene)','g',100,230,17,1,17,0,60,10,30,'dairy'],
    bread:['Wholemeal or rye bread','g',100,250,9,45,3,30,120,10,60,'gluten'],
    lyut:['Lyutenitsa / pepper and tomato relish','g',100,90,1.8,12,3.5,0,40,10,30,''],
    kis:['Natural yogurt (kiselo mlyako)','g',100,57,3.5,4.5,2,0,250,50,150,'dairy']
  };
  // A meal = name (with {p} for the protein) + slots. A slot lists alternatives; the first one the diet allows is
  // used, or one is picked at random when "pick" is set.
  var M={
    standard:{
      breakfast:[
        {n:'Eggs on toast',s:[['egg'],['ew','tofu'],['sour'],['avo']]},
        {n:'Protein overnight oats',s:[['yog','skyr','syog'],['oats'],['whey','vprot'],['berries'],['banana']]},
        {n:'Protein porridge',s:[['oats'],['milk','oatm'],['whey','vprot'],['banana'],['pb']]}],
      lunch:[
        {n:'{p} salad wrap',pick:0,s:[['chicken','tuna','prawns','turkey','tofu','chick'],['wrap'],['salad'],['avo','feta']]},
        {n:'{p}, rice and veg',pick:0,s:[['chicken','turkey','tuna','tofu','beans'],['rice'],['veg'],['oil']]}],
      dinner:[
        {n:'{p} with potatoes and veg',pick:0,s:[['chicken','beef','salmon','cod','pork','turkey','tofu','beans'],['pot','spot'],['veg'],['oil']]},
        {n:'{p} pasta',pick:0,s:[['beef','turkey','chicken','tuna','prawns','beans','tofu'],['pasta','rice'],['veg'],['oil']]}]},
    indian:{
      breakfast:[
        {n:'{p} bhurji with chapati',pick:0,note:'Scramble with onion, tomato, green chilli, turmeric and coriander.',s:[['egg','paneer','tofu'],['ew','tofu'],['onion'],['ghee','oil'],['chap']]},
        {n:'Masala oats with yogurt',s:[['oats'],['yog','skyr','syog'],['whey','vprot'],['banana']]}],
      lunch:[
        {n:'Tandoori {p} with rice and raita',pick:0,note:'Marinate in yogurt, tandoori masala, garlic, ginger and lemon, then grill or air-fry.',s:[['chicken','prawns','paneer','tofu'],['rice'],['yog','syog'],['cuc']]},
        {n:'Chana masala with rice',note:'Cook the chickpeas with onion, tomato, garlic, ginger and garam masala.',s:[['chick'],['rice','chap'],['yog','syog'],['ghee','oil']]}],
      dinner:[
        {n:'{p} curry with dal and sabzi',pick:0,note:'Cook with cumin, turmeric, garam masala and chilli. Soak soya chunks in hot water first.',s:[['chicken','turkey','cod','paneer','soya','tofu'],['dal'],['veg'],['ghee','oil'],['chap','rice']]}]},
    mediterranean:{
      breakfast:[
        {n:'Yogurt bowl with fruit and nuts',s:[['yog','skyr','syog'],['berries'],['oats'],['honey'],['nuts']]},
        {n:'Eggs with feta on toast',s:[['egg'],['ew','tofu'],['feta','avo'],['sour']]}],
      lunch:[
        {n:'Greek-style {p} couscous bowl',pick:0,s:[['chicken','prawns','chick','tofu'],['cous'],['salad'],['feta','avo'],['oil']]},
        {n:'{p} pitta with salad',pick:0,s:[['chicken','tuna','turkey','chick','tofu'],['pitta'],['salad'],['yog','syog']]}],
      dinner:[
        {n:'{p} with roasted veg',pick:0,s:[['salmon','cod','chicken','turkey','beans','tofu'],['pot','rice','pasta','cous'],['veg'],['oil']]}]},
    turkish:{
      breakfast:[
        {n:'Menemen with white cheese and bread',note:'Cook peppers, tomato and onion in the oil, then scramble in the eggs.',s:[['egg','tofu'],['ew','tofu'],['onion'],['oil'],['peynir','avo'],['bread']]},
        {n:'Yogurt with honey, oats and fruit',s:[['yog','skyr','syog'],['oats'],['berries'],['honey']]}],
      lunch:[
        {n:'{p} şiş with bulgur pilavı and çoban salatası',pick:0,note:'Marinate in yogurt, paprika, cumin and lemon, then grill.',s:[['chicken','turkey','prawns','tofu','chick'],['bulgur','rice'],['salad'],['oil']]}],
      dinner:[
        {n:'Izgara köfte with mercimek çorbası',note:'Grilled köfte with red lentil soup and veg.',s:[['beef','turkey','chicken','soya'],['dal'],['veg'],['oil'],['bread']]},
        {n:'{p} with roasted veg and bulgur',pick:0,s:[['salmon','cod','chicken','turkey','beans'],['bulgur','pot','rice'],['veg'],['oil']]}]},
    bulgarian:{
      breakfast:[
        {n:'Eggs on rye with lyutenitsa and sirene',s:[['egg','tofu'],['ew','tofu'],['bread'],['lyut'],['peynir','avo']]},
        {n:'Kiselo mlyako with oats and fruit',s:[['kis','syog'],['whey','vprot'],['oats'],['banana']]}],
      lunch:[
        {n:'Shopska salad with {p}',pick:0,note:'Tomato, cucumber, pepper and onion with grated sirene on top.',s:[['chicken','turkey','tuna','chick','tofu'],['salad'],['peynir','avo'],['bread']]}],
      dinner:[
        {n:'Kyufteta with potatoes and bob chorba',note:'Spiced with cumin, savory and onion, baked, with a bowl of bean soup.',s:[['turkey','beef','pork','chicken','soya'],['pot'],['beans'],['veg'],['oil']]},
        {n:'{p} with roasted veg and potatoes',pick:0,s:[['chicken','cod','salmon','pork','beans','tofu'],['pot','rice'],['veg'],['oil']]}]},
    snack:[
      {n:'Yogurt and berries',s:[['yog','skyr','syog'],['berries']]},
      {n:'Protein yogurt pot with a scoop of protein',s:[['skyr','yog','syog'],['whey','vprot'],['berries']]},
      {n:'Protein shake and a banana',s:[['whey','vprot'],['milk','oatm'],['banana']]},
      {n:'Rice cakes with peanut butter',s:[['ricecake'],['pb']]},
      {n:'Apple and peanut butter',s:[['apple'],['pb']]},
      {n:'Roasted chana',s:[['chana']]}]
  };
  var DIETS={all:'',nobp:'beef pork',pesc:'meat',veg:'meat fish',vegan:'meat fish dairy egg honey'};
  function blocked(k,ban,dislike){var f=F[k],t=' '+f[11]+' ';if(ban.some(function(b){return t.indexOf(' '+b+' ')>=0}))return true;
    var n=f[0].toLowerCase();return dislike.some(function(w){return w&&n.indexOf(w)>=0})}
  function rnd(a){return a[Math.floor(Math.random()*a.length)]}
  function build(meal,ban,dislike){ // -> {name,note,items:[keys]} or null if a must-have slot has nothing allowed
    var items=[],prot='';
    for(var i=0;i<meal.s.length;i++){var ok=meal.s[i].filter(function(k){return !blocked(k,ban,dislike)});
      if(!ok.length){if(i===0)return null;continue}
      var k=meal.pick===i?rnd(ok):ok[0];if(items.indexOf(k)>=0)continue;items.push(k);if(meal.pick===i)prot=F[k][0].replace(/ \(.*\)/,'').replace(/^\d+% /,'').replace(/^(Firm|Cooked|Light|Lean|Mixed) /i,'').replace(/ (fillet|breast|mince|loin steak, fat trimmed)$/i,'').replace(/^(\w)/,function(c){return c.toLowerCase()})}
    return {name:meal.n.replace('{p}',prot||'').replace(/^ +/,'').replace(/^./,function(c){return c.toUpperCase()}),note:meal.note||'',items:items}}
  function choose(list,ban,dislike){var ok=list.map(function(m){return build(m,ban,dislike)}).filter(Boolean);return ok.length?rnd(ok):null}
  function macros(k,q){var f=F[k],r=q/f[2];return [f[3]*r,f[4]*r,f[5]*r,f[6]*r]}
  function solve(meals,T){
    var vars=[];meals.forEach(function(m,mi){m.items.forEach(function(k){vars.push({mi:mi,k:k,q:F[k][10]})})});
    var W=[1/20,1/4,1/4,1/2];
    function err(){var t=[0,0,0,0];vars.forEach(function(v){var x=macros(v.k,v.q);for(var i=0;i<4;i++)t[i]+=x[i]});var e=0;for(var i=0;i<4;i++)e+=Math.abs(t[i]-T[i])*W[i];return e}
    vars.forEach(function(v){var f=F[v.k];v.q=Math.min(f[8],Math.max(f[7],v.q))});
    for(var pass=0;pass<400;pass++){var best=err(),moved=false;
      vars.forEach(function(v){var f=F[v.k];[1,-1,2,-2].forEach(function(d){var nq=v.q+d*f[9];if(nq<f[7]||nq>f[8])return;var old=v.q;v.q=nq;var e=err();if(e<best-1e-9){best=e;moved=true}else v.q=old})});
      if(!moved)break}
    return vars}
  function generate(o){ // tries many meal combinations and keeps the one that lands closest to the targets
    var best=null,bestE=1e9;
    for(var i=0;i<40;i++){var p=generateOnce(o);if(!p)continue;var s=[0,0,0,0];p.days[0].meals.forEach(function(m){m.foods.forEach(function(f){s[0]+=+f.kcal;s[1]+=+f.p;s[2]+=+f.c;s[3]+=+f.f})});
      var t=p._t,e=Math.abs(s[0]-t[0])/t[0]+Math.abs(s[1]-t[1])/t[1]*1.5+Math.abs(s[2]-t[2])/t[2]+Math.abs(s[3]-t[3])/t[3];var lv=(o.love||[]).map(function(w){return String(w).trim().toLowerCase()}).filter(function(w){return w.length>2});if(lv.length){var txt=JSON.stringify(p.days[0].meals).toLowerCase();lv.forEach(function(w){if(txt.indexOf(w)>-1)e-=0.04})}if(e<bestE){bestE=e;best=p}}
    if(best)delete best._t;return best}
  function generateOnce(o){ // o: {targets, style, diet, ban[], dislike[], meals}
    var t=o.targets,cals=+t.cals||0;if(!cals)return null;
    var P=+t.protein||Math.round(cals*0.3/4),C=+t.carbs||Math.round(cals*0.4/4),Fa=+t.fat||Math.round(cals*0.3/9);
    var ban=(DIETS[o.diet]||'').split(' ').concat(o.ban||[]).filter(Boolean),dis=(o.dislike||[]).map(function(w){return w.trim().toLowerCase()}).filter(Boolean);
    var S=M[o.style]||M.standard,plan=[];
    var b=choose(S.breakfast,ban,dis)||choose(M.standard.breakfast,ban,dis),l=choose(S.lunch,ban,dis)||choose(M.standard.lunch,ban,dis),d=choose(S.dinner,ban,dis)||choose(M.standard.dinner,ban,dis);
    if(!b||!l||!d)return null;
    plan.push(['Breakfast',b],['Lunch',l]);var ns=Math.max(0,(+o.meals||4)-3);
    var used={};for(var i=0;i<ns;i++){var sn=M.snack.map(function(m){return build(m,ban,dis)}).filter(function(x){return x&&!used[x.name]});if(!sn.length)break;var s=rnd(sn);used[s.name]=1;plan.push([ns>1?'Snack '+(i+1):'Snack',s])}
    plan.push(['Dinner',d]);
    var vars=solve(plan.map(function(p){return p[1]}),[cals,P,C,Fa]);
    var meals=plan.map(function(p,mi){return {name:p[0],notes:p[1].name+(p[1].note?'. '+p[1].note:''),foods:vars.filter(function(v){return v.mi===mi&&v.q>0}).map(function(v){var f=F[v.k],x=macros(v.k,v.q),r=function(n){return String(Math.round(n*10)/10)};return {food:f[0],amount:String(v.q),unit:f[1],kcal:String(Math.round(x[0])),p:r(x[1]),c:r(x[2]),f:r(x[3])}})}}).filter(function(m){return m.foods.length});
    var styleName={standard:'',indian:'Indian ',mediterranean:'Mediterranean ',turkish:'Turkish ',bulgarian:'Bulgarian '}[o.style]||'';
    var now=new Date().toISOString();
    return {id:'gen'+Date.now().toString(36),title:'My '+styleName+cals+' kcal plan',created:now,updated:now,
      notes:'Made with "Generate me a meal plan" for your targets: '+cals+' kcal · '+P+'g protein · '+C+'g carbs · '+Fa+'g fat.\nWeigh meat, fish and potatoes raw and rice, pasta, oats and lentils dry. Swaps are fine if they fit your macros.',
      days:[{name:'Every day',notes:'',meals:meals}],_t:[cals,P,C,Fa]}}

  /* ---------- the panel in the client's Meal plan tab ---------- */
  function Panel(el,o){ // o: {onSaved(doc), demo}
    var targets=null,last=null;
    el.innerHTML='<div class="mg"><button type="button" class="btn" data-g="open">✨ Generate me a meal plan</button><div class="mg-body"></div></div>';
    var body=el.querySelector('.mg-body');
    function getT(){if(o.demo)return Promise.resolve({cals:'1800',protein:'150',carbs:'190',fat:'50'});
      return fetch('/portal/api/targets',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){return j&&j.targets})}
    function form(){
      var ck=function(v,l){return '<label class="mg-ck"><input type="checkbox" name="ban" value="'+v+'"> '+l+'</label>'};
      body.innerHTML='<div class="pg-note mg-form">'+
        '<div class="mg-pref">📝 <b>Update your food preferences first.</b> Pick your food style, your diet, anything you don\'t eat and the foods you love, so your plan is built around you. They\'re saved for next time.</div>'+
        '<p>Pick what you like to eat and I\'ll build a day of food that hits your targets: <b>'+esc(targets.cals)+' kcal</b>'+(targets.protein?' · '+esc(targets.protein)+'g protein · '+esc(targets.carbs)+'g carbs · '+esc(targets.fat)+'g fat':'')+'.</p>'+
        '<label>Food style<select name="style"><option value="standard">Everyday British</option><option value="indian">Indian</option><option value="mediterranean">Mediterranean</option><option value="turkish">Turkish</option><option value="bulgarian">Bulgarian</option></select></label>'+
        '<label>Diet<select name="diet"><option value="all">I eat everything</option><option value="nobp">No beef or pork</option><option value="pesc">Pescatarian (fish, no meat)</option><option value="veg">Vegetarian</option><option value="vegan">Vegan</option></select></label>'+
        '<label>Meals a day<select name="meals"><option>3</option><option selected>4</option><option>5</option></select></label>'+
        '<div class="mg-cks"><small>I don\'t eat</small>'+ck('beef','Beef')+ck('pork','Pork')+ck('fish','Fish')+ck('dairy','Dairy')+ck('egg','Eggs')+ck('gluten','Gluten')+ck('nuts','Nuts')+'</div>'+
        '<label>Anything else you don\'t like? (optional)<input name="dislike" placeholder="e.g. salmon, tofu"></label>'+
        '<label>Foods you love (optional)<input name="love" placeholder="e.g. chicken, rice, eggs, chapati"></label>'+
        '<div class="mg-act"><button type="button" class="btn" data-g="go">Generate</button><button type="button" class="btn g" data-g="close">Cancel</button></div></div><div class="mg-out"></div>';
    }
    function opts(){var g=function(n){return body.querySelector('[name='+n+']').value};
      var r={targets:targets,style:g('style'),diet:g('diet'),meals:g('meals'),ban:[].map.call(body.querySelectorAll('[name=ban]:checked'),function(x){return x.value}),dislike:g('dislike').split(','),love:g('love').split(',')};
      var fp={style:r.style,diet:r.diet,meals:r.meals,ban:r.ban,dislike:g('dislike'),love:g('love')};if(!o.demo&&JSON.stringify(fp)!==JSON.stringify(saved))fetch('/portal/api/prefs',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({food:fp})}).then(function(){saved=fp}).catch(function(){});return r}
    var saved=null;function prefill(){if(!saved)return;var set=function(n,v){var x=body.querySelector('[name='+n+']');if(x&&v!=null&&v!=='')x.value=v};set('style',saved.style);set('diet',saved.diet);set('meals',saved.meals);set('dislike',saved.dislike);set('love',saved.love);[].forEach.call(body.querySelectorAll('[name=ban]'),function(x){x.checked=(saved.ban||[]).indexOf(x.value)>-1});var p=body.querySelector('.mg-pref');if(p&&saved.at)p.innerHTML='📝 <b>Your saved food preferences are filled in.</b> Change anything that\'s different now, then tap Generate.'}
    if(!o.demo)fetch('/portal/api/prefs',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(p){if(p&&p.food){saved={style:p.food.style,diet:p.food.diet,meals:p.food.meals,ban:p.food.ban||[],dislike:p.food.dislike||'',love:p.food.love||'',at:p.food.at};prefill()}}).catch(function(){});
    function show(p){
      var out=body.querySelector('.mg-out'),d=p.days[0],t={k:0,p:0,c:0,f:0};
      d.meals.forEach(function(m){m.foods.forEach(function(f){t.k+=+f.kcal;t.p+=+f.p;t.c+=+f.c;t.f+=+f.f})});
      out.innerHTML='<div class="lg-stats mp-tot"><div><small>Calories</small><b>'+Math.round(t.k)+'</b><span>target '+esc(targets.cals)+'</span></div><div><small>Protein</small><b>'+Math.round(t.p)+'g</b></div><div><small>Carbs</small><b>'+Math.round(t.c)+'g</b></div><div><small>Fat</small><b>'+Math.round(t.f)+'g</b></div></div>'+
        d.meals.map(function(m){return '<div class="mp-meal"><div class="mp-mh"><b>'+esc(m.name)+'</b></div><p class="mp-note">'+esc(m.notes)+'</p><ul>'+m.foods.map(function(f){return '<li><span>'+esc(f.food)+'</span><b>'+esc(f.amount)+' '+esc(f.unit)+'</b></li>'}).join('')+'</ul></div>'}).join('')+
        '<div class="mg-act"><button type="button" class="btn" data-g="save">Save to my meal plans</button><button type="button" class="btn g" data-g="go">Try another</button></div><p class="lg-msg"></p>';
    }
    el.addEventListener('click',function(e){var b=e.target.closest('[data-g]');if(!b)return;var a=b.getAttribute('data-g');
      if(a==='open'){body.innerHTML='<p style="color:var(--mute)">Loading your targets…</p>';getT().then(function(t){if(!t||!+t.cals){body.innerHTML='<div class="pg-note">Your coach hasn\'t set your calories and macros yet. Once they have, you can generate a plan here.</div>';return}targets=t;form();prefill()}).catch(function(){body.innerHTML='<div class="pg-note">Couldn\'t load your targets. Try again.</div>'})}
      if(a==='close'){body.innerHTML=''}
      if(a==='go'){last=generate(opts());if(!last){body.querySelector('.mg-out').innerHTML='<div class="pg-note">Those choices rule out too many foods. Untick something and try again.</div>';return}show(last)}
      if(a==='save'&&last){var m=body.querySelector('.lg-msg');b.disabled=true;m.textContent='Saving…';
        if(o.demo){m.textContent='Saved ✓ (preview only)';return}
        fetch('/portal/api/mealplans',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({plan:last})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw 0;return j})})
          .then(function(j){body.innerHTML='<div class="pg-note" style="border-color:#5fbf7f">✅ Saved. It\'s now your current meal plan.</div>';o.onSaved&&o.onSaved(j)})
          .catch(function(){b.disabled=false;m.textContent='Not saved. Try again.'})}
    });
  }
  window.MPFMealGen={generate:generate,Panel:Panel};

  /* ---------- "My goal and maintenance" card ---------- */
  function Body(el,o){
    function draw(b){
      var kcal=+String(b.cals||'').replace(/,/g,''),m=b.maintenance,diff=m&&kcal?kcal-m:null;
      var vs=diff===null?'':Math.abs(diff)<75?'about the same as your maintenance (maintenance phase)':Math.abs(diff)+' kcal '+(diff<0?'below':'above')+' maintenance ('+(diff<0?'a deficit, so you lose fat':'a surplus, so you build muscle')+')';
      var row=function(l,v){return '<div><small>'+l+'</small><b>'+v+'</b></div>'};
      el.innerHTML='<div class="lg-stats mp-tot">'+row('Phase',esc(b.phase||'Not set'))+row('Goal',esc(b.goal||'Not set')+(b.goalweight?' · '+esc(b.goalweight)+' kg':''))+row('Weight',b.weight?esc(b.weight)+' kg':'Log your weight')+row('Body fat',b.bf?esc(b.bf)+'%':'Add below')+'</div>'+
        (m?'<div class="pg-note"><b>Your maintenance: about '+m+' kcal a day.</b> That\'s what keeps your weight the same, worked out from your latest weight ('+esc(b.weight)+' kg) and body fat ('+esc(b.bf)+'%): '+esc(b.lean)+' kg of lean mass burns about '+esc(b.bmr)+' kcal at rest, then your training and steps on top.'+(vs?'<br>Your target of '+kcal+' kcal is '+vs+'.':'')+'</div>'
          :'<div class="pg-note">Add your body fat % (and log your weight in your daily log) to see your maintenance calories.</div>')+
        '<div class="mg-act"><label style="flex:1">Update my body fat %<input name="bf" type="number" step="0.1" min="3" max="60" placeholder="e.g. 22" value="'+esc(b.bf||'')+'"></label><button type="button" class="btn" data-b="save">Save</button></div><p class="lg-msg"></p>'+
        '<p class="pg-key">It updates every time you log a new weight or body fat. It\'s an estimate: your coach will fine-tune your calories from your weekly check-ins.</p>';
      el.querySelector('[data-b=save]').onclick=function(){var v=el.querySelector('[name=bf]').value,msg=el.querySelector('.lg-msg');msg.textContent='Saving…';
        if(o.demo){b.bf=v;b.lean=Math.round(b.weight*(1-v/100)*10)/10;b.bmr=Math.round(370+21.6*b.lean);b.maintenance=Math.round(b.bmr*1.55/10)*10;draw(b);return}
        fetch('/portal/api/body',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({bf:v})}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(draw).catch(function(){msg.textContent='Enter a body fat % between 3 and 60.'})};
    }
    if(o.demo){draw({phase:'Fat loss',goal:'Fat loss',goalweight:'62',weight:68,bf:'24',lean:51.7,bmr:1487,maintenance:2300,cals:'1800'});return}
    fetch('/portal/api/body',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(draw).catch(function(){el.innerHTML='<div class="pg-empty">Couldn\'t load your numbers.</div>'});
  }
  window.MPFBody={Panel:Body};
})();
