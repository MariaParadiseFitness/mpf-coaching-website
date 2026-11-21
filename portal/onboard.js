/* MPF new client onboarding form (includes the PAR-Q). Client fills it in; coach reads the answers. */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var YN=['Yes','No'];
  var SECTIONS=[
    {t:'About you',i:'👤',q:[
      {k:'fullname',l:'Full name',t:'text',req:1},
      {k:'dob',l:'Date of birth',t:'date',req:1},
      {k:'phone',l:'Mobile number',t:'text',im:'tel'},
      {k:'emergency',l:'Emergency contact (name and number)',t:'text',req:1,type:'pt'},
      {k:'job',l:'What do you do for work?',t:'text'},
      {k:'jobactivity',l:'How active is your job?',t:'choice',o:['Sitting most of the day','On my feet some of the day','On my feet most of the day','Physical job']},
      {k:'height',l:'Height (cm)',t:'num',req:1},
      {k:'weight',l:'Current weight (kg)',t:'num',req:1}
    ]},
    {t:'Your goals',i:'🎯',q:[
      {k:'goal',l:'Main goal',t:'choice',o:['Fat loss','Build muscle','Body recomposition (lose fat and build muscle)','Get stronger / performance','Health and fitness'],req:1},
      {k:'goalweight',l:'Goal weight (kg), if you have one',t:'num'},
      {k:'goaldate',l:'Any date you are working towards (holiday, event)?',t:'text'},
      {k:'why',l:'Why is this important to you right now?',t:'area'},
      {k:'success',l:'What would success look like in 12 weeks?',t:'area'}
    ]},
    {t:'PAR-Q health questions',i:'🩺',note:'Please answer honestly. If you answer yes to any, it does not mean you cannot train, it just helps me keep you safe.',q:[
      {k:'pq1',l:'Has a doctor ever said you have a heart condition, or that you should only do physical activity recommended by a doctor?',t:'yn',req:1},
      {k:'pq2',l:'Do you feel pain in your chest when you do physical activity?',t:'yn',req:1},
      {k:'pq3',l:'In the past month, have you had chest pain when you were not doing physical activity?',t:'yn',req:1},
      {k:'pq4',l:'Do you lose your balance because of dizziness, or have you ever lost consciousness?',t:'yn',req:1},
      {k:'pq5',l:'Do you have a bone or joint problem that could be made worse by a change in your physical activity?',t:'yn',req:1},
      {k:'pq6',l:'Is your doctor currently prescribing medication for your blood pressure or a heart condition?',t:'yn',req:1},
      {k:'pq7',l:'Do you know of any other reason why you should not do physical activity?',t:'yn',req:1},
      {k:'pqdetail',l:'If you answered yes to any of the above, please tell me more',t:'area'}
    ]},
    {t:'Medical history',i:'💊',q:[
      {k:'conditions',l:'Any medical conditions (for example asthma, diabetes, thyroid, PCOS, high blood pressure)?',t:'area'},
      {k:'medication',l:'Any medication you take?',t:'area'},
      {k:'injuries',l:'Any injuries, pain or past surgeries?',t:'area'},
      {k:'pregnant',l:'Are you pregnant, breastfeeding or have you given birth in the last 12 months?',t:'choice',o:['No','Pregnant','Breastfeeding','Given birth in the last 12 months','Not applicable'],sex:'f'},
      {k:'cycle',l:'Is your menstrual cycle regular?',t:'choice',o:['Yes','No','Not sure','On contraception that affects it','Not applicable'],sex:'f'},
      {k:'ed',l:'Have you ever had an eating disorder or a difficult relationship with food?',t:'choice',o:['No','Yes','I would rather talk about it on the phone'],req:1},
      {k:'eddetail',l:'If yes, anything you are happy to share (only Maria sees this)',t:'area'},
      {k:'mental',l:'Anything about your mental health you would like me to know?',t:'area'},
      {k:'allergies',l:'Any food allergies or intolerances?',t:'area'}
    ]},
    {t:'Training',i:'🏋️',q:[
      {k:'experience',l:'Training experience',t:'choice',o:['Beginner (less than 1 year)','Intermediate (1 to 3 years)','Advanced (3+ years)'],req:1},
      {k:'currenttraining',l:'What does your training look like right now?',t:'area'},
      {k:'days',l:'How many days a week can you train?',t:'choice',o:['2','3','4','5','6'],req:1},
      {k:'length',l:'How long can each session be?',t:'choice',o:['30 to 45 mins','45 to 60 mins','60 to 90 mins','90+ mins']},
      {k:'gym',l:'Where do you train? (gym name, or home)',t:'text'},
      {k:'equipment',l:'If at home, what equipment do you have?',t:'area'},
      {k:'love',l:'Exercises you love',t:'area'},
      {k:'avoid',l:'Exercises you hate or cannot do',t:'area'},
      {k:'cardio',l:'What cardio do you enjoy?',t:'text'}
    ]},
    {t:'Food',i:'🍽️',q:[
      {k:'diet',l:'Any way of eating you follow?',t:'choice',o:['No','Vegetarian','Vegan','Pescatarian','Halal','Kosher','Other']},
      {k:'foodslove',l:'Foods you love and want in your plan',t:'area'},
      {k:'foodsno',l:'Foods you will not eat',t:'area'},
      {k:'meals',l:'How many meals a day suits you?',t:'choice',o:['2','3','4','5','6']},
      {k:'cooking',l:'How do you feel about cooking?',t:'choice',o:['I love it','It is fine','I hate it / no time']},
      {k:'eatout',l:'How often do you eat out or get takeaways?',t:'text'},
      {k:'alcohol',l:'How much alcohol do you drink in a typical week?',t:'text'},
      {k:'tracking',l:'Have you tracked calories or macros before?',t:'choice',o:['Never','A little','Yes, I am confident']},
      {k:'pastdiets',l:'Diets you have tried before, and how they went',t:'area'},
      {k:'supplements',l:'Any supplements you take?',t:'area'}
    ]},
    {t:'Lifestyle',i:'🌙',q:[
      {k:'sleep',l:'How many hours do you sleep on average?',t:'num'},
      {k:'sleepq',l:'Sleep quality (1 = awful, 10 = amazing)',t:'scale'},
      {k:'stress',l:'Stress level (1 = calm, 10 = very stressed)',t:'scale'},
      {k:'schedule',l:'Work hours or shift pattern',t:'text'},
      {k:'steps',l:'Average daily steps (if you know)',t:'num'},
      {k:'tracker',l:'Do you have a step counter you wear on your wrist?',t:'yn'},
      {k:'other',l:'Anything else I should know?',t:'area'}
    ]},
    {t:'Confirm',i:'✅',q:[
      {k:'consent',l:'The information I have given is accurate, and I will tell Maria if anything changes.',t:'check',req:1}
    ]}
  ];

  function visible(q,sex,type){return (!q.sex||q.sex===sex)&&(!q.type||q.type===type)}
  function input(q,v){
    var id='ob-'+q.k,n=' name="'+q.k+'" id="'+id+'"';
    if(q.t==='area')return '<textarea'+n+' rows="3">'+esc(v)+'</textarea>';
    if(q.t==='yn'||q.t==='choice'){var o=q.t==='yn'?YN:q.o;return '<div class="ob-opts" data-k="'+q.k+'">'+o.map(function(x){return '<button type="button" data-v="'+esc(x)+'" class="'+(v===x?'on':'')+'">'+esc(x)+'</button>'}).join('')+'</div>'}
    if(q.t==='scale'){var b='';for(var i=1;i<=10;i++)b+='<button type="button" data-v="'+i+'" class="'+(String(v)===String(i)?'on':'')+'">'+i+'</button>';return '<div class="lg-scale ob-opts" data-k="'+q.k+'">'+b+'</div>'}
    if(q.t==='check')return '<label class="ob-check"><input type="checkbox"'+n+(v==='Yes'?' checked':'')+'> I agree</label>';
    return '<input'+n+' type="'+(q.t==='date'?'date':'text')+'"'+(q.t==='num'?' inputmode="decimal"':q.im?' inputmode="'+q.im+'"':'')+' value="'+esc(v)+'">';
  }

  /* client form */
  function Form(el,o){
    o=o||{};var sex=o.sex||'f',type=o.type==='pt'?'pt':'online',ans={},submitted=null,timer;
    function draw(){
      el.innerHTML='<p class="ci-note" style="margin-bottom:14px">This tells me everything I need to build your calories, macros, meal plan and training. It takes about 10 minutes and saves as you go, so you can come back to it. Only Maria can see your answers.</p>'+
        SECTIONS.map(function(s){var qs=s.q.filter(function(q){return visible(q,sex,type)});return '<fieldset class="ob-sec"><legend>'+s.i+' '+esc(s.t)+'</legend>'+(s.note?'<p class="ci-note">'+esc(s.note)+'</p>':'')+qs.map(function(q){return '<div class="ob-q" data-q="'+q.k+'"><label for="ob-'+q.k+'">'+esc(q.l)+(q.req?' <i>*</i>':'')+'</label>'+input(q,ans[q.k]||'')+'</div>'}).join('')+'</fieldset>'}).join('')+
        '<div class="ci-btns"><span class="lg-msg" id="obMsg">'+(submitted?'Sent ✓ You can still update your answers.':'')+'</span><button class="btn" type="button" id="obSend">'+(submitted?'Update my answers':'Send my form to Maria')+'</button></div>';
      [].forEach.call(el.querySelectorAll('.ob-opts button'),function(b){b.onclick=function(){var k=b.parentNode.getAttribute('data-k');ans[k]=b.getAttribute('data-v');[].forEach.call(b.parentNode.children,function(x){x.classList.toggle('on',x===b)});later()}});
      el.oninput=function(e){var t=e.target;if(!t.name)return;ans[t.name]=t.type==='checkbox'?(t.checked?'Yes':''):t.value;later()};
      el.onchange=el.oninput;
      el.querySelector('#obSend').onclick=send;
    }
    function later(){clearTimeout(timer);var m=el.querySelector('#obMsg');m.textContent='Saving…';m.className='lg-msg';timer=setTimeout(function(){save(false)},1200)}
    function save(submit){
      var m=el.querySelector('#obMsg');
      if(o.demo){m.textContent=submit?'Sent ✓ (preview)':'Saved';return Promise.resolve()}
      return fetch('/portal/api/onboarding',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({answers:ans,submit:submit})}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){submitted=j.submitted;m.textContent=submit?'Sent ✓ Thank you!':(submitted?'Saved ✓':'Saved. Send it when you are done.');m.className='lg-msg ok'}).catch(function(){m.textContent='Not saved. Check your signal.';m.className='lg-msg warn'});
    }
    function send(){
      var missing=[];SECTIONS.forEach(function(s){s.q.forEach(function(q){if(q.req&&visible(q,sex,type)&&!String(ans[q.k]||'').trim())missing.push(q)})});
      [].forEach.call(el.querySelectorAll('.ob-q'),function(n){n.classList.toggle('miss',missing.some(function(q){return q.k===n.getAttribute('data-q')}))});
      if(missing.length){var m=el.querySelector('#obMsg');m.textContent='Please fill in the questions marked in red ('+missing.length+').';m.className='lg-msg warn';el.querySelector('.ob-q.miss').scrollIntoView({block:'center'});return}
      clearTimeout(timer);save(true).then(function(){if(o.onSubmit)o.onSubmit()});
    }
    if(o.demo){draw();return}
    fetch('/portal/api/onboarding',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){ans=j.answers||{};submitted=j.submitted;draw()}).catch(draw);
  }

  /* coach: read-only answers */
  function answersHTML(doc,sex,type){type=type==='pt'?'pt':'online';
    var a=(doc&&doc.answers)||{};
    if(!Object.keys(a).length)return '<p class="ci-note">They have not filled in their onboarding form yet.</p>';
    var flag=function(q,v){return (q.k.indexOf('pq')===0&&q.k!=='pqdetail'&&v==='Yes')||(q.k==='ed'&&v&&v!=='No')||(q.k==='pregnant'&&v&&v!=='No'&&v!=='Not applicable')};
    return '<p class="ci-note">'+(doc.submitted?'Sent '+new Date(doc.submitted).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Started but <b>not sent yet</b>')+'</p>'+
      SECTIONS.map(function(s){return '<details class="ci-card" open><summary><b>'+s.i+' '+esc(s.t)+'</b></summary><div class="ci-ans">'+s.q.filter(function(q){return visible(q,sex,type)}).map(function(q){var v=a[q.k];return '<div'+(flag(q,v)?' class="flag"':'')+'><b>'+esc(q.l)+'</b><p>'+(v?esc(v):'<i style="color:#6f6650">No answer</i>')+'</p></div>'}).join('')+'</div></details>'}).join('');
  }
  window.MPFOnboard={Form:Form,answersHTML:answersHTML};
})();
