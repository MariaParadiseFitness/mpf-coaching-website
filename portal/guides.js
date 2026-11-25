/* MPF guides for everyone (not just the cycle ones). MPFGuides.open('alcohol') */
(function(){
  var G={
    alcohol:{i:'glass-full',t:'Alcohol, fat loss and training',b:[
      ['Let\'s be real','I\'m not here to tell you to never drink again. I like a night out as much as anyone. But if your progress has stalled and you\'re drinking most weekends (or most nights), this is probably the bit that\'s holding you back. So let\'s talk about it properly, no judgement.'],
      ['Why it slows fat loss','Alcohol has 7 calories per gram, nearly as much as fat. A pint is around 200 to 250 calories, a large glass of wine about 180 to 230, a cocktail can be 250 to 500. Five drinks on a Saturday can wipe out most of the deficit you built all week. On top of that, your body stops to burn off the alcohol first, so it pauses burning fat while it deals with it.'],
      ['The hidden damage','It\'s not just the drinks. It\'s the 2am chips, the hangover McDonald\'s, the sofa day where you do 2,000 steps, and the "fuck it, I\'ll start again Monday" that comes with it. Most of the damage happens the day after.'],
      ['What it does to your training','Alcohol wrecks your sleep, even if you pass out fast. Less deep sleep means less recovery, more hunger and lower energy. Heavy drinking also cuts how much muscle you build after training, so you work hard in the gym and get less back for it. And hungover sessions are always weaker. Your strength, your pump, your motivation: all down.'],
      ['How to drink and still get results','Plan it in. Put it in your log before you go, so it\'s a choice, not an accident. Keep your protein high that day and take the calories from carbs and fats. Pick lower calorie drinks: spirits with a diet mixer, light beer, or a spritzer. Have a glass of water between every drink. Eat a proper high protein meal before you go out. Decide your number before your first drink and stick to it.'],
      ['Log it honestly','Use the alcohol question in your daily log every day you drink, and put the real number in. I\'m not going to tell you off. I just can\'t help you with what I can\'t see, and seeing the pattern is half the battle.'],
      ['If it\'s more than a weekend thing','If you\'re drinking most days, need a drink to switch off, or find it hard to stop once you start, please be honest with me, and with yourself. That\'s nothing to be ashamed of and you\'re not on your own. The UK guideline is no more than 14 units a week, spread over 3 or more days. Your GP can help, and Drinkline is free and confidential on 0300 123 1110.']
    ]}
  };
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function open(k){var g=G[k];if(!g)return;var m=document.createElement('div');m.className='cy-modal';
    m.innerHTML='<div class="cy-sheet" role="dialog" aria-modal="true"><button type="button" class="cy-x" aria-label="Close">✕</button><div class="cy-gi"><i class="ti ti-'+g.i+'"></i></div><h3>'+esc(g.t)+'</h3>'+g.b.map(function(s){return '<h4>'+esc(s[0])+'</h4><p>'+esc(s[1])+'</p>'}).join('')+'<p class="cy-sig">Maria x</p><p class="cy-note">This guide is general information, not medical advice. If you\'re worried about your drinking, please speak to your GP.</p></div>';
    document.body.appendChild(m);document.body.style.overflow='hidden';var close=function(){m.remove();document.body.style.overflow=''};m.onclick=function(e){if(e.target===m||e.target.closest('.cy-x'))close()}}
  function list(){return Object.keys(G).map(function(k){return {k:k,t:G[k].t,i:G[k].i}})}
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-guide]');if(!a)return;e.preventDefault();open(a.getAttribute('data-guide'))});
  window.MPFGuides={open:open,list:list};
})();
