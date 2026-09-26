(() => {
  "use strict";

  const CONFIG = window.GAME_CONFIG || {};
  const QUESTIONS = [
  {
    "value": "100",
    "q": "What is the gender of the baby?",
    "a": [
      "Boy",
      "Girl",
      "Non-binary",
      "AH64 Sikorsky Apache Attack Helicopter"
    ],
    "c": 0
  },
  {
    "value": "200",
    "q": "What is the name of the obstetrician who will help Radhika deliver?",
    "a": [
      "The Maharaja of Rawajputala",
      "Joseph and the animals in the stable",
      "Martin Andries",
      "Srividhya Sankaran"
    ],
    "c": 3
  },
  {
    "value": "300",
    "q": "What is the brand of the stroller purchased?",
    "a": [
      "Lamborghini",
      "Joolz",
      "Silver Cross",
      "Bugaboo"
    ],
    "c": 1
  },
  {
    "value": "500",
    "q": "What is the name of the hospital at which Radhika will deliver?",
    "a": [
      "St Thomas and Guy's Hospital",
      "The Royal London Hospital",
      "St Mary's Hospital",
      "L'Hopital Velpeau"
    ],
    "c": 0
  },
  {
    "value": "1,000",
    "q": "What size is a baby at full-term in fruit terms?",
    "a": [
      "Apricot",
      "Peach",
      "Coconut",
      "Watermelon"
    ],
    "c": 3
  },
  {
    "value": "2,000",
    "q": "Which baby accessory did we NOT purchase?",
    "a": [
      "Diaper bin",
      "Playing mat",
      "Car seat",
      "Pacifier"
    ],
    "c": 3
  },
  {
    "value": "4,000",
    "q": "What is the most common name given to baby boys in the UK?",
    "a": [
      "James",
      "Noah",
      "Mohammed",
      "Jack"
    ],
    "c": 2
  },
  {
    "value": "8,000",
    "q": "Which famous London landmark can you NOT see from St Thomas' Hospital / Guy's Hospital?",
    "a": [
      "The Houses of Parliament",
      "Tower Bridge",
      "The London Eye",
      "Big Ben"
    ],
    "c": 1
  },
  {
    "value": "16,000",
    "q": "What has been Radhika's food craving during this pregnancy?",
    "a": [
      "Suhki aloo",
      "Beans & Toast",
      "Cake",
      "Maggi noodles"
    ],
    "c": 1
  },
  {
    "value": "32,000",
    "q": "Which supplement is routinely recommended during early pregnancy?",
    "a": [
      "Creatine",
      "Whey protein",
      "Folic acid",
      "Magnesium"
    ],
    "c": 2
  },
  {
    "value": "64,000",
    "q": "What is Radhika's due date (based on the UK system)?",
    "a": [
      "20th October",
      "17th October",
      "15th October",
      "13th October"
    ],
    "c": 0
  },
  {
    "value": "125,000",
    "q": "How much weight does a baby lose on average after being born?",
    "a": [
      "2–3%",
      "5–7%",
      "8–10%",
      "10–15%"
    ],
    "c": 1
  },
  {
    "value": "250,000",
    "q": "What is one food you should never feed a baby?",
    "a": [
      "Broccoli",
      "Honey",
      "Bread",
      "Jackfruit"
    ],
    "c": 1
  },
  {
    "value": "500,000",
    "q": "What vitamin is routinely offered to newborn babies shortly after birth?",
    "a": [
      "Vitamin A",
      "Vitamin C",
      "Vitamin D",
      "Vitamin K"
    ],
    "c": 3
  },
  {
    "value": "1,000,000",
    "q": "What name would the baby have had if I let Radhika choose?",
    "a": [
      "Chandragupta",
      "Noa",
      "Avi",
      "Alexande"
    ],
    "c": 1
  }
];
  const PLAYERS = [
    {id:"puja", name:"Puja", role:"Grandma"},
    {id:"marc", name:"Marc", role:"Grandpa"},
    {id:"nathalie", name:"Nathalie", role:"Grandma"}
  ];
  const LADDER = QUESTIONS.map(q => q.value);

  const params = new URLSearchParams(location.search);
  const joinCode = params.get("join");
  const isJoin = !!joinCode;
  let supabase = null;
  let channel = null;
  let channelReady = false;
  let roomCode = null;
  let role = isJoin ? "player" : "host";
  let player = null;
  let hostState = {
    phase:"intro", question:0, reveal:0, selected:{}, locked:{},
    lifelines:{}, revealed:false, result:null, started:false
  };
  let localAnswer = null;
  let localLocked = false;
  let toastTimer = null;
  let localDisabledAnswers = [];
  let localLifelineNotice = "";

  const audioTracks = {
    intro: new Audio("audio/main-screen.mp3"),
    guessing: new Audio("audio/guessing.mp3"),
    locked: new Audio("audio/answer-locked.mp3"),
    win: new Audio("audio/winning.mp3")
  };
  Object.values(audioTracks).forEach(a => { a.preload="auto"; a.volume=0.8; });
  let activeTrack=null;

  function stopTrack(){
    if(!activeTrack) return;
    activeTrack.pause();
    activeTrack.currentTime=0;
    activeTrack=null;
  }

  function playTrack(name, loop){
    if(role!=="host") return;
    const a=audioTracks[name];
    if(!a) return;
    if(activeTrack===a && !a.paused) return;
    stopTrack();
    activeTrack=a;
    a.loop=!!loop;
    a.currentTime=0;
    a.volume=0.8;
    const p=a.play();
    if(p && p.catch) p.catch(()=>{});
  }

  function syncMusic(){
    if(role!=="host") return;
    if(hostState.phase==="finished"){ playTrack("win",true); return; }
    if(hostState.phase==="intro"){ playTrack("intro",true); return; }
    if(hostState.reveal<5){ playTrack("guessing",true); return; }
    playTrack("locked",false);
  }

  const $ = s => document.querySelector(s);
  const app = $("#app");

  function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function uid(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

  function saveHost(){ localStorage.setItem("wwgb-host-state", JSON.stringify(hostState)); }
  function loadHost(){
    try { const x=JSON.parse(localStorage.getItem("wwgb-host-state")); if(x) hostState={...hostState,...x}; } catch {}
  }

  function toast(msg){
    const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.classList.add("show"),20);
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),300)},2400);
  }

  function hasRealtimeConfig(){
    return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY && window.supabase);
  }

  function connect(code){
    roomCode=code;
    if(!hasRealtimeConfig()){
      render();
      toast("Add Supabase settings in config.js to enable phone joining.");
      return;
    }

    supabase=window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);
    channelReady=false;
    channel=supabase.channel("wwgb-"+code, {config:{broadcast:{self:true}}});

    channel.on("broadcast",{event:"state"}, ({payload})=>{
      if(role!=="player" || !payload) return;
      const oldQuestion=hostState.question;
      const oldPhase=hostState.phase;
      hostState={...hostState,...payload};

      if(payload.question !== undefined && payload.question !== oldQuestion){
        localAnswer=null;
        localLocked=false;
        localDisabledAnswers=[];
        localLifelineNotice="";
      }
      if(payload.phase==="game" && oldPhase!=="game"){
        localAnswer=null;
        localLocked=false;
        localDisabledAnswers=[];
        localLifelineNotice="";
      }
      render();
    });

    channel.on("broadcast",{event:"answer"}, ({payload})=>{
      if(role==="host" && payload){
        if(payload.lifeline){
          // Keep per-player lifeline state on the host for display/status,
          // but do not let one player's joker affect another player's phone.
          hostState.lifelines=hostState.lifelines||{};
          hostState.lifelines[payload.playerId]={
            ...(hostState.lifelines[payload.playerId]||{fifty:true,dad:true,parents:true}),
            [payload.lifeline]:false
          };
          saveHost();
          render();
          return;
        }
        if(payload.answer !== undefined){
          hostState.selected={...hostState.selected,[payload.playerId]:payload.answer};
        }
        if(payload.locked){
          hostState.locked={...hostState.locked,[payload.playerId]:true};
        }
        saveHost();
        render();
      }
    });

    channel.on("broadcast",{event:"join"}, ({payload})=>{
      if(role==="host"){
        toast((payload?.name||"A player")+" joined");
        // Send the current state only after the host channel is confirmed
        // subscribed. Also repeat it to cover the player's subscribe race.
        broadcastState();
        setTimeout(()=>broadcastState(),300);
        setTimeout(()=>broadcastState(),1000);
        render();
      }
    });

    channel.on("broadcast",{event:"requestState"}, ()=>{
      if(role==="host"){
        broadcastState();
        setTimeout(()=>broadcastState(),250);
      }
    });

    channel.on("broadcast",{event:"playerLifeline"}, ({payload})=>{
      if(role==="host" && payload){
        hostState.lifelines=hostState.lifelines||{};
        hostState.lifelines[payload.playerId]={
          ...(hostState.lifelines[payload.playerId]||{fifty:true,dad:true,parents:true}),
          [payload.kind]:false
        };
        saveHost();
        render();
      }
    });

    channel.subscribe(async (status, err)=>{
      if(status==="SUBSCRIBED"){
        channelReady=true;

        if(role==="host"){
          // Send the current state immediately, using HTTP Broadcast when
          // available, so a fast host action cannot be lost during WebSocket
          // startup.
          await broadcastState();
        } else {
          await broadcast("join",{name:player?.name,playerId:player?.id});
          // Ask for state repeatedly. These use the same broadcast path and
          // therefore don't depend on a race with the player's WebSocket.
          [100,400,1000,2000].forEach(ms=>{
            setTimeout(()=>{
              if(channel && channelReady){
                broadcast("requestState",{playerId:player?.id});
              }
            },ms);
          });
        }
        render();
      } else {
        channelReady=false;
        console.error("WWGB Realtime status:",status,err||"");
        if(role==="host"){
          toast("Realtime: "+status);
        }
        render();
      }
    });
  }

  async function broadcast(event,payload){
    if(!channel) return false;
    try{
      // Prefer Supabase's HTTP Broadcast path. It does not depend on the
      // sender's WebSocket being fully ready, while still delivering to all
      // WebSocket subscribers on the same public topic.
      if(typeof channel.httpSend==="function"){
        await channel.httpSend(event,payload);
        return true;
      }

      // Fallback for older supabase-js versions.
      if(!channelReady) return false;
      const result=await channel.send({
        type:"broadcast",
        event,
        payload
      });
      return result===undefined || result?.status==="ok" || result===null;
    }catch(e){
      console.error("WWGB broadcast failed",event,e);
      if(role==="host"){
        toast("Realtime send failed: "+(e?.message||"check connection"));
      }
      return false;
    }
  }

  async function broadcastState(){
    if(role!=="host" || !channel) return false;
    const snapshot=JSON.parse(JSON.stringify(hostState));
    const ok=await broadcast("state",snapshot);
    // Redundant sends cover phones that are joining at the exact moment the
    // TV advances the show.
    setTimeout(()=>broadcast("state",JSON.parse(JSON.stringify(hostState))),150);
    setTimeout(()=>broadcast("state",JSON.parse(JSON.stringify(hostState))),600);
    return ok;
  }

  function startGame(){
    hostState={
      phase:"game",question:0,reveal:0,selected:{},locked:{},
      lifelines:{
        puja:{fifty:true,dad:true,parents:true},
        marc:{fifty:true,dad:true,parents:true},
        nathalie:{fifty:true,dad:true,parents:true}
      },
      revealed:false,result:null,started:true,disabledAnswers:[]
    };
    saveHost();
    render();
    syncMusic();

    // Send the new game state repeatedly. This is intentionally redundant:
    // Realtime clients can be at slightly different subscription stages.
    broadcastState();
    [200,700,1500].forEach(ms=>setTimeout(broadcastState,ms));
  }

  function allLocked(){
    return PLAYERS.every(p=>hostState.locked[p.id]);
  }

  function revealNext(){
    if(hostState.phase==="intro"){ startGame(); return; }
    if(hostState.phase==="finished") return;
    if(hostState.phase==="game"){
      if(hostState.reveal < 4){ hostState.reveal++; broadcastState(); render(); syncMusic(); return; }
      if(hostState.reveal===4){
        if(!allLocked()){ toast("Wait until Puja, Marc and Nathalie have all locked an answer."); return; }
        hostState.reveal=5; hostState.revealed=false; broadcastState(); render(); syncMusic(); return;
      }
      if(hostState.reveal===5){
        // suspense step; next arrow starts the 3-second answer reveal
        hostState.reveal=6; broadcastState(); render(); syncMusic();
        setTimeout(()=>{
          if(hostState.phase==="game" && hostState.reveal===6){
            hostState.revealed=true; hostState.reveal=7;
            hostState.result=QUESTIONS[hostState.question].c;
            broadcastState(); render(); syncMusic();
          }
        },3000);
        return;
      }
      if(hostState.reveal===7){
        const q=QUESTIONS[hostState.question];
        const correct=Object.values(hostState.selected).filter(x=>x===q.c).length;
        if(hostState.question===QUESTIONS.length-1){
          hostState.phase="finished"; broadcastState(); render(); syncMusic(); return;
        }
        hostState.question++;
        hostState.reveal=0; hostState.selected={}; hostState.locked={}; hostState.revealed=false; hostState.result=null; hostState.disabledAnswers=[];
        broadcastState(); render(); syncMusic(); return;
      }
    }
  }

  function back(){
    if(hostState.reveal>0){ hostState.reveal--; broadcastState(); render(); }
  }

  function chooseAnswer(idx){
    if(role!=="player" || hostState.phase!=="game" || hostState.reveal<4 || localLocked) return;
    localAnswer=idx; render();
  }

  function lockAnswer(){
    if(role!=="player" || localAnswer===null || localLocked || hostState.reveal<4) return;
    localLocked=true;
    broadcast("answer",{playerId:player.id,answer:localAnswer,locked:true});
    render();
  }

  function useLifeline(kind){
    if(role!=="player" || !player || hostState.phase!=="game") return;
    if(hostState.reveal<4){
      toast("Wait until all four answers are shown.");
      return;
    }

    const available=hostState.lifelines?.[player.id]?.[kind];
    if(!available){
      toast("You've already used that joker.");
      return;
    }

    // Consume locally immediately so the button cannot be pressed twice.
    hostState.lifelines={
      ...hostState.lifelines,
      [player.id]:{
        ...(hostState.lifelines?.[player.id]||{}),
        [kind]:false
      }
    };

    if(kind==="fifty"){
      const q=QUESTIONS[hostState.question];
      const wrong=[0,1,2,3]
        .filter(i=>i!==q.c)
        .sort(()=>Math.random()-.5)
        .slice(0,2);
      localDisabledAnswers=wrong;
      localLifelineNotice="🍼 Diaper Surprise used — two answers removed.";
    } else if(kind==="dad"){
      localLifelineNotice="📞 Call the Dad — call Martin now!";
    } else if(kind==="parents"){
      localLifelineNotice="👨‍👩‍👧 Ask the Parents — discuss it with the parents!";
    }

    // Tell the host only that this player's joker was used. Never broadcast
    // the player's local disabled answers to the other phones.
    broadcast("playerLifeline",{playerId:player.id,kind});
    render();
  }

  function hostLifeline(kind){
    toast("Jokers are used individually from each grandparent's phone.");
  }

  function joinAs(id){
    player=PLAYERS.find(p=>p.id===id);
    if(!player) return;
    localAnswer=null; localLocked=false; localDisabledAnswers=[]; localLifelineNotice="";
    localStorage.setItem("wwgb-player",id);
    render();
    connect(joinCode);
  }

  function render(){
    if(role==="host") renderHost();
    else renderPlayer();
  }

  function renderHost(){
    if(!roomCode) {
      app.innerHTML=`
      <div class="cinema intro">
        <div class="eyebrow">RADHIKA'S GODH BHARAI</div>
        <h1>WHO WANTS TO BE A<br><span>GRANDPARENT?</span></h1>
        <p class="subtitle">The ultimate test of grandparent knowledge</p>
        <div class="setup-card">
          <div class="setup-title">CREATE TONIGHT'S GAME</div>
          <p>Connect the TV to this page. The grandparents will join by scanning a QR code on the TV.</p>
          <button class="gold-btn" id="createRoom">CREATE GAME</button>
          ${!hasRealtimeConfig()?'<div class="warning">Phone joining needs the Supabase values in <b>config.js</b>. See README.</div>':''}
        </div>
      </div>`;
      $("#createRoom").onclick=()=>{roomCode=uid(); localStorage.setItem("wwgb-room",roomCode); connect(roomCode); render(); syncMusic();};
      return;
    }
    if(hostState.phase==="intro"){
      app.innerHTML=`
      <div class="cinema intro">
        <div class="eyebrow">RADHIKA'S GODH BHARAI</div>
        <h1>WHO WANTS TO BE A<br><span>GRANDPARENT?</span></h1>
        <p class="subtitle">Puja • Marc • Nathalie</p>
        <div class="qr-card">
          <div>
            <div class="qr-title">JOIN THE GAME</div>
            <div class="qr-code" id="qr"></div>
            <div class="room-code">${roomCode}</div>
            <p>Scan with your phone, choose your name, and get your own jokers.</p>
          </div>
          <div class="instructions">
            <b>HOST</b>
            <p>Press <kbd>H</kbd> for controls.</p>
            <p>Press <kbd>→</kbd> to start the show.</p>
          </div>
        </div>
        <div class="players-wait">${PLAYERS.map(p=>`<div class="player-pill"><span class="dot"></span>${p.name}</div>`).join("")}</div>
      </div>`;
      makeQR();
      return;
    }
    if(hostState.phase==="finished"){
      app.innerHTML=`<div class="cinema finale"><div class="eyebrow">RADHIKA'S GODH BHARAI</div><div class="trophy">★</div><h1>CONGRATULATIONS!</h1><div class="million">1,000,000</div><div class="baby-hours">BABY HOURS</div><p>Puja • Marc • Nathalie</p><button class="gold-btn" id="restart">PLAY AGAIN</button></div>`;
      $("#restart").onclick=()=>{stopTrack();localStorage.removeItem("wwgb-host-state");location.reload()};
      return;
    }
    const q=QUESTIONS[hostState.question];
    const reveal=hostState.reveal;
    app.innerHTML=`
      <div class="game-shell">
        <div class="top-title"><span>WHO WANTS TO BE A</span> GRANDPARENT?</div>
        <div class="game-main">
          <div class="ladder">${[...QUESTIONS].map((x,i)=>`<div class="ladder-row ${i===hostState.question?'active':''} ${i<hostState.question?'done':''}"><span>${i+1}</span><b>${x.value}</b></div>`).reverse().join("")}</div>
          <div class="question-stage">
            <div class="q-number">QUESTION ${hostState.question+1} / 15</div>
            <div class="question-box">${esc(q.q)}</div>
            <div class="answers">
              ${q.a.map((a,i)=>{
                const visible=reveal>=i+1;
                const isCorrect=hostState.revealed && i===q.c;
                const selections=PLAYERS.filter(p=>hostState.locked[p.id] && hostState.selected[p.id]===i).map(p=>p.name);
                return `<div class="answer ${visible?'visible':''} ${isCorrect?'correct':''} ${hostState.revealed&&i!==q.c?'dim':''}">
                  <span class="letter">${"ABCD"[i]}</span><span>${esc(a)}</span>${selections.length?`<small>🔒 ${selections.join(", ")}</small>`:""}
                </div>`;
              }).join("")}
            </div>
            <div class="lock-status">${PLAYERS.map(p=>`<span class="${hostState.locked[p.id]?'locked':''}">${hostState.locked[p.id]?'🔒':'○'} ${p.name}</span>`).join("")}</div>
            ${reveal===5?'<div class="suspense">LOCKED IN...<br><strong>LET\'S SEE IF YOU ARE RIGHT</strong></div>':''}
            ${reveal===6?'<div class="suspense">THE CORRECT ANSWER IS...</div>':''}
            ${hostState.revealed?`<div class="result ${PLAYERS.every(p=>hostState.selected[p.id]===q.c)?'all-right':''}">${PLAYERS.every(p=>hostState.selected[p.id]===q.c)?'ALL THREE ARE CORRECT!':'THE ANSWER IS '+("ABCD"[q.c])}<br><strong>+${q.value} BABY HOURS</strong></div>`:""}
          </div>
        </div>
        <div class="bottom-bar"><span>→ / SPACE: NEXT</span><span>H: HOST CONTROLS</span><span>ROOM: ${roomCode}</span></div>
      </div>`;
  }

  function makeQR(){
    const url=new URL(location.href);
    url.search="?join="+encodeURIComponent(roomCode);
    url.hash="";
    const text=url.toString();
    const el=$("#qr");
    if(!el) return;

    el.innerHTML="";
    el.setAttribute("aria-label","Scan this QR code to join the game");

    // Primary: render locally with the QRCode library already loaded by index.html.
    if(window.QRCode && typeof QRCode.toCanvas==="function"){
      try{
        QRCode.toCanvas(text,{
          width:190,
          margin:2,
          color:{dark:"#ffffff",light:"#0a0b2d"},
          errorCorrectionLevel:"M"
        },(err,canvas)=>{
          if(!err && canvas){
            canvas.style.display="block";
            canvas.style.width="190px";
            canvas.style.height="190px";
            el.appendChild(canvas);
            return;
          }
          renderQRFallback(el,text);
        });
        return;
      }catch(e){
        renderQRFallback(el,text);
        return;
      }
    }

    // Fallback: use a QR image endpoint if the local library was blocked by a
    // browser/CDN issue. The actual join URL is encoded into the image.
    renderQRFallback(el,text);
  }

  function renderQRFallback(el,text){
    const img=document.createElement("img");
    img.alt="Scan to join the game";
    img.width=190;
    img.height=190;
    img.style.display="block";
    img.style.width="190px";
    img.style.height="190px";
    img.src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=4&data="+encodeURIComponent(text);
    img.onerror=()=>{
      el.innerHTML='<div style="width:190px;height:190px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;color:#fff;background:#0a0b2d;border:1px solid rgba(255,255,255,.25);padding:12px;box-sizing:border-box">QR unavailable.<br>Enter room code<br><strong>'+String(roomCode).replace(/[&<>"']/g,"")+'</strong><br>on the join page.</div>';
    };
    el.appendChild(img);
  }

  function renderPlayer(){
    if(!player){
      app.innerHTML=`<div class="phone join"><div class="eyebrow">RADHIKA'S GODH BHARAI</div><h1>WHO WANTS TO BE A<br><span>GRANDPARENT?</span></h1><p>Who are you?</p><div class="player-choices">${PLAYERS.map(p=>`<button data-id="${p.id}">${p.name}<small>${p.role}</small></button>`).join("")}</div><p class="phone-note">Each grandparent gets their own three jokers.</p></div>`;
      document.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>joinAs(b.dataset.id));
      return;
    }

    if(hostState.phase==="intro"){
      app.innerHTML=`<div class="phone waiting"><div class="eyebrow">YOU ARE ${player.name.toUpperCase()}</div><div class="phone-icon">★</div><h1>GET READY</h1><p>Waiting for Martin to start the game...</p><div class="connected">● CONNECTED</div><div class="jokers waiting-jokers"><button disabled>🍼<span>Diaper<br>Surprise</span></button><button disabled>📞<span>Call the<br>Dad</span></button><button disabled>👨‍👩‍👧<span>Ask the<br>Parents</span></button></div></div>`;
      return;
    }

    if(hostState.phase==="finished"){
      app.innerHTML=`<div class="phone waiting"><div class="phone-icon">★</div><h1>CONGRATULATIONS!</h1><p>What a grandparent.</p></div>`;
      return;
    }

    const q=QUESTIONS[hostState.question];
    const disabled=localDisabledAnswers||[];
    const allVisible=hostState.reveal>=4;
    const canUseJokers=allVisible && !localLocked && !hostState.revealed;
    const life=hostState.lifelines?.[player.id]||{fifty:true,dad:true,parents:true};

    app.innerHTML=`<div class="phone player-game">
      <div class="phone-head"><div>GRANDPARENT</div><b>${player.name}</b><span>Q${hostState.question+1}</span></div>
      <div class="phone-prize">${q.value}<small>BABY HOURS</small></div>
      <div class="phone-question">${esc(q.q)}</div>
      <div class="phone-answers">${q.a.map((a,i)=>`<button class="${localAnswer===i?'chosen':''} ${disabled.includes(i)?'disabled':''} ${hostState.revealed&&i===q.c?'correct':''} ${hostState.revealed&&i!==q.c?'wrong':''}" ${disabled.includes(i)||localLocked?'disabled':''} data-answer="${i}"><b>${"ABCD"[i]}</b>${esc(a)}</button>`).join("")}</div>
      <button class="lock-btn" ${localAnswer===null||localLocked||!allVisible?'disabled':''}>${localLocked?'🔒 ANSWER LOCKED':'LOCK IN ANSWER'}</button>
      <div class="jokers">
        <button data-j="fifty" ${!life.fifty||!canUseJokers?'disabled':''}>🍼<span>Diaper<br>Surprise</span></button>
        <button data-j="dad" ${!life.dad||!canUseJokers?'disabled':''}>📞<span>Call the<br>Dad</span></button>
        <button data-j="parents" ${!life.parents||!canUseJokers?'disabled':''}>👨‍👩‍👧<span>Ask the<br>Parents</span></button>
      </div>
      ${localLifelineNotice?`<div class="lifeline-notice">${esc(localLifelineNotice)}</div>`:""}
      <div class="phone-status">${localLocked?'Waiting for the other grandparents to lock in...':!allVisible?'Watch the TV — the answers will appear one at a time.':'Choose your answer.'}</div>
    </div>`;

    document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>chooseAnswer(+b.dataset.answer));
    $(".lock-btn").onclick=lockAnswer;
    document.querySelectorAll("[data-j]").forEach(b=>b.onclick=()=>useLifeline(b.dataset.j));
  }

  function toggleHost(){
    const panel=document.getElementById("hostPanel");
    if(panel){panel.classList.toggle("open");}
  }

  window.addEventListener("keydown",e=>{
    if(e.key.toLowerCase()==="h"){toggleHost(); return;}
    if(role!=="host") return;
    if(e.key==="ArrowRight"||e.key===" "){e.preventDefault();revealNext();}
    if(e.key==="ArrowLeft"){e.preventDefault();back();}
    if(e.key==="1") hostLifeline("fifty");
    if(e.key==="2") hostLifeline("dad");
    if(e.key==="3") hostLifeline("parents");
    if(e.key==="Escape"){document.getElementById("hostPanel")?.classList.remove("open");}
  });

  function installHostPanel(){
    if(role!=="host") return;
    const panel=document.createElement("aside");
    panel.id="hostPanel";
    panel.className="host-panel";
    panel.innerHTML=`<div class="host-head"><strong>HOST CONTROL — MARTIN</strong><button id="closeHost">×</button></div><div id="hostStatus"></div><div class="host-grid"><button data-a="back">← Back</button><button data-a="next">Next →</button></div><div class="host-section-title">Emergency overrides</div><div class="host-grid"><button data-a="correct">✓ Mark correct</button><button data-a="wrong">✕ Mark wrong</button></div><p class="host-help">The grandparents use their own phones for answers and jokers.</p>`;
    document.body.appendChild(panel);
    $("#closeHost").onclick=()=>panel.classList.remove("open");
    panel.querySelector('[data-a="next"]').onclick=revealNext;
    panel.querySelector('[data-a="back"]').onclick=back;
    panel.querySelector('[data-a="correct"]').onclick=()=>{hostState.revealed=true;hostState.reveal=7;hostState.result=QUESTIONS[hostState.question].c;broadcastState();render()};
    panel.querySelector('[data-a="wrong"]').onclick=()=>{hostState.revealed=true;hostState.reveal=7;hostState.result=QUESTIONS[hostState.question].c;broadcastState();render()};
  }

  loadHost();
  if(role==="host") setTimeout(syncMusic,100);
  if(role==="player"){
    const saved=localStorage.getItem("wwgb-player");
    if(saved) player=PLAYERS.find(p=>p.id===saved)||null;
    if(joinCode) connect(joinCode);
    else render();
  } else {
    roomCode=localStorage.getItem("wwgb-room")||null;
    render();
    installHostPanel();
    if(roomCode) connect(roomCode);
  }
})();