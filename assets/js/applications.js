(function(){
  function esc(s){ return (s||'').toString().trim(); }

  // Worker endpoint (kept in /status.json so it is easy to change without touching multiple pages)
  var WORKER_BASE = null;
  async function loadWorkerBase(){
    if(WORKER_BASE !== null) return WORKER_BASE;
    try{
      var r = await fetch('/status.json', { cache: 'no-store' });
      if(!r.ok) { WORKER_BASE = ''; return WORKER_BASE; }
      var j = await r.json();
      WORKER_BASE = (j && j.worker && j.worker.base) ? String(j.worker.base).replace(/\/$/, '') : '';
      return WORKER_BASE;
    }catch(e){
      WORKER_BASE = '';
      return WORKER_BASE;
    }
  }
  function makeBlock(title, fields){
    var out = [];
    out.push('**' + title + '**');
    out.push('');
    fields.forEach(function(f){
      out.push('**' + f.label + ':** ' + (f.value || ''));
      if(f.multiline && f.value){
        out.push('');
        out.push('```');
        out.push(f.value);
        out.push('```');
      }
    });
    return out.join('\n');
  }

  function copyToClipboard(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function renderOutput(targetEl, text){
    targetEl.style.display = 'block';
    targetEl.innerHTML = [
      '<div class="result" style="cursor:default">',
        '<strong>Submission generated</strong>',
        '<span>You can copy this into a ticket, or submit it directly to staff.</span>',
        '<div class="actions" style="margin-top:12px">',
          '<button class="btn primary" id="copyBtn">Copy to Clipboard</button>',
          '<button class="btn" id="submitBtn" type="button">Submit to Staff</button>',
          '<a class="btn" href="https://discord.gg/xXru9PEFdg" target="_blank" rel="noopener">Open Discord Support</a>',
        '</div>',
        '<div class="muted" id="submitMsg" style="margin-top:10px; display:none;"></div>',
        '<pre style="white-space:pre-wrap; margin-top:12px; border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:12px; background: rgba(0,0,0,.18)"></pre>',
      '</div>'
    ].join('');
    targetEl.querySelector('pre').textContent = text;
    targetEl.querySelector('#copyBtn').addEventListener('click', function(){
      copyToClipboard(text).then(function(){
        targetEl.querySelector('#copyBtn').textContent = 'Copied';
        setTimeout(function(){ targetEl.querySelector('#copyBtn').textContent = 'Copy to Clipboard'; }, 1500);
      });
    });
  }

  async function submitToStaff(payload, msgEl, btnEl){
    var base = await loadWorkerBase();
    if(!base){
      msgEl.style.display = 'block';
      msgEl.textContent = 'Direct submission is not configured yet. Please use Copy to Clipboard and open a ticket.';
      return;
    }
    btnEl.disabled = true;
    msgEl.style.display = 'block';
    msgEl.textContent = 'Submitting…';

    try{
      var r = await fetch(base + '/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var j = null;
      try { j = await r.json(); } catch(_) {}
      if(!r.ok || !j || j.ok !== true){
        msgEl.textContent = 'Submission failed. Please copy to clipboard and submit via a ticket.';
      } else {
        msgEl.textContent = 'Submitted to staff successfully.';
      }
    }catch(e){
      msgEl.textContent = 'Submission failed. Please copy to clipboard and submit via a ticket.';
    } finally {
      btnEl.disabled = false;
    }
  }

  function initJoin(){
    var btn = document.getElementById('appBuild');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var fields = [
        {label:'Discord', value:esc(document.getElementById('a_discord').value)},
        {label:'Timezone', value:esc(document.getElementById('a_tz').value)},
        {label:'Age bracket', value:esc(document.getElementById('a_age').value)},
        {label:'RP experience', value:esc(document.getElementById('a_exp').value)},
        {label:'Character concept', value:esc(document.getElementById('q_char').value), multiline:true},
        {label:'Handling loss', value:esc(document.getElementById('q_loss').value), multiline:true},
        {label:'Conflict and escalation', value:esc(document.getElementById('q_escalation').value), multiline:true},
        {label:'Mechanical issues mid-scene', value:esc(document.getElementById('q_mech').value), multiline:true},
        {label:'Accountability', value:esc(document.getElementById('q_account').value), multiline:true},
        {label:'Staff interaction', value:esc(document.getElementById('q_staff').value), multiline:true},
        {label:'Final note', value:esc(document.getElementById('q_final').value), multiline:true},
      ];
      var text = makeBlock('IRP Join Application', fields);
      var out = document.getElementById('appOutWrap');
      renderOutput(out, text);

      // Hook submit button to Worker
      var submitBtn = out.querySelector('#submitBtn');
      var msgEl = out.querySelector('#submitMsg');
      submitBtn.addEventListener('click', function(){
        var payload = {
          type: 'Join Application',
          name: esc(document.getElementById('a_name') ? document.getElementById('a_name').value : ''),
          discord: esc(document.getElementById('a_discord').value),
          timezone: esc(document.getElementById('a_tz').value),
          age_bracket: esc(document.getElementById('a_age').value),
          rp_experience: esc(document.getElementById('a_exp').value),
          character_concept: esc(document.getElementById('q_char').value),
          handling_loss: esc(document.getElementById('q_loss').value),
          conflict_escalation: esc(document.getElementById('q_escalation').value),
          mechanical_issues: esc(document.getElementById('q_mech').value),
          accountability: esc(document.getElementById('q_account').value),
          staff_interaction: esc(document.getElementById('q_staff').value),
          final_note: esc(document.getElementById('q_final').value)
        };
        submitToStaff(payload, msgEl, submitBtn);
      });
    });
  }

  function initWhitelist(){
    var btn = document.getElementById('wlBuild');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var fields = [
        {label:'Discord', value:esc(document.getElementById('w_discord').value)},
        {label:'Role', value:esc(document.getElementById('w_role').value)},
        {label:'Why this role', value:esc(document.getElementById('w_why').value), multiline:true},
        {label:'Under pressure', value:esc(document.getElementById('w_pressure').value), multiline:true},
        {label:'Neutrality and professionalism', value:esc(document.getElementById('w_neutral').value), multiline:true},
        {label:'Knowledge check', value:esc(document.getElementById('w_knowledge').value), multiline:true},
        {label:'Availability', value:esc(document.getElementById('w_avail').value), multiline:true},
      ];
      var text = makeBlock('IRP Whitelist Application', fields);
      var out = document.getElementById('wlOutWrap');
      renderOutput(out, text);

      var submitBtn = out.querySelector('#submitBtn');
      var msgEl = out.querySelector('#submitMsg');
      submitBtn.addEventListener('click', function(){
        var payload = {
          type: 'Whitelist Application',
          name: esc(document.getElementById('w_name') ? document.getElementById('w_name').value : ''),
          discord: esc(document.getElementById('w_discord').value),
          role: esc(document.getElementById('w_role').value),
          why_this_role: esc(document.getElementById('w_why').value),
          under_pressure: esc(document.getElementById('w_pressure').value),
          neutrality_professionalism: esc(document.getElementById('w_neutral').value),
          knowledge_check: esc(document.getElementById('w_knowledge').value),
          availability: esc(document.getElementById('w_avail').value)
        };
        submitToStaff(payload, msgEl, submitBtn);
      });
    });
  }

  function init(){
    initJoin();
    initWhitelist();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();