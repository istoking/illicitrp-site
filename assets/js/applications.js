(function(){
  function esc(s){ return (s||'').toString().trim(); }

  // Site config (kept in /status.json so it is easy to change without touching multiple pages)
  var SITE_CFG = null;

  async function fetchFirstJson(paths){
    for(var i=0;i<paths.length;i++){
      try{
        var r = await fetch(paths[i], { cache: 'no-store' });
        if(!r.ok) continue;
        return await r.json();
      }catch(e){
        // keep trying
      }
    }
    return {};
  }

  async function loadSiteConfig(){
    if(SITE_CFG !== null) return SITE_CFG;
    try{
      // Support GitHub Pages sub-path deployments (e.g. /repo/...) by trying relative fallbacks.
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
    var invite = (cfg && cfg.discord && cfg.discord.invite) ? String(cfg.discord.invite) : 'https://discord.gg/xXru9PEFdg';
    var guildId = (cfg && cfg.discord && cfg.discord.guild_id) ? String(cfg.discord.guild_id) : '';
    var channelId = (cfg && cfg.discord && cfg.discord.support_channel_id) ? String(cfg.discord.support_channel_id) : '';
    if(guildId && channelId){
      return 'https://discord.com/channels/' + guildId + '/' + channelId;
    }
    return invite;
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

  // Render immediately so the UI always opens, even if config fetch is slow/hangs.
  function renderOutput(targetEl, text, payload){
    targetEl.style.display = 'block';
    targetEl.innerHTML = [
      '<div class="result" style="cursor:default">',
        '<strong>Submission generated</strong>',
        '<span>Copy to clipboard, then open Discord Support and submit via a ticket.</span>',
        '<div class="actions" style="margin-top:12px">',
          '<button class="btn primary" id="copyBtn">Copy to Clipboard</button>',
          '<a class="btn" id="supportBtn" target="_blank" rel="noopener">Open Discord Support</a>',
        '</div>',
        '<div class="muted" id="submitMsg" style="margin-top:10px; display:none;"></div>',
        '<pre style="white-space:pre-wrap; margin-top:12px; border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:12px; background: rgba(0,0,0,.18)"></pre>',
      '</div>'
    ].join('');
    targetEl.querySelector('pre').textContent = text;

    // Support link (channel deep-link when available, otherwise invite)
    var supportBtn = targetEl.querySelector('#supportBtn');
    supportBtn.href = 'https://discord.gg/xXru9PEFdg';
    supportBtn.title = 'Opens the IRP Discord support channel. If you are not in the server yet, you may be prompted to join.';
    // Update href asynchronously once config is loaded (non-blocking)
    getSupportHref().then(function(href){
      if(href) supportBtn.href = href;
    }).catch(function(){});

    var msgEl = targetEl.querySelector('#submitMsg');
    var copyBtn = targetEl.querySelector('#copyBtn');

    // Auto-submit is for staff logging only. It should be silent and only run
    // when the applicant has filled out every field.
    var canAutoSubmit = !!(payload && payload.__can_auto_submit);
    var submittedOnce = false;
    function silentSubmitOnce(){
      if(!canAutoSubmit || submittedOnce) return;
      submittedOnce = true;
      submitToStaff(payload).catch(function(){ /* silent */ });
    }

    // Attempt staff logging once upon generation (silent).
    silentSubmitOnce();
    copyBtn.addEventListener('click', function(){
      copyBtn.disabled = true;
      msgEl.style.display = 'block';
      msgEl.textContent = 'Copying to clipboard…';
      copyToClipboard(text).then(function(){
        copyBtn.textContent = 'Copied';
        // Applicant-facing UX: only confirm copy + next step.
        msgEl.textContent = 'Copied to clipboard. Open Discord Support and submit via a ticket.';
        // Staff logging: silent best-effort.
        silentSubmitOnce();
      }).catch(function(){
        msgEl.textContent = 'Copy failed. Please manually select the text below and copy it, then use Open Discord Support.';
      }).finally(function(){
        copyBtn.disabled = false;
        setTimeout(function(){ copyBtn.textContent = 'Copy to Clipboard'; }, 1500);
      });
    });
  }

  async function submitToStaff(payload){
    var base = await loadWorkerBase();
    if(!base) return false;

    try{
      var r = await fetch(base + '/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Accept either JSON {ok:true} / {success:true} OR any 2xx with a non-JSON body.
      var j = null;
      try { j = await r.json(); } catch(_) {}
      var ok = !!r.ok;
      if(j && typeof j === 'object'){
        if(j.ok === true || j.success === true) ok = true;
        else if('ok' in j || 'success' in j) ok = false;
      }

      return ok;
    }catch(e){
      return false;
    }
  }

  function allFilled(values){
    for(var i=0;i<values.length;i++){
      if(!esc(values[i])) return false;
    }
    return true;
  }

  function initJoin(){
    var btn = document.getElementById('appBuild');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var required = [
        document.getElementById('a_name') ? document.getElementById('a_name').value : '',
        document.getElementById('a_discord').value,
        document.getElementById('a_tz').value,
        document.getElementById('a_age').value,
        document.getElementById('a_exp').value,
        document.getElementById('q_char').value,
        document.getElementById('q_loss').value,
        document.getElementById('q_escalation').value,
        document.getElementById('q_mech').value,
        document.getElementById('q_account').value,
        document.getElementById('q_staff').value,
        document.getElementById('q_final').value
      ];
      var canAutoSubmit = allFilled(required);
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

      // Internal flag to control staff logging behavior.
      payload.__can_auto_submit = canAutoSubmit;

      renderOutput(out, text, payload);
    });
  }

  function initWhitelist(){
    var btn = document.getElementById('wlBuild');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var required = [
        document.getElementById('w_name') ? document.getElementById('w_name').value : '',
        document.getElementById('w_discord').value,
        document.getElementById('w_role').value,
        document.getElementById('w_why').value,
        document.getElementById('w_pressure').value,
        document.getElementById('w_neutral').value,
        document.getElementById('w_knowledge').value,
        document.getElementById('w_avail').value
      ];
      var canAutoSubmit = allFilled(required);
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

      // Internal flag to control staff logging behavior.
      payload.__can_auto_submit = canAutoSubmit;

      renderOutput(out, text, payload);
    });
  }

  function init(){
    initJoin();
    initWhitelist();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();