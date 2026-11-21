/* Maria's nutritional calculator (same maths as her "My Nutrition Calculator" sheet). */
(function(){
  var ACT={'Very sedentary':1.375,'Moderate exercise':1.5,'Active occupation':1.8,'Very active':2.2};
  function macros(kcal,protein,fatPct){var fat=kcal*fatPct/9;return {kcal:kcal,p:protein,f:fat,c:(kcal-protein*4-fat*9)/4}}
  function calc(o){
    var W=+o.weight,bf=+o.bf>1?+o.bf/100:+o.bf,mult=ACT[o.activity]||1.375;
    if(!(W>0)||!(bf>0&&bf<0.7))return null;
    var lbm=W*(1-bf),rmr=21.6*lbm+370,tdee=rmr*mult,P=2.2*lbm,out={lbm:lbm,fatMass:W*bf,rmr:rmr,tdee:tdee,days:[]};
    var weeklyDef=W*0.005*7700;
    if(o.goal==='cut'){out.days.push(Object.assign({name:'Every day'},macros(tdee-weeklyDef/7,P,0.30)));out.loss=W*0.005}
    else if(o.goal==='cut1'){var low=macros(tdee-weeklyDef/6,P,0.25);out.days.push(Object.assign({name:'6 low days'},low));var rf={name:'1 refeed day',kcal:tdee,p:P,f:low.f};rf.c=(tdee-P*4-low.f*9)/4;out.days.push(rf);out.loss=W*0.005}
    else if(o.goal==='cut2'){var low2=macros(tdee-weeklyDef/5,P,0.325);out.days.push(Object.assign({name:'5 low days'},low2));var rf2={name:'2 refeed days',kcal:tdee,p:P,f:low2.f};rf2.c=(tdee-P*4-low2.f*9)/4;out.days.push(rf2);out.loss=W*0.005}
    else if(o.goal==='gain'){var rate=(+o.rate||1.5)/100,lbs=W*rate*2.2;out.days.push(Object.assign({name:'Every day'},macros(tdee+3500*lbs/30,W*2.2,0.20)));out.gain=W*rate}
    else out.days.push(Object.assign({name:'Every day'},macros(tdee,P,0.30)));
    return out;
  }
  window.MPFCalc={calc:calc,activities:Object.keys(ACT)};
})();
