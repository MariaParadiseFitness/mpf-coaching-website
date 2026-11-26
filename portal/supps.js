/* MPF supplement quiz. Food first: this only suggests what's worth buying, what to skip, and when to see the GP. MPFSupps.mount(el) */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var KEY='mpf_supps_v1';
  var Q=[
    {k:'sex',l:'Are you female or male?',o:[['f','Female'],['m','Male']],auto:1},
    {k:'goal',l:'What\'s your main goal right now?',o:[['fat','Fat loss'],['muscle','Build muscle'],['recomp','Lose fat and build muscle'],['strength','Get stronger'],['health','Health and fitness']]},
    {k:'protein',l:'Do you hit your protein target from food?',o:[['yes','Most days, easily'],['some','Some days'],['no','Rarely']]},
    {k:'diet',l:'Any way of eating you follow?',o:[['all','No, I eat everything'],['pesc','Pescatarian'],['veg','Vegetarian'],['vegan','Vegan'],['carn','Carnivore']]},
    {k:'dairy',l:'Can you have dairy?',o:[['yes','Yes'],['no','No, it doesn\'t agree with me']],skip:function(a){return a.diet==='vegan'}},
    {k:'fish',l:'How often do you eat oily fish? (salmon, mackerel, sardines, trout)',o:[['2','Twice a week or more'],['1','About once a week'],['0','Rarely or never']],skip:function(a){return a.diet==='veg'||a.diet==='vegan'}},
    {k:'sun',l:'In spring and summer, are you outside in daylight most days with some skin uncovered?',o:[['yes','Yes'],['no','Not really'],['cover','I cover most of my skin outdoors, or I have darker skin']]},
    {k:'energy',l:'How\'s your energy for training?',o:[['good','Good'],['low','Often flat or tired'],['caff','I already have coffee or pre-workout before training']]},
    {k:'periods',l:'Do you have heavy periods, or feel tired all the time even when you sleep well?',o:[['no','No'],['yes','Yes'],['na','Not applicable']],skip:function(a){return a.sex!=='f'}},
    {k:'preg',l:'Are you pregnant, breastfeeding or trying for a baby?',o:[['no','No'],['try','Trying for a baby'],['preg','Pregnant'],['bf','Breastfeeding']],skip:function(a){return a.sex!=='f'}},
    {k:'med',l:'Do you take any medication or have a medical condition (for example kidney, heart, blood pressure or thyroid)?',o:[['no','No'],['yes','Yes']]}
  ];

  function build(a){
    var buy=[],ask=[],skip=[],
      vegan=a.diet==='vegan',veg=a.diet==='veg',carn=a.diet==='carn',preg=a.preg==='preg'||a.preg==='bf',gp=a.med==='yes';
    // Creatine
    if(!preg)buy.push({i:'💪',t:'Creatine monohydrate',d:'The most researched supplement there is. It helps you get more out of your sets, so you build more muscle and strength over time, and it helps you hold on to muscle when you\'re in a deficit. 3 to 5g a day, every day, any time of day. No loading phase needed, and no need to cycle off.',n:'Plain creatine monohydrate powder is all you need. Your weight can go up 1 to 2kg in the first couple of weeks. That\'s water in your muscles, not fat, so don\'t panic at the scales.'+(gp?' As you take medication or have a condition, check with your GP first, especially for anything kidney related.':'')+(vegan?' It\'s made synthetically, so it\'s vegan friendly.':'')});
    // Protein
    if(a.protein!=='yes'&&!carn){
      var pt=vegan?'Vegan protein powder':(a.dairy==='no'?'Dairy-free protein powder':'Whey protein');
      buy.push({i:'🥤',t:pt,d:'Protein powder isn\'t magic, it\'s just food in a handy form. If you\'re struggling to hit your protein target, one scoop gives you around 20 to 25g for very few calories. Have it as a shake, in oats or yoghurt, or after training.',n:vegan?'Pick a blend (pea and rice, or soy) so you get a full amino acid profile.':(a.dairy==='no'?'Whey isolate is very low in lactose and suits most people. If dairy still disagrees with you, go for a pea and rice blend or egg white protein.':'Any whey from a decent brand is fine. Whey isolate if regular whey upsets your stomach.')});
    }else if(a.protein==='yes')skip.push({t:'Protein powder',d:'You already hit your protein from food, so you don\'t need it. Keep it in mind for busy days if it makes life easier.'});
    // Vitamin D
    var yr=a.sun!=='yes';
    buy.push({i:'☀️',t:'Vitamin D',d:'The NHS advises everyone in the UK to take 10 micrograms (400 IU) a day from October to March, because there isn\'t enough sunlight for your skin to make it. '+(yr?'From your answers, it\'s worth taking it all year round.':'Through spring and summer you\'ll likely get enough from being outside.'),n:(vegan?'Most vitamin D3 comes from sheep\'s wool, so look for vegan D3 (from lichen) or D2. ':'')+'Don\'t go above 100 micrograms (4,000 IU) a day unless your GP tells you to.'+(gp?' Check with your GP first as you take medication.':'')});
    // Omega 3
    if(vegan||veg)buy.push({i:'🌿',t:'Algae omega-3',d:'You don\'t eat oily fish, which is the main source of the omega-3 fats EPA and DHA. These matter for your heart, brain and joints. Algae oil gives you the same thing, plant based.',n:'Look for one that lists EPA and DHA on the label.'+(gp?' If you take blood thinners, check with your GP first.':'')});
    else if(a.fish==='0')buy.push({i:'🐟',t:'Omega-3 (fish oil)',d:'The NHS recommends 2 portions of fish a week, one of them oily. If that\'s not you, a fish oil helps cover the omega-3 fats EPA and DHA, good for your heart, brain and joints.',n:'Eating more oily fish is even better, if you can. Look for EPA and DHA on the label.'+(preg?' Pregnant or breastfeeding: avoid cod liver oil (too much vitamin A) and check with your midwife.':'')+(gp?' If you take blood thinners, check with your GP first.':'')});
    else skip.push({t:'Fish oil',d:'You\'re getting oily fish in already, so you\'re covered.'});
    // B12
    if(vegan)buy.push({i:'🧬',t:'Vitamin B12',d:'This one is a must on a vegan diet. B12 only naturally comes from animal foods, and running low makes you tired and can cause nerve problems over time.',n:'Take a B12 supplement or use foods fortified with it (some plant milks, cereals and nutritional yeast) every day.'});
    else if(veg)buy.push({i:'🧬',t:'Vitamin B12 (worth considering)',d:'If you don\'t have much dairy or eggs, you can run low on B12. Fortified foods or a low dose B12 tablet covers it.'});
    // Caffeine
    if(a.energy==='low')buy.push({i:'☕',t:'Caffeine before training (optional)',d:'A coffee 30 to 60 minutes before you train helps you feel more alert and push harder. A strong coffee is just as good as a pre-workout, and much cheaper.',n:'Have your last one before about 2pm so it doesn\'t wreck your sleep. '+(preg?'Pregnant: keep to under 200mg a day (about 2 mugs of instant coffee). ':'')+'If you\'re always flat, look at your sleep, food and stress first, and tell me so we can sort it.'+(gp?' Check with your GP if you have a heart or blood pressure condition.':'')});
    // Folic acid
    if(a.preg==='try'||a.preg==='preg')buy.push({i:'🤍',t:'Folic acid',d:'The NHS advises 400 micrograms of folic acid a day while you\'re trying for a baby and up to 12 weeks pregnant. Your GP or midwife may give you a higher dose.',n:'A pregnancy multivitamin usually covers this and your vitamin D. Avoid any with vitamin A (retinol).'});
    // See your GP
    if(a.periods==='yes')ask.push({i:'🩸',t:'Iron: get a blood test first',d:'Heavy periods and feeling tired all the time can be a sign of low iron. Please don\'t just buy iron tablets, as too much can be harmful. Ask your GP for a blood test (including ferritin) and they\'ll tell you if you need it and how much.'});
    if(preg)ask.push({i:'🤰',t:'Check everything with your midwife',d:'While you\'re pregnant or breastfeeding, please check any supplement with your midwife, GP or pharmacist before you take it. I\'ve left creatine off your list for now.'});
    if(gp)ask.push({i:'💊',t:'Medication or a medical condition',d:'Some supplements can interact with medication. Show this list to your GP or pharmacist before you start anything.'});
    if(carn)ask.push({i:'🥩',t:'Talk to me about your diet',d:'A carnivore diet has no fibre and very little vitamin C or folate, which come from plants. Supplements don\'t fully replace those. Message me and we\'ll look at it together.'});
    // Skip list (everyone)
    skip.push({t:'Fat burners',d:'They don\'t burn fat. Most are just lots of caffeine at a big markup. Your deficit does the work.'});
    skip.push({t:'BCAAs and EAAs',d:'Pointless if you\'re hitting your protein. You\'re already getting them from your food.'});
    skip.push({t:'Detox teas and cleanses',d:'Your liver and kidneys do the detoxing. Most of these teas are laxatives.'});
    skip.push({t:'Testosterone boosters',d:'No good evidence they do anything for muscle. Save your money.'});
    skip.push({t:'Mass gainers',d:'Mostly sugar and cheap calories. Real food plus a protein shake does the job better.'});
    if(a.goal!=='health')skip.push({t:'Collagen for muscle',d:'It\'s a poor protein for building muscle. Count it towards your protein if you like it, but it won\'t replace whey or food.'});
    return {buy:buy,ask:ask,skip:skip};
  }

  function mount(el){
    if(!el)return;
    var a={},saved=null;
    try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
    function qs(){return Q.filter(function(q){if(q.auto&&a.sex&&a._auto)return false;return !(q.skip&&q.skip(a))})}
    function start(){a={};var s=window.__mpfSex;if(s==='f'||s==='m'){a.sex=s;a._auto=1}ask()}
    function ask(){
      var list=qs(),h='<div class="sq-intro">Food first, always. Supplements only fill the gaps. Answer '+list.length+' quick questions and I\'ll tell you what\'s worth buying and what to save your money on.</div>';
      h+=list.map(function(q){return '<div class="ob-q sq-q" data-k="'+q.k+'"><label class="sq-l">'+esc(q.l)+'</label><div class="ob-opts">'+q.o.map(function(o){return '<button type="button" data-v="'+o[0]+'"'+(a[q.k]===o[0]?' class="on"':'')+'>'+esc(o[1])+'</button>'}).join('')+'</div></div>'}).join('');
      h+='<button type="button" class="btn sq-go" data-go>Show my supplements</button><p class="sq-err" hidden>Please answer every question.</p>';
      el.innerHTML=h;
    }
    function card(x,cls){return '<div class="sq-c '+cls+'"><div class="sq-ch"><span class="sq-i">'+(x.i||'')+'</span><b>'+esc(x.t)+'</b></div><p>'+esc(x.d)+'</p>'+(x.n?'<small>'+esc(x.n)+'</small>':'')+'</div>'}
    function show(r){
      var h='';
      h+='<h3 class="sq-h">Worth <em>buying.</em></h3><div class="sq-g">'+r.buy.map(function(x){return card(x,'buy')}).join('')+'</div>';
      if(r.ask.length)h+='<h3 class="sq-h">Check <em>first.</em></h3><div class="sq-g">'+r.ask.map(function(x){return card(x,'ask')}).join('')+'</div>';
      h+='<h3 class="sq-h">Save your <em>money.</em></h3><div class="sq-skip">'+r.skip.map(function(x){return '<div><b>'+esc(x.t)+'</b><span>'+esc(x.d)+'</span></div>'}).join('')+'</div>';
      h+='<p class="sq-disc">This is general advice, not medical advice. Supplements don\'t replace a good diet. If you have a medical condition, take medication, or are pregnant or breastfeeding, check with your GP or pharmacist first. Questions? Message me.</p>';
      h+='<button type="button" class="btn g sq-re" data-re>Retake the quiz</button>';
      el.innerHTML=h;window.scrollTo&&el.scrollIntoView&&el.scrollIntoView({block:'start'});
    }
    el.addEventListener('click',function(e){
      var b=e.target.closest('.sq-q .ob-opts button');
      if(b){var k=b.closest('.sq-q').getAttribute('data-k');a[k]=b.getAttribute('data-v');var keep=Object.assign({},a);ask();a=keep;var n=el.querySelector('.sq-q[data-k="'+k+'"]');n=n&&n.nextElementSibling;if(n&&n.classList.contains('sq-q')&&!a[n.getAttribute('data-k')])n.scrollIntoView({block:'center',behavior:'smooth'});return}
      if(e.target.closest('[data-go]')){var miss=qs().filter(function(q){return !a[q.k]});[].forEach.call(el.querySelectorAll('.sq-q'),function(x){x.classList.toggle('miss',!a[x.getAttribute('data-k')])});if(miss.length){el.querySelector('.sq-err').hidden=false;var m=el.querySelector('.sq-q.miss');if(m)m.scrollIntoView({block:'center',behavior:'smooth'});return}
        try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}show(build(a));return}
      if(e.target.closest('[data-re]')){try{localStorage.removeItem(KEY)}catch(e){}start();el.scrollIntoView({block:'start'})}
    });
    if(saved&&saved.goal){a=saved;show(build(a))}else start();
  }
  window.MPFSupps={mount:mount,build:build};
})();
