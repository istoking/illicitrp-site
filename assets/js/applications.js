(function(){
  // Applications: direct-submit to Worker endpoints
  // Pages:
  //  - /applications/server-whitelist.html  -> POST /applications/server
  //  - /applications/whitelisted-job.html   -> POST /applications/job
  //  - /applications/staff.html            -> POST /applications/staff

  var SITE_CFG = null;

  async function fetchFirstJson(paths){
    for(var i=0;i<paths.length;i++){
      try{
        var r = await fetch(paths[i], { cache: 'no-store' });
        if(!r.ok) continue;
        return await r.json();
      }catch(_){}
    }
    return {};
  }

  async function loadSiteConfig(){
    if(SITE_CFG !== null) return SITE_CFG;
    SITE_CFG = await fetchFirstJson([
      '/status.json',
      '../status.json',
      './status.json',
      '../../status.json'
    ]);
    return SITE_CFG;
  }

  async function loadWorkerBase(){
    var cfg = await loadSiteConfig();
    var base = (cfg && cfg.worker && cfg.worker.base) ? String(cfg.worker.base).replace(/\/$/, '') : '';
    return base;
  }

  function showMsg(el, ok, title, text){
    if(!el) return;
    el.style.display = 'block';
    el.innerHTML = [
      '<div class="result">',
        '<strong>' + escapeHtml(title) + '</strong>',
        '<span>' + escapeHtml(text) + '</span>',
      '</div>'
    ].join('');
    el.classList.toggle('ok', !!ok);
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  function formToObject(form){
    var obj = {};
    Array.prototype.forEach.call(form.elements, function(el){
      if(!el.name) return;
      if(el.type === 'submit') return;
      if(el.type === 'checkbox'){
        obj[el.name] = !!el.checked;
        return;
      }
      obj[el.name] = (el.value || '').toString().trim();
    });
    return obj;
  }

  function enforceMinLengths(form){
    // If minlength is present, ensure it is met (some browsers are lax on textarea)
    var bad = null;
    Array.prototype.forEach.call(form.querySelectorAll('[minlength]'), function(el){
      var min = parseInt(el.getAttribute('minlength') || '0', 10);
      if(!min) return;
      var v = (el.value || '').trim();
      if(v.length < min){
        bad = bad || el;
      }
    });
    if(bad){
      bad.focus();
      bad.scrollIntoView({ behavior:'smooth', block:'center' });
      return false;
    }
    return true;
  }

  async function submit(endpoint, payload, msgEl){
    var base = await loadWorkerBase();
    if(!base){
      showMsg(msgEl, false, 'Submit failed', 'Worker base is not configured (status.json missing worker.base).');
      return;
    }

    showMsg(msgEl, true, 'Submitting…', 'Sending your application to staff.');
    try{
      var r = await fetch(base + endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      var j = null;
      try{ j = await r.json(); }catch(_){}
      if(r.ok && (!j || j.ok === true || j.success === true)){
        showMsg(msgEl, true, 'Submitted', 'Application sent. Staff will review and contact you via Discord if needed.');
      }else{
        showMsg(msgEl, false, 'Submit failed', (j && j.error) ? String(j.error) : 'Request failed. Please try again later.');
      }
    }catch(e){
      showMsg(msgEl, false, 'Submit failed', 'Network error. Please try again later.');
    }
  }

  function initServer(){
    var form = document.getElementById('appServerForm');
    if(!form) return;
    var msgEl = document.getElementById('appServerMsg');

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!form.reportValidity()) return;
      if(!enforceMinLengths(form)) return;

      var data = formToObject(form);
      data.type = 'server';
      submit('/applications/server', data, msgEl);
    });
  }

  function initJob(){
    var form = document.getElementById('appJobForm');
    if(!form) return;
    var msgEl = document.getElementById('appJobMsg');

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!form.reportValidity()) return;
      if(!enforceMinLengths(form)) return;

      var data = formToObject(form);
      data.type = 'job';
      submit('/applications/job', data, msgEl);
    });
  }

  function initStaff(){
    var form = document.getElementById('appStaffForm');
    if(!form) return;
    var msgEl = document.getElementById('appStaffMsg');

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!form.reportValidity()) return;
      if(!enforceMinLengths(form)) return;

      var data = formToObject(form);
      data.type = 'staff';
      submit('/applications/staff', data, msgEl);
    });
  }

  initServer();
  initJob();
  initStaff();
})();