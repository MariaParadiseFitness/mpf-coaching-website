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
    kis:['Natural yogurt (kiselo mlyako)','g',100,57,3.5,4.5,2,0,250,50,150,'dairy'],
    lamb:['Lean lamb leg steak (raw)','g',100,150,21,0,7,100,200,25,125,'meat'],
    mack:['Mackerel fillet','g',100,205,19,0,14,50,150,10,80,'fish'],
    noodle:['Egg noodles (dry)','g',100,360,13,68,3,30,110,10,60,'gluten egg'],
    rnood:['Rice noodles (dry)','g',100,360,6,80,0.6,30,110,10,60,''],
    soba:['Soba or udon noodles (dry)','g',100,340,13,68,1.5,30,110,10,60,'gluten'],
    tort:['Corn or wheat tortillas','tortilla',1,95,2.5,17,1.8,1,4,1,2,'gluten'],
    bbeans:['Black beans (drained)','g',100,110,7,16,0.5,60,240,20,100,''],
    corn:['Sweetcorn','g',100,80,3,15,1.2,0,100,25,50,''],
    salsa:['Salsa','g',100,35,1.2,7,0.2,0,80,20,40,''],
    plant:['Plantain (raw)','g',100,122,1.3,32,0.4,0,250,25,100,''],
    yam:['Yam (raw)','g',100,118,1.5,28,0.2,0,300,25,150,''],
    edam:['Edamame beans','g',100,125,11,7,5,0,150,25,75,''],
    hummus:['Reduced-fat hummus','g',100,250,7,15,17,0,60,10,30,''],
    halloumi:['Light halloumi','g',100,240,24,1.5,15,0,100,10,50,'dairy'],
    mozz:['Light mozzarella','g',100,165,19,1,9.5,0,100,10,60,'dairy'],
    parm:['Parmesan','g',100,400,36,0,28,0,20,5,10,'dairy'],
    cott:['Low-fat cottage cheese','g',100,75,12,3.5,1.5,0,300,25,150,'dairy'],
    rye:['Rye bread','g',100,220,7,42,1.5,30,120,10,60,'gluten'],
    kimchi:['Kimchi','g',100,25,1.5,4,0.5,0,100,25,50,''],
    nori:['Cucumber, carrot and nori','g',100,25,1,5,0.2,60,60,1,60,''],
    stirveg:['Stir-fry veg (peppers, pak choi, beansprouts)','g',100,30,1.5,5,0.3,150,150,1,150,''],
    callaloo:['Callaloo or spinach','g',100,25,2.5,3,0.4,100,100,1,100,''],
    coconut:['Light coconut milk','ml',100,75,0.6,1.5,7,0,100,25,50,''],
    sesoil:['Sesame or vegetable oil','ml',100,820,0,0,92,0,15,5,5,'']
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
        {n:'{p} curry with dal and sabzi',pick:0,note:'Cook with cumin, turmeric, garam masala and chilli. If you use soya chunks, soak them in hot water first.',s:[['chicken','turkey','cod','paneer','soya','tofu'],['dal'],['veg'],['ghee','oil'],['chap','rice']]}]},
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
    chinese:{
      breakfast:[
        {n:'{p} congee (rice porridge)',pick:0,note:'Simmer rice in stock with ginger, top with spring onion and a dash of soy sauce.',s:[['chicken','prawns','tofu','egg'],['rice'],['ew','tofu'],['sesoil']]},
        {n:'Steamed egg with spring onion and rice',s:[['egg','tofu'],['ew','tofu'],['rice'],['stirveg']]}],
      lunch:[
        {n:'{p} and veg stir-fry with rice',pick:0,note:'Stir-fry with garlic, ginger, soy sauce and a little oyster or hoisin sauce.',s:[['chicken','prawns','beef','pork','tofu'],['rice','rnood'],['stirveg'],['sesoil']]}],
      dinner:[
        {n:'{p} chow mein',pick:0,note:'Toss with soy sauce, garlic, ginger and spring onion.',s:[['chicken','prawns','beef','tofu'],['noodle','rnood'],['stirveg'],['sesoil']]},
        {n:'Steamed {p} with ginger, rice and greens',pick:0,s:[['cod','salmon','chicken','tofu'],['rice'],['stirveg'],['sesoil']]}]},
    thai:{
      breakfast:[
        {n:'Thai omelette (kai jeow) with rice',s:[['egg','tofu'],['ew','tofu'],['rice'],['cuc']]},
        {n:'Coconut overnight oats with mango and lime',s:[['yog','syog'],['oats'],['whey','vprot'],['coconut'],['banana']]}],
      lunch:[
        {n:'{p} pad krapow with rice',pick:0,note:'Stir-fry with garlic, chilli, basil, soy and a splash of fish sauce.',s:[['chicken','turkey','prawns','tofu'],['rice'],['stirveg'],['sesoil']]}],
      dinner:[
        {n:'{p} green curry with rice',pick:0,note:'Green curry paste, light coconut milk and lots of veg.',s:[['chicken','prawns','tofu','cod'],['rice','rnood'],['coconut'],['stirveg']]},
        {n:'{p} pad thai',pick:0,note:'Rice noodles with tamarind, lime, chilli and beansprouts.',s:[['prawns','chicken','tofu'],['rnood'],['egg','ew'],['stirveg'],['pb','sesoil']]}]},
    japanese:{
      breakfast:[
        {n:'Japanese breakfast: rice, egg and miso',s:[['egg','tofu'],['ew','tofu'],['rice'],['cuc']]},
        {n:'Yogurt with banana and oats',s:[['yog','skyr','syog'],['oats'],['banana']]}],
      lunch:[
        {n:'{p} poke or sushi bowl',pick:0,note:'Rice with soy, rice vinegar, cucumber, carrot and nori.',s:[['salmon','tuna','prawns','tofu'],['rice'],['nori'],['edam','avo']]}],
      dinner:[
        {n:'{p} teriyaki with rice and greens',pick:0,s:[['chicken','salmon','beef','tofu'],['rice'],['stirveg'],['sesoil']]},
        {n:'{p} udon noodle soup',pick:0,note:'Dashi or miso broth with greens and spring onion.',s:[['chicken','prawns','tofu','beef'],['soba'],['stirveg'],['egg','edam']]}]},
    korean:{
      breakfast:[
        {n:'Gyeran-bap (egg rice) with kimchi',s:[['egg','tofu'],['ew','tofu'],['rice'],['kimchi'],['sesoil']]},
        {n:'Yogurt with oats and berries',s:[['yog','skyr','syog'],['oats'],['berries']]}],
      lunch:[
        {n:'{p} bibimbap',pick:0,note:'Rice topped with veg, a fried egg and gochujang.',s:[['beef','chicken','tofu'],['rice'],['stirveg'],['egg','edam'],['sesoil']]}],
      dinner:[
        {n:'Bulgogi {p} with rice and kimchi',pick:0,note:'Marinate in soy, garlic, pear, sesame and a little sugar.',s:[['beef','chicken','pork','tofu'],['rice'],['kimchi'],['stirveg'],['sesoil']]}]},
    mexican:{
      breakfast:[
        {n:'Huevos rancheros',s:[['egg','tofu'],['ew','tofu'],['tort'],['bbeans'],['salsa']]},
        {n:'Breakfast burrito',s:[['egg','tofu'],['ew','tofu'],['wrap'],['bbeans','salsa'],['avo']]}],
      lunch:[
        {n:'{p} burrito bowl',pick:0,note:'Rice with black beans, corn, salsa, lime and coriander.',s:[['chicken','beef','turkey','prawns','tofu'],['rice'],['bbeans'],['corn','salsa'],['avo']]}],
      dinner:[
        {n:'{p} fajitas',pick:0,note:'Peppers and onions with fajita spice, lime and salsa.',s:[['chicken','beef','prawns','tofu'],['tort'],['stirveg'],['salsa'],['yog','syog'],['avo']]},
        {n:'{p} tacos with slaw',pick:0,s:[['cod','prawns','chicken','turkey','bbeans'],['tort'],['salad'],['salsa'],['avo']]}]},
    caribbean:{
      breakfast:[
        {n:'{p} with callaloo and fried plantain',pick:0,s:[['cod','egg','tofu'],['callaloo'],['plant'],['oil']]},
        {n:'Cornmeal-style porridge with banana',note:'Spiced with cinnamon and nutmeg.',s:[['oats'],['milk','oatm'],['whey','vprot'],['banana']]}],
      lunch:[
        {n:'Jerk {p} with rice and peas',pick:0,note:'Jerk marinade, then grill. Rice cooked with kidney beans and a splash of coconut milk.',s:[['chicken','turkey','cod','tofu'],['rice'],['beans'],['salad'],['coconut']]}],
      dinner:[
        {n:'Curry {p} with rice and plantain',pick:0,note:'Caribbean curry powder, thyme, scotch bonnet and garlic.',s:[['chicken','lamb','tofu','chick'],['rice'],['plant'],['veg'],['oil']]},
        {n:'Brown stew {p} with yam and veg',pick:0,s:[['chicken','cod','tofu'],['yam','pot'],['veg'],['oil']]}]},
    westafrican:{
      breakfast:[
        {n:'Akara-style {p} with bread and tomato stew',pick:0,s:[['egg','tofu','beans'],['ew','tofu'],['bread'],['onion'],['oil']]},
        {n:'Oat porridge with banana and peanut butter',s:[['oats'],['milk','oatm'],['whey','vprot'],['banana'],['pb']]}],
      lunch:[
        {n:'Jollof rice with {p}',pick:0,note:'Cook the rice in a pepper, tomato and onion base with thyme and curry powder.',s:[['chicken','turkey','cod','tofu','beans'],['rice'],['onion'],['salad'],['oil']]}],
      dinner:[
        {n:'Pepper soup or stew with {p} and yam',pick:0,s:[['chicken','cod','mack','tofu'],['yam','plant','pot'],['callaloo'],['oil']]},
        {n:'{p} suya with plantain and salad',pick:0,note:'Coat in suya spice (ground peanut, ginger, chilli) and grill.',s:[['beef','chicken','tofu'],['plant'],['salad'],['pb','oil']]}]},
    middleeastern:{
      breakfast:[
        {n:'Shakshuka with pitta',s:[['egg','tofu'],['ew','tofu'],['onion'],['pitta'],['oil']]},
        {n:'Labneh-style yogurt with oats, fruit and honey',s:[['yog','skyr','syog'],['oats'],['berries'],['honey']]}],
      lunch:[
        {n:'{p} shawarma wrap with hummus',pick:0,note:'Spiced with cumin, paprika, garlic and lemon.',s:[['chicken','lamb','turkey','tofu','chick'],['wrap','pitta'],['salad'],['hummus']]}],
      dinner:[
        {n:'{p} kofta with rice and tabbouleh',pick:0,s:[['lamb','beef','chicken','turkey','soya'],['rice','bulgur','cous'],['salad'],['yog','syog'],['oil']]},
        {n:'Grilled {p} with fattoush and halloumi',pick:0,s:[['chicken','cod','prawns','tofu','chick'],['pitta','pot'],['salad'],['halloumi','hummus'],['oil']]}]},
    italian:{
      breakfast:[
        {n:'Frittata with toast',s:[['egg','tofu'],['ew','tofu'],['veg'],['sour'],['parm','oil']]},
        {n:'Ricotta-style yogurt with fruit and oats',s:[['skyr','yog','syog'],['oats'],['berries'],['honey']]}],
      lunch:[
        {n:'{p} pasta salad',pick:0,s:[['chicken','tuna','prawns','chick','tofu'],['pasta'],['salad'],['mozz','oil']]}],
      dinner:[
        {n:'{p} pasta in tomato and basil sauce',pick:0,note:'Garlic, chopped tomatoes, basil and a little parmesan.',s:[['beef','turkey','chicken','prawns','beans','tofu'],['pasta'],['veg'],['parm','oil']]},
        {n:'{p} with roasted Mediterranean veg and potatoes',pick:0,s:[['cod','salmon','chicken','tofu'],['pot'],['veg'],['oil']]}]},
    easterneuropean:{
      breakfast:[
        {n:'Scrambled eggs on rye with cottage cheese',s:[['egg','tofu'],['ew','tofu'],['rye'],['cott']]},
        {n:'Cottage cheese with fruit and oats',s:[['cott','skyr','syog'],['oats'],['berries'],['honey']]}],
      lunch:[
        {n:'{p} on rye with salad',pick:0,s:[['turkey','chicken','mack','tuna','egg','tofu'],['rye'],['salad'],['cott','avo']]}],
      dinner:[
        {n:'{p} goulash with potatoes',pick:0,note:'Paprika, onion, peppers and tomato.',s:[['beef','pork','chicken','turkey','beans','tofu'],['pot'],['veg'],['yog','syog'],['oil']]},
        {n:'{p} with buckwheat or rice and beetroot salad',pick:0,s:[['chicken','pork','cod','tofu'],['rice'],['salad'],['oil']]}]},
    snack:[
      {n:'Yogurt and berries',s:[['yog','skyr','syog'],['berries']]},
      {n:'Protein yogurt pot with a scoop of protein',s:[['skyr','yog','syog'],['whey','vprot'],['berries']]},
      {n:'Protein shake and a banana',s:[['whey','vprot'],['milk','oatm'],['banana']]},
      {n:'Rice cakes with peanut butter',s:[['ricecake'],['pb']]},
      {n:'Apple and peanut butter',s:[['apple'],['pb']]},
      {n:'Roasted chana',s:[['chana']]}]
  };
  var CUISINES=[['standard','Everyday British'],['indian','Indian'],['chinese','Chinese'],['thai','Thai'],['japanese','Japanese'],['korean','Korean'],['mexican','Mexican'],['caribbean','Caribbean'],['westafrican','West African'],['middleeastern','Middle Eastern'],['mediterranean','Mediterranean'],['italian','Italian'],['turkish','Turkish'],['bulgarian','Bulgarian'],['easterneuropean','Eastern European']];
  var DIETS={all:'',nobp:'beef pork',pesc:'meat',veg:'meat fish',vegan:'meat fish dairy egg honey'};
  function blocked(k,ban,dislike){var f=F[k],t=' '+f[11]+' ';if(ban.some(function(b){return t.indexOf(' '+b+' ')>=0}))return true;
    var n=f[0].toLowerCase();return dislike.some(function(w){return w&&n.indexOf(w)>=0})}
  function rnd(a){return a[Math.floor(Math.random()*a.length)]}
  var EGGN=/\begg|eggs\b|omelette|frittata|huevos|shakshuka|menemen|gyeran|kai jeow/i,DAIRYN=/cottage cheese|halloumi|feta|white cheese|sirene/i;
  var PN={egg:'egg',prawns:'prawn',chick:'chickpea',beans:'bean',bbeans:'black bean',soya:'soya chunk',ew:'egg white'};
  function pname(k){if(PN[k])return PN[k];return F[k][0].replace(/ \(.*\)/,'').replace(/^\d+% /,'').replace(/^(Firm|Cooked|Light|Lean|Mixed|Medium|Reduced-fat|Low-fat) /i,'').replace(/ (fillet|breast|mince|loin steak, fat trimmed|leg steak|in spring water)$/i,'').replace(/^(\w)/,function(c){return c.toLowerCase()})}
  function build(meal,ban,dislike,force){ // -> {name,note,items:[keys],alts:[[keys]],tpl} or null if a must-have slot has nothing allowed
    var items=[],alts=[],prot='',tn=meal.n.replace('{p}','');
    if(ban.indexOf('egg')>-1&&EGGN.test(tn))return null;
    if(ban.indexOf('dairy')>-1&&DAIRYN.test(tn))return null;
    for(var i=0;i<meal.s.length;i++){var ok=meal.s[i].filter(function(k){return !blocked(k,ban,dislike)});
      if(!ok.length){if(i===0)return null;continue}
      var k=force&&force[i]&&ok.indexOf(force[i])>-1?force[i]:meal.pick===i?rnd(ok):ok[0];if(items.indexOf(k)>=0)continue;items.push(k);alts.push(ok.filter(function(x){return x===k||items.indexOf(x)<0}));if(meal.pick===i)prot=pname(k)}
    return {name:meal.n.replace('{p}',prot||'').replace(/^ +/,'').replace(/^./,function(c){return c.toUpperCase()}),note:meal.note||'',items:items,alts:alts,tpl:meal}}
  function rename(b){var m=b.tpl;if(m.pick==null)return b.name;var k=b.items[0];return m.n.replace('{p}',pname(k)).replace(/^./,function(c){return c.toUpperCase()})}

  // cooking steps built from what is in the meal, so every meal gets instructions
  var COOK={
    chicken:'Season the chicken and grill, bake or air-fry it at 200°C for 18 to 22 mins until there is no pink in the middle.',
    turkey:'Brown the turkey mince in a non-stick pan for 8 to 10 mins, breaking it up as it cooks.',
    beef:'Brown the beef mince in a non-stick pan for 8 to 10 mins and drain off any fat.',
    pork:'Grill or pan-fry the pork for 4 to 5 mins each side until cooked through.',
    lamb:'Grill or pan-fry the lamb for 3 to 4 mins each side, then rest it for 5 mins and slice.',
    salmon:'Bake the salmon at 200°C for 12 to 15 mins, or pan-fry skin side down for 4 mins then 2 mins on the other side.',
    cod:'Bake the cod at 200°C for 12 to 15 mins until it flakes easily.',
    mack:'Grill the mackerel for 3 to 4 mins each side, or use ready-cooked fillets.',
    prawns:'Add the prawns at the end and cook for 2 to 3 mins until hot all the way through.',
    tuna:'Drain the tuna and mix it with a squeeze of lemon and black pepper.',
    tofu:'Press the tofu dry with kitchen roll, cube it and pan-fry or air-fry at 200°C for 12 to 15 mins until golden.',
    soya:'Soak the soya chunks in boiling water for 10 mins, squeeze out the water, then cook them in the sauce.',
    paneer:'Cube the paneer and dry-fry or grill it for 3 to 4 mins until golden.',
    halloumi:'Slice the halloumi and dry-fry it for 1 to 2 mins each side.',
    egg:'Cook the eggs your way: scrambled on a low heat, poached for 3 mins or fried in a non-stick pan with a spray of oil.',
    ew:'Pour in the egg whites and stir gently on a low heat until just set.',
    chick:'Rinse the chickpeas and warm them through in the pan or sauce for 5 mins.',
    beans:'Rinse the beans and warm them through for 5 mins.',
    bbeans:'Rinse the black beans and warm them through with a pinch of cumin for 5 mins.',
    dal:'Rinse the lentils, then simmer in 3 times their volume of water for 15 to 20 mins until soft.',
    edam:'Boil or microwave the edamame for 3 to 4 mins.',
    rice:'Rinse the rice, then simmer it in twice its volume of water with the lid on for 10 to 12 mins. Leave it to steam for 5 mins.',
    pasta:'Boil the pasta in salted water for 10 to 12 mins until al dente.',
    noodle:'Cook the noodles in boiling water for 4 to 5 mins, then drain.',
    rnood:'Soak the rice noodles in just-boiled water for 5 to 8 mins, then drain.',
    soba:'Boil the noodles for 4 to 6 mins, then drain.',
    pot:'Cube the potatoes and boil for 15 mins, or roast at 200°C for 30 to 35 mins with a spray of oil.',
    spot:'Cube the sweet potato and roast at 200°C for 25 to 30 mins, or microwave for 6 to 8 mins.',
    cous:'Pour the same volume of boiling water over the couscous, cover for 5 mins, then fluff with a fork.',
    bulgur:'Simmer the bulgur in twice its volume of water for 12 mins, then leave covered for 5 mins.',
    yam:'Peel and cube the yam, then boil for 15 to 20 mins until soft.',
    plant:'Slice the plantain and dry-fry or air-fry it for 4 to 5 mins each side until golden.',
    tort:'Warm the tortillas in a dry pan for 30 seconds each side.',
    wrap:'Warm the wrap in a dry pan or the microwave for a few seconds.',
    pitta:'Toast or warm the pitta.',chap:'Warm the chapati in a dry pan.',bread:'Toast the bread.',rye:'Toast the rye bread.',sour:'Toast the sourdough.',
    veg:'Steam, microwave or roast the veg for 5 to 10 mins.',
    stirveg:'Stir-fry the veg on a high heat for 3 to 4 mins so it stays crunchy.',
    callaloo:'Wilt the callaloo or spinach in the pan for 2 mins.',
    onion:'Start by frying the onion, tomato and chilli for 5 mins to make the base.',
    salad:'Chop the salad.',cuc:'Grate or chop the cucumber.',nori:'Slice the cucumber and carrot and cut the nori into strips.',
    oats:'Cook the oats with the liquid for 3 to 4 mins, stirring, or soak overnight in the fridge.'
  };
  var NOCOOK={yog:1,skyr:1,syog:1,whey:1,vprot:1,milk:1,oatm:1,banana:1,berries:1,apple:1,honey:1,pb:1,nuts:1,chana:1,ricecake:1,kis:1,cott:1,feta:1,peynir:1,mozz:1,parm:1,avo:1,hummus:1,salsa:1,kimchi:1,lyut:1,corn:1,coconut:1,oil:1,ghee:1,sesoil:1};
  var ORDER=['onion','chicken','turkey','beef','pork','lamb','salmon','cod','mack','tofu','soya','paneer','halloumi','egg','ew','prawns','tuna','chick','beans','bbeans','dal','edam','rice','pasta','noodle','rnood','soba','pot','spot','cous','bulgur','yam','plant','oats','veg','stirveg','callaloo','tort','wrap','pitta','chap','bread','rye','sour','salad','cuc','nori'];
  function howTo(items,note){
    var steps=[];ORDER.forEach(function(k){if(items.indexOf(k)>-1&&COOK[k])steps.push(COOK[k])});
    var oil=items.some(function(k){return k==='oil'||k==='ghee'||k==='sesoil'});
    if(!steps.length)return 'How to make it:\n1. No cooking needed. Weigh everything out, then mix it in a bowl or blend it into a shake.';
    if(oil)steps.unshift('Use the oil listed to cook with. Measure it, don\'t pour it.');
    steps.push(note?note.replace(/\.?$/,'.'):'Season with herbs, spices, garlic, lemon or a low-calorie sauce you like.');
    steps.push('Put it all together, check your portions match the amounts below and enjoy.');
    return 'How to make it:\n'+steps.map(function(s,i){return (i+1)+'. '+s}).join('\n')}
  function keyOf(name){for(var k in F)if(F[k][0]===name)return k;return null}
  function howForFoods(foods,note){var ks=(foods||[]).map(function(f){return keyOf(f.food)}).filter(Boolean);return ks.length?howTo(ks,note):''}
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
    return best}
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
    return render({plan:plan,T:[cals,P,C,Fa],ban:ban,dis:dis,style:o.style});}
  function render(st){
    var cals=st.T[0],P=st.T[1],C=st.T[2],Fa=st.T[3],plan=st.plan;
    var vars=solve(plan.map(function(p){return p[1]}),st.T);
    var meals=plan.map(function(p,mi){return {name:p[0],notes:p[1].name+'\n\n'+howTo(p[1].items,p[1].note),foods:vars.filter(function(v){return v.mi===mi&&v.q>0}).map(function(v){var f=F[v.k],x=macros(v.k,v.q),r=function(n){return String(Math.round(n*10)/10)};return {food:f[0],amount:String(v.q),unit:f[1],kcal:String(Math.round(x[0])),p:r(x[1]),c:r(x[2]),f:r(x[3]),_k:v.k}})}}).filter(function(m){return m.foods.length});
    var styleName={standard:'',indian:'Indian ',mediterranean:'Mediterranean ',turkish:'Turkish ',bulgarian:'Bulgarian ',chinese:'Chinese ',thai:'Thai ',japanese:'Japanese ',korean:'Korean ',mexican:'Mexican ',caribbean:'Caribbean ',westafrican:'West African ',middleeastern:'Middle Eastern ',italian:'Italian ',easterneuropean:'Eastern European '}[st.style]||'';
    var now=new Date().toISOString();
    return {id:'gen'+Date.now().toString(36),title:'My '+styleName+cals+' kcal plan · '+new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'}),created:now,updated:now,
      notes:'Made with "Generate me a meal plan" for your targets: '+cals+' kcal · '+P+'g protein · '+C+'g carbs · '+Fa+'g fat.\nWeigh meat, fish and potatoes raw and rice, pasta, oats and lentils dry. Swaps are fine if they fit your macros.',
      days:[{name:'Every day',notes:'',meals:meals}],_t:st.T,_st:st}}
  function listFor(st,label){var S=M[st.style]||M.standard;if(/^Snack/.test(label))return M.snack;var k=label.toLowerCase(),own=S[k]||[];return own.length>1||S===M.standard?own:own.concat(M.standard[k]||[])}
  function swapMeal(p,mi,style){var st=p._st,cur=st.plan[mi],L=listFor(style?{style:style}:st,cur[0]),opts=L.map(function(t){return build(t,st.ban,st.dis)}).filter(function(b){return b&&b.name!==cur[1].name});if(!opts.length)return null;
    var plan=st.plan.slice();plan[mi]=[cur[0],rnd(opts),style||cur[2]||st.style];return render({plan:plan,T:st.T,ban:st.ban,dis:st.dis,style:st.style})}
  function swapFood(p,mi,oldK,newK){var st=p._st,cur=st.plan[mi],b=cur[1],i=b.items.indexOf(oldK);if(i<0)return null;
    var items=b.items.slice();items[i]=newK;var nb={name:b.name,note:b.note,items:items,alts:b.alts,tpl:b.tpl};nb.name=i===0?rename(nb):b.name;
    var plan=st.plan.slice();plan[mi]=[cur[0],nb,cur[2]];return render({plan:plan,T:st.T,ban:st.ban,dis:st.dis,style:st.style})}
  function strip(p){var c=JSON.parse(JSON.stringify(p,function(k,v){return k==='_st'||k==='_k'||k==='_t'||k==='tpl'?undefined:v}));return c}

  /* ---------- the panel in the client's Meal plan tab ---------- */
  function Panel(el,o){ // o: {onSaved(doc), demo}
    var targets=null,last=null,gn=0;
    el.innerHTML='<div class="mg"><button type="button" class="btn" data-g="open">✨ Generate me a meal plan</button><div class="mg-body"></div></div>';
    var body=el.querySelector('.mg-body');
    function getT(){if(o.demo)return Promise.resolve({cals:'1800',protein:'150',carbs:'190',fat:'50'});
      return fetch('/portal/api/targets',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){return j&&j.targets})}
    function form(){
      var ck=function(v,l){return '<label class="mg-ck"><input type="checkbox" name="ban" value="'+v+'"> '+l+'</label>'};
      body.innerHTML='<div class="pg-note mg-form">'+
        '<div class="mg-pref">📝 <b>Update your food preferences first.</b> Pick your food style, your diet, anything you don\'t eat and the foods you love, so your plan is built around you. They\'re saved in <b>About me</b> under More, where you can change them any time.</div>'+
        '<p>Pick what you like to eat and I\'ll build a day of food that hits your targets: <b>'+esc(targets.cals)+' kcal</b>'+(targets.protein?' · '+esc(targets.protein)+'g protein · '+esc(targets.carbs)+'g carbs · '+esc(targets.fat)+'g fat':'')+'.</p>'+
        '<label>Food style<select name="style"><option value="standard">Everyday British</option><option value="indian">Indian / Pakistani / Bangladeshi</option><option value="chinese">Chinese</option><option value="thai">Thai</option><option value="japanese">Japanese</option><option value="korean">Korean</option><option value="mexican">Mexican</option><option value="caribbean">Caribbean</option><option value="westafrican">West African (Nigerian, Ghanaian)</option><option value="middleeastern">Middle Eastern / Lebanese</option><option value="mediterranean">Mediterranean / Greek</option><option value="italian">Italian</option><option value="turkish">Turkish</option><option value="bulgarian">Bulgarian</option><option value="easterneuropean">Polish / Eastern European</option></select></label>'+
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
    var saved=null;function prefill(){if(!saved)return;var set=function(n,v){var x=body.querySelector('[name='+n+']');if(x&&v!=null&&v!=='')x.value=v};set('style',saved.style);set('diet',saved.diet);set('meals',saved.meals);set('dislike',saved.dislike);set('love',saved.love);[].forEach.call(body.querySelectorAll('[name=ban]'),function(x){x.checked=(saved.ban||[]).indexOf(x.value)>-1});var p=body.querySelector('.mg-pref');if(p&&saved.at)p.innerHTML='📝 <b>Your saved food preferences are filled in.</b> Change anything that\'s different now, then tap Generate. You can also edit them in <b>About me</b> under More.'}
    function loadPrefs(){if(!o.demo)fetch('/portal/api/prefs',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(p){if(p&&p.food){saved={style:p.food.style,diet:p.food.diet,meals:p.food.meals,ban:p.food.ban||[],dislike:p.food.dislike||'',love:p.food.love||'',at:p.food.at};prefill()}}).catch(function(){})}
    function mt(fs){var t={k:0,p:0,c:0,f:0};fs.forEach(function(f){t.k+=+f.kcal;t.p+=+f.p;t.c+=+f.c;t.f+=+f.f});return t}
    function show(p,quiet){
      var out=body.querySelector('.mg-out'),d=p.days[0],t=mt([].concat.apply([],d.meals.map(function(m){return m.foods})));
      if(!quiet)gn++;
      out.innerHTML='<div class="mg-new"><b>✨ '+(quiet?'Plan updated':gn>1?'New plan generated (option '+gn+')':'Your new plan is ready')+'</b><span>'+esc(p.title)+'. Tap 🔄 Change meal to swap a whole meal, or change any food from its drop-down. Portions re-balance to keep you on your targets.</span></div><div class="lg-stats mp-tot"><div><small>Calories</small><b>'+Math.round(t.k)+'</b><span>target '+esc(targets.cals)+'</span></div><div><small>Protein</small><b>'+Math.round(t.p)+'g</b></div><div><small>Carbs</small><b>'+Math.round(t.c)+'g</b></div><div><small>Fat</small><b>'+Math.round(t.f)+'g</b></div></div>'+
        d.meals.map(function(m,mi){var mt0=mt(m.foods),b=p._st.plan[mi][1];return '<div class="mp-meal"><div class="mp-mh"><b>'+esc(m.name)+'</b><span>'+Math.round(mt0.k)+' kcal · P '+Math.round(mt0.p)+'g · C '+Math.round(mt0.c)+'g · F '+Math.round(mt0.f)+'g</span></div><p class="mp-note">'+esc(m.notes)+'</p><ul>'+m.foods.map(function(f){var i=b.items.indexOf(f._k),al=i>-1?b.alts[i]:[];return '<li><span>'+(al&&al.length>1?'<select class="mg-sw" data-mi="'+mi+'" data-k="'+f._k+'">'+al.map(function(k){return '<option value="'+k+'"'+(k===f._k?' selected':'')+'>'+esc(F[k][0])+'</option>'}).join('')+'</select>':esc(f.food))+'</span><b>'+esc(f.amount)+' '+esc(f.unit)+'</b></li>'}).join('')+'</ul><div class="mg-mrow"><button type="button" class="btn g mg-chg" data-g="chg" data-mi="'+mi+'">🔄 Change meal</button>'+(/^Snack/.test(m.name)?'':'<label class="mg-cu">Cuisine <select data-cu="'+mi+'">'+CUISINES.map(function(c){return '<option value="'+c[0]+'"'+(c[0]===(p._st.plan[mi][2]||p._st.style)?' selected':'')+'>'+c[1]+'</option>'}).join('')+'</select></label>')+'</div></div>'}).join('')+
        '<div class="mg-act"><button type="button" class="btn" data-g="save">💾 Save to my meal plans</button><button type="button" class="btn g" data-g="go">🔄 Try another day</button></div><p class="lg-msg"></p>';
      [].forEach.call(out.querySelectorAll('[data-cu]'),function(s){s.onchange=function(){var np=swapMeal(last,+s.getAttribute('data-cu'),s.value);if(np){last=np;show(last,true)}else{s.value=last._st.plan[+s.getAttribute('data-cu')][2]||last._st.style;alert('That cuisine has no options for this meal with your food choices.')}}});
      [].forEach.call(out.querySelectorAll('.mg-sw'),function(s){s.onchange=function(){var np=swapFood(last,+s.getAttribute('data-mi'),s.getAttribute('data-k'),s.value);if(np){last=np;show(last,true)}}});
      if(!quiet){out.classList.remove('mg-flash');void out.offsetWidth;out.classList.add('mg-flash');try{out.scrollIntoView({behavior:'smooth',block:'start'})}catch(e){}}
    }
    el.addEventListener('click',function(e){var b=e.target.closest('[data-g]');if(!b)return;var a=b.getAttribute('data-g');
      if(a==='open'){body.innerHTML='<p style="color:var(--mute)">Loading your targets…</p>';getT().then(function(t){if(!t||!+t.cals){body.innerHTML='<div class="pg-note">Your coach hasn\'t set your calories and macros yet. Once they have, you can generate a plan here.</div>';return}targets=t;form();prefill();loadPrefs()}).catch(function(){body.innerHTML='<div class="pg-note">Couldn\'t load your targets. Try again.</div>'})}
      if(a==='close'){body.innerHTML=''}
      if(a==='chg'&&last){var mi=+b.getAttribute('data-mi'),y=b.getBoundingClientRect().top,np=swapMeal(last,mi,last._st.plan[mi][2]);if(!np){b.textContent='No other options for this meal';return}last=np;show(last,true);var nb=body.querySelectorAll('.mg-chg')[mi];if(nb)try{window.scrollBy(0,nb.getBoundingClientRect().top-y)}catch(e){}}
      if(a==='go'){last=generate(opts());if(!last){body.querySelector('.mg-out').innerHTML='<div class="pg-note">Those choices rule out too many foods. Untick something and try again.</div>';return}show(last)}
      if(a==='save'&&last){var m=body.querySelector('.lg-msg');b.disabled=true;m.textContent='Saving…';
        if(o.demo){m.textContent='Saved ✓ (preview only)';return}
        fetch('/portal/api/mealplans',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({plan:strip(last)})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw 0;return j})})
          .then(function(j){gn=0;body.innerHTML='<div class="pg-note" style="border-color:#5fbf7f">✅ Saved. It\'s now your current meal plan, and it\'s kept in <b>My meal plans</b> below with all your past plans, so you can look back at any of them.</div>';o.onSaved&&o.onSaved(j)})
          .catch(function(){b.disabled=false;m.textContent='Not saved. Try again.'})}
    });
  }
  window.MPFMealGen={generate:function(o){var p=generate(o);return p?strip(p):p},generateRaw:generate,swapMeal:swapMeal,swapFood:swapFood,strip:strip,howForFoods:howForFoods,Panel:Panel};

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
