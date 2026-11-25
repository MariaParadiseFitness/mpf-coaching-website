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
    var k=function(s){return String(s).toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z0-9]/g,'')},seen={},out=[];
    seen[k(name)]=1;
    var add=function(n){var kk=k(n);if(seen[kk])return;if(sex==='m'&&QUAD[p.key]&&GLUTEY.test(n))return;var q=of(n);if(q&&q.key===p.key){seen[kk]=1;out.push(n)}};
    (mine||[]).forEach(add);
    Object.keys(lib||{}).forEach(function(g){(lib[g]||[]).forEach(add)});
    return {label:p.label,list:out.slice(0,max||30)};
  }
  window.MPFSWAP={of:of,suggest:suggest,bias:bias};
})();
