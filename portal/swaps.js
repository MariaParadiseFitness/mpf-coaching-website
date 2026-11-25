/* MPF swap suggestions: works out an exercise's movement pattern so the swap picker can suggest
   like-for-like swaps first (e.g. lower body unilateral push -> another lower body unilateral push).
   Suggestions only: clients can still pick any exercise. */
(function(){
  // Checked in order: the first match wins, so the more specific patterns come first.
  var P=[
    ['none',null,/upright row|rowing machine|rower|wrist curl|farmer|carry\b|stretch|foam roll/],
    ['calfs','Seated calf raise (bent knee)',/seated calf|calf.*seated/],
    ['calf','Calf raise (straight leg)',/calf|calves|donkey raise/],
    ['lunge','Lower body unilateral push (lunges, split squats, step-ups)',/bulgarian|split[- ]?squat|lunge|step[- ]?up|pistol|skater squat|cossack|curtsy|(single|one|1)[- ]?leg(ged)? (leg )?(press|squat)|single[- ]?leg hack/],
    ['uhinge','Lower body unilateral hinge (single-leg RDLs)',/(single|one|1)[- ]?leg(ged)?.*(rdl|romanian|deadlift)|b[- ]?stance|kickstand|staggered[- ]?stance/],
    ['thrust','Hip thrust / glute bridge',/hip thrust|glute bridge|bridge|glute drive|frog pump/],
    ['kneeflex','Leg curl (knee flexion)',/leg curl|hamstring curl|nordic|glute[- ]?ham(string)? raise|ghr\b/],
    ['kneeext','Leg extension (knee extension)',/leg extension|quad extension|sissy/],
    ['abd','Hip abduction (outer glutes)',/abduct|clam ?shell|fire hydrant|band walk|monster walk|crab walk/],
    ['add','Hip adduction (inner thighs)',/adduct|copenhagen/],
    ['tkick','Triceps kickback',/tricep.*kick|kick.*tricep|dumbbell kickback/],
    ['gkick','Glute kickback (hip extension isolation)',/kickback|kick back|donkey kick|glute (machine|extension)|hip extension machine|standing glute|multi[- ]?hip extension/],
    ['hinge','Lower body bilateral hinge (RDLs, deadlifts)',/romanian|rdl|rack pull|stiff[- ]?leg|deadlift|good ?morning|pull[- ]?through|back extension|hyperextension|reverse hyper/],
    ['squat','Lower body bilateral squat (squats, leg press)',/squat|leg press|hack|pendulum|wall sit/],
    ['rear','Rear delt (reverse fly, face pull)',/rear delt|reverse (pec|fly|flye|butterfly)|face ?pull|rear lateral|pull apart|bent[- ]?over (lateral|raise|fly|flye)/],
    ['straight','Straight-arm pulldown / pullover',/straight[- ]?arm|pullover/],
    ['vpull','Vertical pull (pulldowns, pull-ups)',/pull ?down|pull[- ]?up|pullup|chin[- ]?up|chinup|\bchins?\b/],
    ['hpull','Horizontal pull (rows)',/row|t[- ]?bar|meadows|seal row/],
    ['lat','Lateral raise (side delts)',/lateral raise|side raise|side lateral|lateral delt|y[- ]?raise|lu raise/],
    ['front','Front raise',/front raise/],
    ['fly','Chest fly',/fly|flye|pec deck|butterfly|cross ?over|iron cross|svend|squeeze press/],
    ['vpush','Vertical push (shoulder press)',/shoulder press|overhead press|military|arnold|push press|\bohp\b|seated (dumbbell |barbell )?press$/],
    ['dip','Dips',/\bdips?\b/],
    ['incline','Incline press',/incline/],
    ['decline','Decline press',/decline/],
    ['hpush','Horizontal push (flat press, push-ups)',/bench|chest press|push[- ]?ups?\b|pushups?\b|floor press|machine press|iso[- ]?lateral (chest|press)/],
    ['ohtri','Overhead triceps extension',/overhead.*(extension|tricep)|french press/],
    ['lytri','Lying triceps extension (skull crushers)',/skull|lying tricep|lying.*extension|jm press|tate press/],
    ['pushdown','Triceps pushdown',/push ?down|press ?down/],
    ['curl','Biceps curl',/curl/],
    ['shrug','Shrug',/shrug/],
    ['corerot','Core: rotation & side core',/side plank|pallof|wood ?chop|russian twist|rotation|twist|oblique|side bend/],
    ['coreext','Core: anti-extension (planks, rollouts)',/plank|ab wheel|ab roller|roll ?out|dead ?bug|body ?saw|stir the pot|hollow/],
    ['coreflex','Core: flexion (crunches, leg raises)',/crunch|sit[- ]?up|leg raise|knee raise|toes to bar|v[- ]?up|ab machine|ab crunch|hanging/]
  ];
  function of(name){
    var n=String(name||'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim();
    if(!n)return null;
    for(var i=0;i<P.length;i++){if(P[i][2].test(n))return P[i][0]==='none'?null:{key:P[i][0],label:P[i][1]}}
    return null;
  }
  // like-for-like swaps for `name`, from the client's own exercises first, then the library
  // men: lower body push movements should bias the quads, not the glutes
  var GLUTEY=/glute|long[- ]?stride|curtsy|sumo|wide[- ]?stance|frog|kas\b/i;
  var QUAD={
    lunge:'🦵 Quad focus: keep your torso tall and upright, use a shorter stance and let your front knee travel forward over your toes. Drive through your whole front foot. You should feel it mostly in the front of your thigh, not your glutes.',
    squat:'🦵 Quad focus: stay upright, keep your feet about hip-width and let your knees travel forward over your toes with your heels down. On the leg press or hack squat, place your feet lower and closer together. You should feel it mostly in the front of your thighs, not your glutes.'};
  function bias(name,sex){if(sex!=='m')return '';var p=of(name);return p&&QUAD[p.key]?QUAD[p.key]:''}
  function suggest(name,mine,lib,max,sex){
    var p=of(name);if(!p)return {label:'',list:[]};
    var k=function(s){return String(s).toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z0-9]/g,'').replace(/s$/,'')},seen={},out=[];
    seen[k(name)]=1;
    var add=function(n){var kk=k(n);if(seen[kk])return;if(sex==='m'&&QUAD[p.key]&&GLUTEY.test(n))return;var q=of(n);if(q&&q.key===p.key){seen[kk]=1;out.push(n)}};
    (mine||[]).forEach(add);
    Object.keys(lib||{}).forEach(function(g){(lib[g]||[]).forEach(add)});
    return {label:p.label,list:out.slice(0,max||30)};
  }
  // pre-exhaust: isolation exercises for the same muscle, done before a compound
  var PRE={squat:['kneeext'],lunge:['kneeext'],hinge:['kneeflex'],uhinge:['kneeflex'],thrust:['gkick','abd'],hpush:['fly'],incline:['fly'],decline:['fly'],dip:['fly'],vpush:['lat'],vpull:['straight'],hpull:['straight','rear']};
  function pre(name,lib,max,picks){var p=of(name);if(!p||!PRE[p.key])return [];var out=[],seen={},src=[].concat.apply([],Object.keys(picks||{}).map(function(g){return picks[g]})).concat([].concat.apply([],Object.keys(lib||{}).map(function(g){return lib[g]})));PRE[p.key].forEach(function(key){var n=0;[src].forEach(function(arr){arr.forEach(function(x){var q=of(x),kk=x.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/s$/,'');if(n<(max||6)&&q&&q.key===key&&!seen[kk]){seen[kk]=1;n++;out.push(x)}})})});return out}
  // bracing cue for every exercise, by movement pattern
  var FULL='Before each rep: big breath into your belly, then brace like someone is about to punch you in the stomach. ';
  var BR={
    squat:FULL+'Hold it all the way down and back up. Breathe out at the top, then re-brace before the next rep.',
    lunge:FULL+'Keep your ribs stacked over your hips and hold it through the whole rep. Breathe out at the top.',
    hinge:FULL+'Brace before you start to hinge, keep your back flat and hold it as you lower and stand up. Breathe out at the top, re-brace every rep.',
    uhinge:FULL+'Keep your hips square and your back flat as you lower. Hold the brace until you are standing tall again.',
    thrust:'Brace before you push: ribs down, chin tucked, abs tight. Lift with your hips, not by arching your lower back. Breathe out at the top squeeze.',
    hpush:'Before you lower the weight: feet planted, shoulder blades back and down, breathe in and brace. Hold it through the press, breathe out at the top.',
    incline:'Before you lower the weight: feet planted, shoulder blades back and down, breathe in and brace. Hold it through the press, breathe out at the top.',
    decline:'Before you lower the weight: shoulder blades back and down, breathe in and brace. Hold it through the press, breathe out at the top.',
    dip:'Brace your abs and keep your ribs down so you don\'t swing. Breathe in on the way down, out as you push up.',
    vpush:'Before you press: squeeze your glutes, brace your abs and pull your ribs down so your lower back doesn\'t arch. Breathe out at the top.',
    hpull:'Brace before each rep so your body stays still and your back does the pulling, not momentum. On bent-over rows, brace hard to protect your lower back.',
    vpull:'Ribs down and abs braced before you pull, so you don\'t lean back or swing. Breathe out as you pull down or up.',
    straight:'Ribs down and abs tight the whole time so your lower back doesn\'t arch as you pull.',
    kneeflex:'Light brace: hold the handles and keep your hips pinned to the pad. Breathe out as you curl.',
    kneeext:'Light brace: hold the handles, sit back into the seat and keep your hips down. Breathe out as you lift.',
    abd:'Light brace: sit tall, ribs down, no rocking. Breathe out as you push out.',
    add:'Light brace: sit tall, ribs down, no rocking. Breathe out as you squeeze in.',
    gkick:'Brace your abs so your lower back stays still. Only your leg moves, your back doesn\'t arch.',
    calf:'Light brace and stand tall so you don\'t bounce or lean. Breathe out as you rise.',
    calfs:'Light brace, sit tall and keep it controlled.',
    lat:'Light brace: stand tall, ribs down, no swinging or leaning back to lift the weight.',
    front:'Light brace: stand tall, ribs down, no leaning back to lift the weight.',
    rear:'Light brace: keep your body still so your rear delts do the work, not a swing.',
    fly:'Light brace: chest up, ribs down, keep your back still. Breathe in as you open, out as you squeeze.',
    curl:'Brace your abs and squeeze your glutes so you don\'t swing. Only your elbows move.',
    ohtri:'Brace hard and keep your ribs down so your lower back doesn\'t arch as your arms go overhead.',
    lytri:'Light brace, keep your back flat on the bench. Only your elbows move.',
    pushdown:'Light brace: stand tall, ribs down, no leaning over the weight. Only your elbows move.',
    tkick:'Brace your abs to keep your back flat and still. Only your elbow moves.',
    shrug:'Stand tall and brace so you lift straight up with no rocking.',
    coreext:'The brace IS the exercise: ribs down, belly tight, glutes squeezed. Keep breathing in small breaths, don\'t hold your breath.',
    coreflex:'Breathe out hard as you crunch and pull your ribs towards your hips. Keep your lower back controlled.',
    corerot:'Brace your whole middle and keep your hips still. Breathe out as you twist or resist.'
  };
  function brace(name){var p=of(name);return p&&BR[p.key]?BR[p.key]:'Breathe in and brace your abs before each rep, keep your ribs down, and breathe out as you finish the rep.'}
  // when to use lifting straps / wrist wraps, by movement pattern (only where it matters)
  var PULL='Use them on your heavier working sets if your grip gives out before ';
  var NOWU=' Skip them on warm-ups and lighter sets so your grip still gets stronger.';
  var WR={
    hinge:'Straps: '+PULL+'your hamstrings and glutes do.'+NOWU,
    uhinge:'Straps: '+PULL+'your hamstrings and glutes do.'+NOWU,
    hpull:'Straps: '+PULL+'your back does, so your back gets the work, not your forearms.'+NOWU,
    vpull:'Straps: '+PULL+'your lats do.'+NOWU+' Not needed on assisted or bodyweight pull-ups for most people.',
    straight:'Straps: optional if your grip slips before your lats tire. Not needed for most people.',
    shrug:'Straps: yes on heavy sets, your grip will fail way before your traps do.'+NOWU,
    lunge:'Straps: only if you\'re holding heavy dumbbells and your grip goes before your legs do. Not needed with a barbell or on machines.',
    hpush:'Wrist wraps: optional on your heaviest pressing sets if your wrists bend back or ache. Not needed on warm-ups or machines. Keep your wrists stacked over your elbows either way.',
    incline:'Wrist wraps: optional on your heaviest pressing sets if your wrists bend back or ache. Not needed on warm-ups or machines. Keep your wrists stacked over your elbows either way.',
    decline:'Wrist wraps: optional on your heaviest pressing sets if your wrists bend back or ache. Not needed on warm-ups or machines.',
    vpush:'Wrist wraps: optional on heavy barbell or dumbbell pressing if your wrists bend back or ache. Not needed on warm-ups or machines.',
    dip:'Wrist wraps: optional on weighted dips if your wrists ache. Not needed for bodyweight dips.',
    curl:'No straps or wraps: your grip and forearms are part of the exercise.',
    lat:'No straps or wraps needed. If you\'re gripping the weight hard, it\'s probably too heavy.',
    front:'No straps or wraps needed.',
    rear:'No straps or wraps needed.'
  };
  function wraps(name){var p=of(name);return p&&WR[p.key]?WR[p.key]:''}
  // grip: where a loose, thumbless "hook" grip keeps the work on the target muscle
  var HOOK='Hands are just hooks. Try a thumbless grip (thumb on the same side as your fingers) and hold the handle loosely. ';
  var GR={
    vpull:HOOK+'Drive your elbows down to your sides. Squeezing hard just pumps your forearms and takes the work off your lats.',
    hpull:HOOK+'Pull with your elbows, not your hands. A death grip makes your forearms and biceps take over from your back.',
    straight:HOOK+'Push down through your palms. If your forearms are burning, you\'re gripping too hard.',
    rear:'Loose grip, or open hands on the pec deck handles. Lead with your elbows so your rear delts do the work, not your forearms.',
    lat:'Loose grip, think of your hands as hooks and lead with your elbows. Gripping hard makes your traps and forearms take over.',
    fly:'Loose grip, or open palms on the pec deck pads. Squeeze your chest, not the handles.',
    kneeext:'Hold the side handles just enough to keep your hips down. No white knuckles, the work is in your quads.',
    kneeflex:'Hold the handles just enough to keep your hips down. No white knuckles, the work is in your hamstrings.',
    pushdown:'Relaxed grip and push through your palms. A death grip pumps your forearms before your triceps are done.'
  };
  function grip(name){var p=of(name);return p&&GR[p.key]?GR[p.key]:''}
  window.MPFSWAP={of:of,suggest:suggest,bias:bias,pre:pre,brace:brace,wraps:wraps,grip:grip};
})();
