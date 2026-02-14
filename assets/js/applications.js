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

  function allFieldsFilled(payload){
    // Only attempt silent staff logging when every field has been filled out.
    // (Players should never see submit failures.)
    if(!payload || typeof payload !== 'object') return false;
    for (var k in payload){
      if(!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      if(k === 'type') continue;
      var v = payload[k];
      if(v === null || v === undefined) return false;
      if(String(v).trim().length === 0) return false;
    }
    return true;
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
        '<span>Copy the submission, then open a Discord support ticket and paste it.</span>',
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
    copyBtn.addEventListener('click', function(){
      copyBtn.disabled = true;
      msgEl.style.display = 'block';
      msgEl.textContent = 'Copying to clipboard…';
      copyToClipboard(text).then(function(){
        copyBtn.textContent = 'Copied';
        // Player-facing message should never mention auto-submit.
        msgEl.textContent = 'Copied to clipboard. Open Discord Support and submit via a ticket.';

        // Silent staff logging (only when the user completed every field)
        if(allFieldsFilled(payload)){
          submitToStaff(payload).catch(function(){});
        }
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
    if(!base) return;

    try{
      var r = await fetch(base + '/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Swallow errors silently (admin logging only)
      if(!r.ok) return;
      // If worker returns JSON, still allow it to be read (but ignored)
      try { await r.json(); } catch(_) {}
    }catch(e){
      // silent
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

      var payload = {
        type: 'Join Application',
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

      // Worker requires a name + discord. This form doesn't ask for a separate name, so use Discord as name.
      payload.name = payload.discord;

      renderOutput(out, text, payload);

      // Silent staff logging on generate (only when all fields filled)
      if(allFieldsFilled(payload)){
        submitToStaff(payload).catch(function(){});
      }
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

      var payload = {
        type: 'Whitelist Application',
        discord: esc(document.getElementById('w_discord').value),
        role: esc(document.getElementById('w_role').value),
        why_this_role: esc(document.getElementById('w_why').value),
        under_pressure: esc(document.getElementById('w_pressure').value),
        neutrality_professionalism: esc(document.getElementById('w_neutral').value),
        knowledge_check: esc(document.getElementById('w_knowledge').value),
        availability: esc(document.getElementById('w_avail').value)
      };

      // Worker requires a name + discord. This form doesn't ask for a separate name, so use Discord as name.
      payload.name = payload.discord;

      renderOutput(out, text, payload);

      // Silent staff logging on generate (only when all fields filled)
      if(allFieldsFilled(payload)){
        submitToStaff(payload).catch(function(){});
      }
    });
  }

  function init(){
    initJoin();
    initWhitelist();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();