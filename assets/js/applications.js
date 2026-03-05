(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function esc(s){ return (s == null ? '' : String(s)).trim(); }

  // ---- Config (status.json) ----
  var SITE_CFG = null;

  async function fetchFirstJson(paths){
    for(var i=0;i<paths.length;i++){
      try{
        var r = await fetch(paths[i], { cache: 'no-store' });
        if(!r.ok) continue;
        return await r.json();
      }catch(e){}
    }
    return {};
  }

  async function loadSiteConfig(){
    if(SITE_CFG !== null) return SITE_CFG;
    try{
      SITE_CFG = await fetchFirstJson([
        '/status.json',
        '../status.json',
        './status.json',
        '../../status.json'
      ]);
      return SITE_CFG;
    }catch(e){
      SITE_CFG = {};
      return SITE_CFG;
    }
  }

  async function loadWorkerBase(){
    var cfg = await loadSiteConfig();
    var base = (cfg && cfg.worker && cfg.worker.base) ? String(cfg.worker.base).replace(/\/$/, '') : '';
    return base;
  }

  async function getSupportHref(){
    var cfg = await loadSiteConfig();
    var invite = (cfg && cfg.discord && cfg.discord.invite) ? cfg.discord.invite : null;
    return invite || 'https://discord.gg/xXru9PEFdg';
  }

  async function applySupportLinks(){
    var href = await getSupportHref();
    qsa('[data-support-link]').forEach(function(a){
      a.setAttribute('href', href);
    });
  }

  // ---- Form helpers ----
  function setStatus(el, type, msg){
    if(!el) return;
    el.style.display = 'block';
    el.className = 'callout';
    if(type === 'ok') el.style.borderLeftColor = '#1db954';
    if(type === 'warn') el.style.borderLeftColor = '#f5c542';
    if(type === 'err') el.style.borderLeftColor = '#e5484d';
    el.innerHTML = msg;
  }

  function disable(btn, on){
    if(!btn) return;
    btn.disabled = !!on;
    btn.setAttribute('aria-disabled', on ? 'true' : 'false');
  }

  function collectPayload(form){
    var payload = {};
    qsa('input, select, textarea', form).forEach(function(el){
      if(!el.name) return;
      if(el.type === 'checkbox'){
        payload[el.name] = !!el.checked;
      }else{
        payload[el.name] = esc(el.value);
      }
    });

    // Useful metadata (safe)
    payload._meta = {
      submittedAt: new Date().toISOString(),
      page: location.pathname,
      ref: document.referrer || '',
      tz: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    };

    return payload;
  }

  function validate(form){
    var bad = null;
    qsa('input, select, textarea', form).some(function(el){
      if(!el.name) return false;

      if(el.hasAttribute('required')){
        if(el.type === 'checkbox'){
          if(!el.checked){ bad = el; return true; }
        }else{
          if(esc(el.value).length === 0){ bad = el; return true; }
        }
      }

      var ml = el.getAttribute('minlength');
      if(ml && esc(el.value).length > 0 && esc(el.value).length < parseInt(ml, 10)){
        bad = el; return true;
      }

      return false;
    });

    return bad;
  }

  function endpointFor(app){
    if(app === 'server') return '/applications/server';
    if(app === 'job') return '/applications/job';
    if(app === 'staff') return '/applications/staff';
    return null;
  }

  // ---- Job-specific prompt ----
  function applyJobPrompt(form){
    var sel = qs('select[name="job_role"]', form);
    var box = qs('textarea[name="job_specific"]', form);
    if(!sel || !box) return;

    function update(){
      var v = sel.value;
      var ph = 'After selecting a role above, answer with your approach and expectations for that role.';
      if(v === 'police'){
        ph = 'Police: talk escalation ladder, fairness, use of force, report writing, and how you avoid “win mindset”.';
      }else if(v === 'ems'){
        ph = 'EMS: talk triage, pacing, patient consent, keeping scenes engaging, and teamwork.';
      }else if(v === 'mechanic'){
        ph = 'Mechanic: talk building RP (not menu-shop), pricing disputes, customer handling, and scene pacing.';
      }else if(v === 'law'){
        ph = 'Law: talk fairness, accessibility, handling bias, and making cases fun for both sides.';
      }else if(v === 'business'){
        ph = 'Business/Other: talk professionalism, reliability, building RP, and how you contribute to server culture.';
      }
      box.setAttribute('placeholder', ph);
    }

    sel.addEventListener('change', update);
    update();
  }

  async function initApplicationForm(){
    var form = qs('#irpAppForm');
    if(!form) return;

    var app = form.getAttribute('data-app');
    var endpoint = endpointFor(app);
    if(!endpoint) return;

    var statusEl = qs('#appStatus');
    var btn = qs('#appSubmitBtn');

    if(app === 'job') applyJobPrompt(form);

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      var bad = validate(form);
      if(bad){
        bad.focus({ preventScroll: false });
        setStatus(statusEl, 'err', '<b>Please complete all required fields.</b> Some answers may also require more detail.');
        return;
      }

      disable(btn, true);
      setStatus(statusEl, 'warn', 'Submitting your application…');

      try{
        var base = await loadWorkerBase();
        if(!base){
          disable(btn, false);
          setStatus(statusEl, 'err', 'Worker base URL is not configured. Please contact staff.');
          return;
        }

        var payload = collectPayload(form);
        var r = await fetch(base + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        var data = null;
        try{ data = await r.json(); }catch(_e){}

        if(!r.ok){
          var msg = (data && data.error) ? data.error : ('Submission failed (HTTP ' + r.status + ').');
          disable(btn, false);
          setStatus(statusEl, 'err', '<b>Could not submit your application.</b><br>' + msg);
          return;
        }

        setStatus(statusEl, 'ok', '<b>Application submitted!</b> Staff will review it in Discord. You may be contacted for follow-up questions.');
        form.reset();
        if(app === 'job') applyJobPrompt(form); // reset placeholder
      }catch(err){
        disable(btn, false);
        setStatus(statusEl, 'err', '<b>Network error.</b> Please try again in a moment.');
      }
    });
  }

  async function init(){
    await applySupportLinks();
    await initApplicationForm();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();