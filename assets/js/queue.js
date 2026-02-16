(function(){
  const $ = (s, r=document) => r.querySelector(s);

  async function getWorkerBase(){
    // status.json contains { worker: { base: "https://..." } } in this project
    const res = await fetch('/status.json', { cache: 'no-store' });
    const data = await res.json();
    return (data && data.worker && data.worker.base) ? data.worker.base.replace(/\/+$/,'') : '';
  }

  function setText(id, txt){
    const el = document.getElementById(id);
    if(el) el.textContent = txt;
  }

  function show(el, on){ if(!el) return; el.style.display = on ? '' : 'none'; }

  function loadBeep(){
    const a = new Audio('/assets/sfx/Alert.ogg');
    a.preload = 'auto';
    return () => { try{ a.currentTime = 0; a.play().catch(()=>{}); }catch{} };
  }

  const beep = loadBeep();

  async function api(base, path, opts){
    const res = await fetch(base + path, Object.assign({ credentials: 'include' }, opts || {}));
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json().catch(()=>null) : await res.text().catch(()=>null);
    return { ok: res.ok, status: res.status, body };
  }

  async function init(){
    const base = await getWorkerBase();
    if(!base){
      setText('qStatus', 'Queue backend not configured (worker.base missing).');
      return;
    }

    const btnLogin = $('#btnLogin');
    const btnNormal = $('#btnJoinNormal');
    const btnPolice = $('#btnJoinPolice');
    const btnLeave = $('#btnLeave');
    const btnConnect = $('#btnConnect');

    let ticket = null;
    let lastReady = false;

    async function refreshMe(){
      const r = await api(base, '/api/me');
      if(!r.ok){
        show($('#authed'), false);
        show($('#unauthed'), true);
        btnPolice.disabled = true;
        return;
      }
      show($('#unauthed'), false);
      show($('#authed'), true);
      const canPolice = !!(r.body && r.body.canPoliceQueue);
      btnPolice.disabled = !canPolice;
      setText('qMe', r.body && r.body.user ? `${r.body.user.username}` : 'Authenticated');
      if(!canPolice){
        setText('qPoliceNote', 'Priority queue requires a Police / EMS / Fire role.');
      } else {
        setText('qPoliceNote', 'Priority queue available (Police / EMS / Fire).');
      }
    }

    async function join(type){
      const r = await api(base, '/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if(!r.ok){
        const msg = (r.body && r.body.message) ? r.body.message : 'Join failed';
        setText('qStatus', msg);
        return;
      }
      ticket = r.body.ticket;
      setText('qStatus', `Joined ${type} queue.`);
      poll();
    }

    async function leave(){
      if(!ticket){
        // still try to leave by session
      }
      const r = await api(base, '/api/queue/leave', { method: 'POST' });
      ticket = null;
      lastReady = false;
      show(btnConnect, false);
      setText('qStatus', r.ok ? 'Left queue.' : 'Left queue (local).');
    }

    async function poll(){
      if(!ticket) return;
      const r = await api(base, `/api/queue/state?ticket=${encodeURIComponent(ticket)}`, { method: 'GET' });
      if(!r.ok || !r.body){
        ticket = null;
        setText('qStatus', 'Queue ticket expired. Rejoin.');
        show(btnConnect, false);
        return;
      }

      const st = r.body;
      setText('qPos', st.position != null ? String(st.position) : '-');
      setText('qEta', st.etaSeconds != null ? `${st.etaSeconds}s` : '-');
      setText('qPlayers', (st.players != null && st.max != null) ? `${st.players}/${st.max}` : '-');
      setText('qLane', st.queueType ? st.queueType.toUpperCase() : 'NORMAL');

      // near/full notice
      const near = (st.players != null && st.max != null && st.players >= (st.max - 1));
      show($('#qNearFull'), near);

      if(st.status === 'READY'){
        show(btnConnect, true);
        if(!lastReady){
          beep();
        }
        lastReady = true;
      } else {
        show(btnConnect, false);
        lastReady = false;
      }

      setTimeout(poll, 2000);
    }

    // wire buttons
    if(btnLogin) btnLogin.addEventListener('click', ()=>{ window.location.href = base + '/queue/auth'; });
    if(btnNormal) btnNormal.addEventListener('click', ()=>join('normal'));
    if(btnPolice) btnPolice.addEventListener('click', ()=>join('police'));
    if(btnLeave) btnLeave.addEventListener('click', leave);
    if(btnConnect) btnConnect.addEventListener('click', ()=>{
      // cfx join
      window.location.href = `https://cfx.re/join/${encodeURIComponent((window.__IRP_JOIN_CODE||'').trim() || (document.documentElement.dataset.joinCode||''))}`; 
    });

    // prefer join code from status.json if present
    try{
      const s = await fetch('/status.json', { cache:'no-store' }).then(r=>r.json());
      const jc = (s && (s.joinCode || (s.fivem && s.fivem.joinCode))) || '';
      window.__IRP_JOIN_CODE = jc;
      document.documentElement.dataset.joinCode = jc;
    }catch{}

    await refreshMe();
    // If already in queue, try to recover by calling state requires ticket; we rely on user joining each time.
  }

  document.addEventListener('DOMContentLoaded', init);
})();