(function(){
  'use strict';

  // Boot badge + hide “JS blocked”
  function bootOK(){
    var b=document.getElementById('bootBadge');
    if(b){ b.classList.remove('hidden'); b.textContent='JS 已載入 ✓'; setTimeout(function(){ b.classList.add('hidden'); }, 2500); }
    var notice=document.getElementById('jsBlockedNotice');
    if(notice){ notice.classList.add('hidden'); }
  }

  // Error overlay (mobile friendly)
  function showError(msg){
    try{
      var bar=document.getElementById('errbar');
      if(!bar){ bar=document.createElement('div'); bar.id='errbar'; bar.style.cssText='position:fixed;left:0;right:0;bottom:0;background:#ffe8e8;color:#900;padding:8px 12px;z-index:9999;font-size:12px;max-height:30vh;overflow:auto'; document.body.appendChild(bar); }
      var line=document.createElement('div'); line.textContent=msg; bar.appendChild(line);
    }catch(_){}
  }
  window.addEventListener('error', function(e){ showError('Script error: '+(e && e.message ? e.message : 'unknown')); });

  // Utilities
  var PUNCT = "，。！？：；、,.!?;:“”‘’（）()…—-";
  function isP(ch){ return PUNCT.indexOf(ch)!==-1; }
  function $(id){ return document.getElementById(id); }
  var LINES_RE = /\r?\n+/;

  var els = {
    teacherPanel: $('teacherPanel'), sentences: $('sentences'), forceChar: $('forceChar'), excludeP: $('excludePunct'), pin: $('pin'),
    makeSet: $('makeSet'), makeOne: $('makeOne'), shuffle: $('shuffle'), clear: $('clear'), hideNow: $('hideNow'), changePin: $('changePin'),
    tray: $('tray'), answer: $('answer'),
    prev: $('prev'), next: $('next'), finishAll: $('finishAll'), reveal: $('reveal'), result: $('result'),
    qIndex: $('qIndex'), qTotal: $('qTotal'), score: $('score'), progressBar: $('progressBar'),
    originalBox: $('originalBox'), original: $('original'),
    unlockBtn: $('unlockBtn'),
    pinBackdrop: $('pinBackdrop'), pinInput: $('pinInput'), pinCancel: $('pinCancel'), pinOK: $('pinOK'), pinHint: $('pinHint'),
    changeBackdrop: $('changeBackdrop'), oldPinInput: $('oldPinInput'), newPinInput: $('newPinInput'), newPinInput2: $('newPinInput2'), changeCancel: $('changeCancel'), changeOK: $('changeOK'), changeHint: $('changeHint'),
    summaryBackdrop: $('summaryBackdrop'), summaryList: $('summaryList'), summaryClose: $('summaryClose'), summaryFirstWrong: $('summaryFirstWrong')
  };

  try{
    var btns=document.querySelectorAll('button:not([type])');
    for(var i=0;i<btns.length;i++){ btns[i].setAttribute('type','button'); }
  }catch(_){}

  function tokenize(s, forceChar){
    s = (s||'').trim().replace(/\s+/g,' ');
    if(!s) return [];
    if(forceChar || s.indexOf(' ')===-1){
      var out=[], i, ch;
      for(i=0;i<s.length;i++){
        ch=s.charAt(i); if(ch===' ') continue;
        out.push({text: ch, type: isP(ch)?'punct':'word'});
      }
      return out;
    }
    var parts=s.split(' '), out2=[], w, right;
    for(var j=0;j<parts.length;j++){
      w=parts[j];
      while(w && isP(w.charAt(0))){ out2.push({text:w.charAt(0),type:'punct'}); w=w.slice(1); }
      right=[]; while(w && isP(w.charAt(w.length-1))){ right.unshift({text:w.charAt(w.length-1),type:'punct'}); w=w.slice(0,-1); }
      if(w) out2.push({text:w,type:'word'});
      Array.prototype.push.apply(out2, right);
    }
    return out2;
  }

  function shuffle(a){
    var b=a.slice();
    for(var i=b.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=b[i]; b[i]=b[j]; b[j]=t;
    }
    return b;
  }
  function equal(a,b){
    if(a.length!==b.length) return false;
    for(var i=0;i<a.length;i++){ if(a[i]!==b[i]) return false; }
    return true;
  }

  var set = []; var idx = 0; var score = 0; var teacherPIN = '';

  function buildQuestion(sentence){
    var tokens = tokenize(sentence, els.forceChar.checked);
    if(!tokens.length) return null;
    var playable = els.excludeP.checked ? tokens.filter(function(t){return t.type!=='punct';}) : tokens.slice();
    var pool = playable.map(function(t,i){ return { uid:i, text:t.text }; });
    return { originalTokens: tokens, playable: playable, target: playable.map(function(t){return t.text;}), pool: pool, shuffled:null, answer:[], solved:false };
  }

  function renderOriginal(q){ els.original.textContent = q.originalTokens.map(function(t){return t.text;}).join(''); }
  function clearBoard(){
    els.tray.innerHTML=''; els.answer.innerHTML=''; els.result.textContent='';
    els.answer.classList.remove('good','bad','correct-pulse'); els.originalBox.classList.add('hidden');
  }
  function makeTile(uid,q){
    var p=null; for(var i=0;i<q.pool.length;i++){ if(q.pool[i].uid===uid){ p=q.pool[i]; break; } }
    var d=document.createElement('button'); d.type='button'; d.className='tile'; d.textContent=p.text; d.dataset.uid=String(uid); return d;
  }
  function ensureShuffled(q){
    if(q.shuffled) return;
    var ids=[]; for(var i=0;i<q.pool.length;i++) ids.push(q.pool[i].uid);
    var c=shuffle(ids); var tries=0;
    while(tries<5 && equal(uidsToTexts(q,c),q.target)){ c=shuffle(ids); tries++; }
    q.shuffled=c;
  }
  function uidsToTexts(q,arr){
    var out=[], i, uid;
    for(i=0;i<arr.length;i++){
      uid=arr[i];
      for(var j=0;j<q.pool.length;j++){ if(q.pool[j].uid===uid){ out.push(q.pool[j].text); break; } }
    }
    return out;
  }

  function renderQuestion(i){
    if(!set.length) return;
    if(i<0) i=0; if(i>=set.length) i=set.length-1; idx=i;
    var q=set[idx];
    clearBoard(); renderOriginal(q); ensureShuffled(q);

    var remaining=[];
    for(var r=0;r<q.shuffled.length;r++){ if(q.answer.indexOf(q.shuffled[r])===-1) remaining.push(q.shuffled[r]); }
    for(var a=0;a<remaining.length;a++){ els.tray.appendChild(makeTile(remaining[a],q)); }
    for(var b=0;b<q.answer.length;b++){ els.answer.appendChild(makeTile(q.answer[b],q)); }

    els.qIndex.textContent=String(idx+1);
    els.qTotal.textContent=String(set.length);
    els.progressBar.style.width=(idx/Math.max(1,set.length)*100)+'%';
  }

  function celebrate(){
    els.answer.classList.add('correct-pulse'); setTimeout(function(){ els.answer.classList.remove('correct-pulse'); }, 1200);
    var layer=document.createElement('div'); layer.className='celebration-layer'; document.body.appendChild(layer);
    var EMOJIS=['⭐️','✨','🌟','🎉','🎊','👍','👏','💯','😺']; var count=30; var vw=innerWidth;
    for(var i=0;i<count;i++){
      var s=document.createElement('span'); s.className='particle'; s.textContent=EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
      var x=Math.random()*vw; var drift=(Math.random()*2-1)*220;
      s.style.left=x+'px'; s.style.bottom='-10vh'; s.style.fontSize=(18+Math.random()*22)+'px';
      s.style.setProperty('--x',drift+'px');
      var dur=1200+Math.random()*900; var delay=Math.random()*180;
      s.style.animation='floatUp '+dur+'ms '+delay+'ms ease-out forwards';
      layer.appendChild(s);
    }
    var big=document.createElement('div'); big.className='center-pop'; big.textContent='🎉'; layer.appendChild(big);
    setTimeout(function(){ layer.remove(); },2300);
  }

  function resolveUidsForTexts(q, texts){
    var used={}, out=[];
    for(var i=0;i<texts.length;i++){
      var t=texts[i], item=null;
      for(var j=0;j<q.pool.length;j++){ var p=q.pool[j]; if(p.text===t && !used[p.uid]){ item=p; break; } }
      if(item){ out.push(item.uid); used[item.uid]=true; }
    }
    return out;
  }
  function revealCurrent(){
    if(!set.length) return;
    var q=set[idx];
    q.answer=resolveUidsForTexts(q,q.target);
    renderQuestion(idx);
    els.result.textContent='已顯示正確答案。';
  }

  function parseLines(text){
    var parts=(text||'').split(LINES_RE), out=[], s;
    for(var i=0;i<parts.length;i++){ s=parts[i].trim(); if(s) out.push(s); }
    return out;
  }

  function createSet(){
    var lines=parseLines(els.sentences.value);
    if(!lines.length){ alert('請先輸入至少一題（每行一題）'); return false; }
    var newSet=[];
    for(var i=0;i<lines.length;i++){ var q=buildQuestion(lines[i]); if(q) newSet.push(q); }
    if(!newSet.length){ alert('沒有有效的題目'); return false; }
    set=newSet; idx=0; score=0; els.score.textContent='0'; els.progressBar.style.width='0%';
    teacherPIN=(els.pin.value||'').trim();
    renderQuestion(0);
    return true;
  }

  function createOne(){
    var arr=parseLines(els.sentences.value), first=null;
    for(var i=0;i<arr.length;i++){ if(arr[i]){ first=arr[i]; break; } }
    if(!first){ alert('請先輸入一句話'); return false; }
    var q=buildQuestion(first); if(!q){ alert('此句子無法出題'); return false; }
    set=[q]; idx=0; score=0; els.score.textContent='0'; els.progressBar.style.width='0%';
    teacherPIN=(els.pin.value||'').trim();
    renderQuestion(0);
    return true;
  }

  function showTeacher(show){
    els.teacherPanel.classList.toggle('hidden', !show);
    els.reveal.classList.toggle('hidden', !show);
    els.reveal.disabled=!show;
    if(!show){
      els.reveal.setAttribute('aria-hidden','true');
      els.reveal.setAttribute('tabindex','-1');
      els.unlockBtn.classList.remove('hidden');
    } else {
      els.reveal.removeAttribute('aria-hidden');
      els.reveal.removeAttribute('tabindex');
      els.unlockBtn.classList.add('hidden');
    }
  }

  // Tile click
  function findTileFromTarget(target){
    var node = target;
    while(node && node !== document.body){
      if(node.classList && node.classList.contains('tile')) return node;
      node = node.parentNode;
    }
    return null;
  }
  function tileTapHandler(e){
    var t = findTileFromTarget(e.target);
    if(!t) return;
    if(e.cancelable && e.preventDefault) e.preventDefault();
    var uid = parseInt(t.dataset.uid,10);
    var q = set[idx];
    if(!q) return;
    if(t.parentElement===els.tray){
      els.answer.appendChild(t);
      q.answer.push(uid);
    } else {
      var children=[].slice.call(els.answer.querySelectorAll('.tile'));
      var pos=children.indexOf(t);
      if(pos>=0) q.answer.splice(pos,1);
      els.tray.appendChild(t);
    }
    els.result.textContent='';
  }
  function bindTileContainer(el){
    if(!el) return;
    el.addEventListener('click', function(e){
      try{ tileTapHandler(e); }catch(err){ showError('Tile handler error: '+(err && err.message ? err.message : err)); }
    });
  }
  bindTileContainer(els.tray); bindTileContainer(els.answer);

  // Button wiring (simple click for iOS)
  function addPress(el, fn){ if(!el) return; el.addEventListener('click', function(e){ try{ fn(e); }catch(err){ showError('Handler error: '+(err && err.message ? err.message : err)); } }); }

  addPress(els.makeSet, function(){ createSet(); });
  addPress(els.makeOne, function(){ createOne(); });
  addPress(els.hideNow, function(){ if(createSet()){ showTeacher(false); } });
  addPress(els.shuffle, function(){
    if(!set.length) return;
    var q=set[idx]; var remain=[], i;
    for(i=0;i<q.shuffled.length;i++){ if(q.answer.indexOf(q.shuffled[i])===-1) remain.push(q.shuffled[i]); }
    var resh=shuffle(remain); q.shuffled=q.answer.concat(resh); renderQuestion(idx);
  });
  addPress(els.clear, function(){
    set=[]; idx=0; score=0; els.score.textContent='0'; els.progressBar.style.width='0%';
    els.sentences.value=''; els.tray.innerHTML=''; els.answer.innerHTML=''; els.result.textContent='';
    els.qIndex.textContent='0'; els.qTotal.textContent='0'; showTeacher(true);
  });
  addPress(els.prev, function(){ if(!set.length) return; if(idx>0) renderQuestion(idx-1); });
  addPress(els.next, function(){ if(!set.length) return; if(idx<set.length-1) renderQuestion(idx+1); });
  addPress(els.finishAll, function(){ finalizeAll(); });
  addPress(els.reveal, function(){ revealCurrent(); });
  addPress(els.unlockBtn, function(){ openPinModal(); });
  addPress(els.pinCancel, function(){ closePinModal(); });
  addPress(els.pinOK, function(){
    var entered=(els.pinInput.value||'').trim();
    if(!teacherPIN){ els.pinHint.textContent='尚未設定PIN，已直接顯示教師區。'; showTeacher(true); closePinModal(); return; }
    if(!entered){ els.pinHint.textContent='請輸入PIN'; return; }
    if(entered===teacherPIN){ showTeacher(true); closePinModal(); } else { els.pinHint.textContent='PIN不正確。'; }
  });
  addPress(els.changePin, function(){ openChangeModal(); });
  addPress(els.changeCancel, function(){ closeChangeModal(); });
  addPress(els.changeOK, function(){
    var oldEntered=(els.oldPinInput.value||'').trim();
    var n1=(els.newPinInput.value||'').trim();
    var n2=(els.newPinInput2.value||'').trim();
    if(teacherPIN && oldEntered!==teacherPIN){ els.changeHint.textContent='目前PIN不正確。'; return; }
    if(!n1){ els.changeHint.textContent='新PIN不可為空。'; return; }
    if(n1!==n2){ els.changeHint.textContent='兩次輸入的新PIN不一致。'; return; }
    teacherPIN=n1; els.pin.value=''; els.changeHint.textContent='已更新PIN。'; setTimeout(function(){ closeChangeModal(); },600);
  });

  // Scoring & summary
  function finalizeAll(){
    if(!set.length) return;
    var answered=0, correct=0; var statuses=[];
    for(var i=0;i<set.length;i++){
      var q=set[i];
      var answeredText=uidsToTexts(q,q.answer);
      var isAns=answeredText.length===q.target.length;
      var ok=isAns && equal(answeredText,q.target);
      if(isAns) answered++;
      if(ok){ correct++; q.solved=true; } else q.solved=false;
      statuses.push({index:i, answeredText:answeredText.join(' '), ok:ok, isAns:isAns});
    }
    els.score.textContent=String(correct);
    els.result.textContent='總結：'+correct+'/'+set.length+' 題正確；已作答 '+answered+'/'+set.length;
    if(correct===set.length && set.length>0) celebrate();
    showSummary(statuses);
  }
  function showSummary(stats){
    els.summaryList.innerHTML=''; var firstWrong=-1;
    for(var i=0;i<stats.length;i++){
      var st=stats[i];
      var wrap=document.createElement('div'); wrap.className='qitem';
      var id=document.createElement('div'); id.className='qid'; id.textContent='#'+(st.index+1);
      var ans=document.createElement('div'); ans.className='ans '+(st.ok?'correct':'wrong'); ans.textContent= st.isAns? st.answeredText : '(未完成)';
      wrap.appendChild(id); wrap.appendChild(ans);
      (function(index){ wrap.addEventListener('click', function(){ renderQuestion(index); els.summaryBackdrop.classList.add('hidden'); }); })(st.index);
      els.summaryList.appendChild(wrap);
      if(!st.ok && firstWrong<0) firstWrong=st.index;
    }
    els.summaryBackdrop.classList.remove('hidden');
    els.summaryFirstWrong.onclick=function(){ if(firstWrong>=0){ renderQuestion(firstWrong); els.summaryBackdrop.classList.add('hidden'); } };
    els.summaryClose.onclick=function(){ els.summaryBackdrop.classList.add('hidden'); };
  }

  // PIN modals
  function openPinModal(){ els.pinInput.value=''; els.pinHint.textContent=''; els.pinBackdrop.classList.remove('hidden'); els.pinInput.focus(); }
  function closePinModal(){ els.pinBackdrop.classList.add('hidden'); }
  function openChangeModal(){ els.oldPinInput.value=''; els.newPinInput.value=''; els.newPinInput2.value=''; els.changeHint.textContent=''; els.changeBackdrop.classList.remove('hidden'); els.oldPinInput.focus(); }
  function closeChangeModal(){ els.changeBackdrop.classList.add('hidden'); }

  // Demo preload
  els.sentences.value='我們 今天 去 公園 玩。\n今天 下雨 了， 記得 帶 傘。\n小明 喜歡 吃 蘋果。';
  createSet();
  bootOK();
})();
