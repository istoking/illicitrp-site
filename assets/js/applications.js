(function(){
  function esc(s){ return (s||'').toString().trim(); }
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
        '<span>Copy this into your Discord ticket. Use the correct ticket option for Join Application or Whitelist Application.</span>',
        '<div class="actions" style="margin-top:12px">',
          '<button class="btn primary" id="copyBtn">Copy to Clipboard</button>',
          '<a class="btn" href="https://discord.gg/xXru9PEFdg" target="_blank" rel="noopener">Open Discord Support</a>',
        '</div>',
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
    });
  }

  function init(){
    initJoin();
    initWhitelist();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();