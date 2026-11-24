/* MPF icons: swaps a leading emoji on labels, buttons, pills and headings for a gold Tabler line icon,
   so the client app and the coach portal share one icon style. Emojis inside sentences and messages stay. */
(function(){
  var M={
    '✅':'circle-check','✔':'check','👥':'users','💬':'message-circle','📋':'clipboard-list','🥗':'salad','📣':'speakerphone',
    '💷':'currency-pound','👁':'eye','👀':'eye','⚙':'settings','🔍':'search','☰':'list','▦':'layout-grid','📁':'folder',
    '🗂':'folders','✨':'sparkles','📐':'ruler-2','🛑':'hand-stop','💳':'credit-card','📅':'calendar','🗓':'calendar',
    '💤':'zzz','😴':'zzz','📸':'camera','📷':'camera','🙋':'user','👤':'user','🍽':'tools-kitchen-2','🔒':'lock',
    '🔓':'lock-open','🎂':'cake','📦':'package','📝':'pencil','✏':'pencil','🛠':'tool','🏋':'barbell','💪':'barbell',
    '🔁':'refresh','🔄':'refresh','🎉':'confetti','🙌':'confetti','🔴':'alert-circle','🟠':'clock','🟡':'clock-hour-4',
    '⚪':'circle','🌙':'moon','🎵':'brand-tiktok','🎬':'movie','🎥':'video','🌐':'world','💡':'bulb','🏆':'trophy',
    '🎨':'palette','📍':'map-pin','⏰':'alarm','📩':'mail','✉':'mail','💌':'mail-heart','💻':'device-laptop',
    '⚠':'alert-triangle','🎤':'microphone','✍':'writing','🤖':'robot','📊':'chart-bar','📈':'trending-up','👏':'thumb-up',
    '👌':'thumb-up','🍗':'meat','👟':'shoe','🚶':'walk','🏃':'run','🧘':'yoga','⚖':'scale','💛':'heart','🖤':'heart',
    '📞':'phone','🚫':'ban','🧮':'calculator','🎯':'target','🔼':'arrow-up','🔽':'arrow-down','📲':'device-mobile',
    '📱':'device-mobile','🛒':'shopping-cart','🩺':'stethoscope','🕘':'clock','💊':'pill','🔥':'flame','🗑':'trash',
    '💾':'device-floppy','😊':'mood-smile','🍎':'apple','🌱':'plant','💧':'droplet','📏':'ruler','🧾':'receipt'
  };
  var TONE={'🔴':'ico-red','🛑':'ico-red','🚫':'ico-red','⚠':'ico-amb','🟠':'ico-amb','⏰':'ico-amb'};
  var SKIP='textarea,input,select,script,style,code,pre,[contenteditable],.tagpick,#bankTabs,#ideas,#cePl,.noico,.cy-gbody,.cy-sheet p';
  var keys=Object.keys(M).sort(function(a,b){return b.length-a.length});
  var re=new RegExp('^(\\s*)('+keys.map(function(k){return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}).join('|')+')\\uFE0F?(\\s*)');
  function lead(n){for(var s=n.previousSibling;s;s=s.previousSibling){if(s.nodeType===3&&!/\S/.test(s.nodeValue))continue;if(s.nodeType===1&&s.classList&&s.classList.contains('ti'))return false;return false}return true}
  function fix(n){
    if(n.nodeType!==3||!n.parentNode||n.parentNode.nodeType!==1)return;
    var m=re.exec(n.nodeValue);if(!m||!lead(n))return;
    var p=n.parentNode;if(p.closest&&p.closest(SKIP))return;
    var i=document.createElement('i');i.className='ti ti-'+M[m[2]]+' emo'+(TONE[m[2]]?' '+TONE[m[2]]:'');i.setAttribute('aria-hidden','true');
    var rest=n.nodeValue.slice(m[0].length);
    n.nodeValue=(rest?' ':'')+rest;p.insertBefore(i,n);
    if(!rest)p.classList.add('ico-only');
  }
  function walk(root){
    if(root.nodeType===3){fix(root);return}
    if(root.nodeType!==1||(root.closest&&root.closest(SKIP)))return;
    var w=document.createTreeWalker(root,4,null),a=[],t;while((t=w.nextNode()))a.push(t);a.forEach(fix);
    if(root.querySelectorAll)[].forEach.call(root.querySelectorAll('input[placeholder]'),function(el){var m=re.exec(el.placeholder);if(m)el.placeholder=el.placeholder.slice(m[0].length)});
  }
  function start(){
    walk(document.body);
    new MutationObserver(function(ms){ms.forEach(function(m){
      if(m.type==='characterData')fix(m.target);
      else [].forEach.call(m.addedNodes,walk);
    })}).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
