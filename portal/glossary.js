/* MPF training terms: every bit of gym jargon in the app, explained in plain English.
   MPFGloss.open('rir') opens the glossary with that term at the top. MPFGloss.btn('rir') gives a little ⓘ button. */
(function(){
  var T=[
    ['Effort',[
      ['rpe','RPE (Rate of Perceived Exertion)','<p>How hard a set feels, on a scale of 1 to 10.</p><ul><li><b>10</b> = all-out, you couldn\'t do another rep</li><li><b>8</b> = hard, about 2 reps left in you</li><li><b>6</b> = moderate, you could do about 4 more reps</li><li><b>4 or below</b> = easy</li></ul><p><b>Your warm-up sets should feel like about a 6.</b> That gets your muscles and joints ready and lets you practise the movement without tiring you out before your working sets.</p>'],
      ['rir','RIR (Reps In Reserve)','<p>How many more good reps you could have done when you finished the set.</p><ul><li><b>0 RIR</b> = you couldn\'t do another rep with good form</li><li><b>1 RIR</b> = 1 more rep was in the tank</li><li><b>2 RIR</b> = 2 more reps left</li><li><b>3 RIR</b> = 3 more reps left</li></ul><p><b>Your working sets should finish between 0 and 3 RIR.</b> That means every working set is genuinely hard, which is what makes your muscles grow. If you could have done 4 or more extra reps, go a bit heavier or do more reps next time.</p><p class="gl-s">RIR and RPE match up: 0 RIR = RPE 10, 1 RIR = RPE 9, 2 RIR = RPE 8, 3 RIR = RPE 7.</p>'],
      ['failure','Failure / to failure','<p>Doing reps until you physically can\'t do another one with good form. That\'s 0 RIR. Marked <b>F</b> in your logbook.</p>']
    ]],
    ['Bracing',[
      ['brace','How to brace','<p>Bracing protects your lower back and makes you stronger, because a solid middle lets your legs and arms push harder. Most people don\'t brace properly, so it\'s worth practising on every rep.</p><ul><li><b>1. Breathe in</b> through your nose, deep into your belly and the sides of your waist, not up into your chest and shoulders.</li><li><b>2. Tighten</b> your abs all the way round, like someone is about to punch you in the stomach, or like you\'re about to cough.</li><li><b>3. Ribs down</b> so they stack over your hips. No arching your lower back.</li><li><b>4. Hold it</b> through the hardest part of the rep.</li><li><b>5. Breathe out</b> at the top or as you finish the rep, then breathe in and re-brace before the next one.</li></ul><p><b>Heavy compound lifts</b> (squats, deadlifts, RDLs, presses, rows) need a full, hard brace. <b>Machines and isolation exercises</b> need a lighter brace, just enough to keep your body still so the target muscle does the work.</p><p class="gl-s">Each exercise in your logbook has its own brace tip under the name.</p>']
    ]],
    ['Kit',[
      ['straps','Lifting straps and wrist wraps','<p><b>Lifting straps</b> loop round your wrist and the bar or handle, so your grip doesn\'t give out before the muscle you\'re training.</p><ul><li><b>Use them</b> on your heavier working sets of pulling and hinging exercises: RDLs, deadlifts, rows, pulldowns, shrugs, and heavy dumbbell lunges. If your grip fails first, your back or legs never get pushed hard enough to grow.</li><li><b>Don\'t use them</b> on warm-ups and lighter sets, so your grip still gets trained. And never on curls, presses or raises, they don\'t need them.</li></ul><p><b>Wrist wraps</b> are stiff wraps round your wrist joint for support when you press.</p><ul><li><b>Use them</b> on your heaviest bench, shoulder press or weighted dip sets if your wrists bend back or ache.</li><li><b>Don\'t use them</b> on warm-ups, light sets or machines. They\'re support, not a fix for bad form: keep your wrists stacked over your elbows.</li></ul><p class="gl-s">If an exercise needs either, the tip shows under the exercise name in your logbook.</p>']
    ]],
    ['Sets & reps',[
      ['set','Sets and reps','<p>A <b>rep</b> is one full movement (one squat). A <b>set</b> is a group of reps done in a row before you rest. "3 × 10" means 3 sets of 10 reps.</p><p>A rep range like <b>8–12</b> means pick a weight you can do at least 8 times, and when you hit 12 on every set, go up in weight.</p>'],
      ['warmup','Warm-up set (W)','<p>A lighter set before your working sets to get your muscles, joints and nervous system ready and to practise the movement. It shouldn\'t tire you out: aim for about <b>RPE 6</b>. It doesn\'t count towards your progress.</p>'],
      ['working','Working set','<p>The sets that count. These are the hard ones, finishing at <b>0–3 RIR</b>. They\'re numbered 1, 2, 3 in your logbook and they\'re what the app uses to tell you when to go up in weight.</p>'],
      ['tempo','Tempo','<p>How fast you move the weight on each part of the rep, in seconds. It\'s written as 3 or 4 numbers, e.g. <b>3-1-1-0</b>:</p><ul><li><b>1st number</b>: lowering the weight (3 seconds down)</li><li><b>2nd</b>: pause at the bottom, in the stretch (1 second)</li><li><b>3rd</b>: lifting the weight (1 second up)</li><li><b>4th</b>: pause at the top (0 = go straight into the next rep)</li></ul><p>An <b>X</b> means lift it as fast as you can with control. A slow, controlled lowering keeps the tension on the muscle and helps it grow.</p>'],
      ['rest','Rest time','<p>How long you rest between sets. Bigger exercises (squats, presses, rows) usually need 2–3 minutes so you can perform well on the next set. Smaller ones (curls, raises) usually need 60–90 seconds. The logbook starts a rest timer each time you tick a set.</p>'],
      ['overload','Progressive overload','<p>Doing a little more over time: more weight, more reps, or better form at the same weight. It\'s the main thing that drives progress. When you hit the top of your rep range on every set, the logbook tells you to go up in weight.</p>'],
      ['unilateral','Unilateral / each leg / each arm','<p>Training one side at a time (e.g. Bulgarian split squats, single-arm rows). Log each side separately so you can see if one side is weaker. <b>Bilateral</b> means both sides together (e.g. squats, leg press).</p>']
    ]],
    ['Ways to make it harder',[
      ['pre','Pre-exhaust','<p>Doing an <b>isolation exercise</b> (one joint, one muscle) <b>before</b> a bigger compound exercise for the same muscle. E.g. leg extensions before squats, or cable flyes before chest press.</p><p>The target muscle is already tired going into the big lift, so it gets more of the work and you can get a great stimulus with less weight. Expect to use a bit less weight than normal on the exercise after it.</p>'],
      ['post','Post exhaust','<p>Extra intensity added <b>after</b> your last working set to push the muscle further once it\'s already tired. Drop sets, myo-reps, rest-pause, mechanical drop sets, partials, static holds and burnout sets are all post exhausts. Use them on the last set only, and mainly on machines and cables where it\'s safe to push hard.</p>'],
      ['drop','Drop set (D)','<p>Straight after your set, drop the weight by about 20% and go again to near failure with no rest. A <b>double drop set (DD)</b> does it twice in a row.</p>'],
      ['myo','Myo-reps (M)','<p>Same weight. After your set, rest for 3–5 deep breaths, do 3–5 more reps, and repeat that 3–5 times. A quick way to get lots of hard reps in.</p>'],
      ['restpause','Rest-pause (R)','<p>Same weight. After your set, rest 10–20 seconds, then squeeze out as many more reps as you can. Can be done once or twice.</p>'],
      ['mech','Mechanical drop set (X)','<p>Keep the same weight but switch to an easier version of the movement and keep going, e.g. incline press to flat press, or close-grip to normal grip.</p>'],
      ['partials','Lengthened partials (P)','<p>When you can\'t do full reps any more, keep doing half reps in the stretched (bottom) part of the movement. The stretched position is great for muscle growth.</p>'],
      ['hold','Static hold (H)','<p>Hold the hardest point of the rep (the squeeze or the stretch) for as long as you can at the end of your set.</p>'],
      ['burnout','Burnout set (B)','<p>A lighter weight for high reps, going until you can\'t do any more. Used as a finisher at the end of an exercise or session.</p>'],
      ['finisher','Finisher','<p>A last, high-effort exercise or set at the end of a session to fully exhaust a muscle. Marked with 🔥 in your logbook.</p>'],
      ['ss','Superset (SS)','<p>Two exercises done back to back with no rest in between, then you rest. They\'re shown with the same letter, e.g. <b>A1</b> and <b>A2</b>.</p>']
    ]],
    ['Exercises',[
      ['compound','Compound vs isolation','<p><b>Compound</b> exercises move more than one joint and train several muscles at once (squats, presses, rows). <b>Isolation</b> exercises move one joint and focus on one muscle (leg extensions, curls, lateral raises).</p>'],
      ['pattern','Movement pattern','<p>The type of movement an exercise is: e.g. squat, hinge, lunge, push, pull. When you swap an exercise, the app suggests ones with the <b>same movement pattern</b> first, because they\'re the closest like-for-like swap.</p>'],
      ['hinge','Hinge','<p>Bending at the hips with a flat back, pushing your hips back (RDLs, deadlifts, good mornings). Works the hamstrings and glutes.</p>']
    ]]
  ];
  var BY={};T.forEach(function(g){g[1].forEach(function(t){BY[t[0]]=t})});
  var css='.gl-c{max-height:86vh;overflow:auto}.gl-c h4{margin:10px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#c9a64b)}.gl-t{border:1px solid var(--line,#2a2a2a);border-radius:12px;padding:10px 12px;background:#0e0e0e}.gl-t.hit{border-color:var(--gold,#c9a64b);background:rgba(201,166,75,.08)}.gl-t summary{font-weight:700;color:#fff;cursor:pointer;list-style:none}.gl-t summary::-webkit-details-marker{display:none}.gl-t summary:after{content:"+";float:right;color:var(--gold,#c9a64b)}.gl-t[open] summary:after{content:"–"}.gl-t p,.gl-t li{font-size:14px;line-height:1.5;color:var(--soft,#ddd);margin:6px 0 0}.gl-t ul{margin:6px 0 0;padding-left:18px}.gl-t .gl-s{font-size:13px;color:var(--mute,#999)}.lb-sheet-c .gl-ok{text-align:center;background:var(--gold,#c9a64b);color:#000;border-color:var(--gold,#c9a64b);position:sticky;bottom:0}'+
    '.lb-i{width:18px;height:18px;border-radius:50%;border:1px solid var(--gold,#c9a64b);background:transparent;color:var(--gold,#c9a64b);font:italic 700 11px/1 Georgia,serif;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-left:4px;flex:none}'+
    '.lb-sheet-c button.lb-i{width:20px;height:20px;padding:0;border-radius:50%;background:transparent;border:1px solid var(--gold,#c9a64b);color:var(--gold,#c9a64b);text-align:center;font:italic 700 11px/1 Georgia,serif}'+
    '.gl-open{background:none;border:1px solid var(--line,#2a2a2a);color:var(--gold-l,#e8c872);font:inherit;font-size:13px;font-weight:600;padding:6px 12px;border-radius:20px;cursor:pointer}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  function card(t,hit){return '<details class="gl-t'+(hit?' hit':'')+'"'+(hit?' open':'')+'><summary>'+t[1]+'</summary>'+t[2]+'</details>'}
  function open(k){
    var old=document.querySelector('.lb-sheet');if(old)old.remove();
    var keys=String(k||'').split(',').filter(function(x){return BY[x]}),m=document.createElement('div');m.className='lb-sheet';
    var h='<div class="lb-sheet-c gl-c"><b>📖 Training terms explained</b><small>Tap any term to learn what it means.</small>';
    if(keys.length)h+=keys.map(function(x){return card(BY[x],true)}).join('');
    T.forEach(function(g){var its=g[1].filter(function(t){return keys.indexOf(t[0])<0});if(!its.length)return;h+='<h4>'+g[0]+'</h4>'+its.map(function(t){return card(t,false)}).join('')});
    h+='<button type="button" class="gl-ok" data-gx="1">Got it</button></div>';
    m.innerHTML=h;document.body.appendChild(m);document.body.style.overflow='hidden';
    var c=function(){m.remove();document.body.style.overflow=''};m.onclick=function(ev){if(ev.target===m||ev.target.closest('[data-gx]'))c()};
  }
  function btn(k,label){return '<button type="button" class="lb-i" data-gl="'+k+'" aria-label="'+(label||'What does this mean?')+'">i</button>'}
  // any element with data-gl opens the glossary at that term
  document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-gl]');if(!b)return;ev.preventDefault();ev.stopPropagation();open(b.getAttribute('data-gl'))},true);
  window.MPFGloss={open:open,btn:btn,has:function(k){return !!BY[k]}};
})();
