(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function setPill(name, state, text){
    var el = qs('[data-pill="'+name+'"]');
    if(!el) return;
    el.classList.remove('ok','warn','bad');
    el.classList.add(state);
    el.textContent = text;
  }

  function fmt(n){ return (n===0 || n) ? String(n) : '—'; }

  function stripFiveMCodes(str){
    if(!str) return '';
    return String(str)
      .replace(/\^\d/g, '')
      .replace(/\s*\|\s*/g, ' • ')
      .replace(/\s+/g, ' ')
      .trim();
  }


  async function fetchJson(url){
    var r = await fetch(url, { cache: 'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }

  async function load(){
    window.__irpStatusUpdatedAt = null;
    var fivemCard = qs('#svc-fivem');
    var fivemMeta = fivemCard ? qs('.muted', fivemCard) : null;
    var discordMeta = qs('#discord-meta');

    // 1) Load local status.json (optional + used as fallback)
    var base = null;
    try{
      base = await fetchJson('/status.json');
    }catch(e){
      // If missing, keep defaults
    }

    // 2) Try to query live FiveM status if configured in status.json
    // Supported config:
    //  - fivem: { cfx_join: "xxxxxx" }
    //  - fivem: { dynamic_json: "https://<host>:<port>/dynamic.json" }
    //  - fivem: { info_json: "https://<host>:<port>/info.json" }
    // If none configured, we fall back to base.players/max_players if present.
    var fivemCfg = base && base.fivem ? base.fivem : null;
    var workerBase = base && base.worker && base.worker.base ? String(base.worker.base).replace(/\/$/, '') : null;

    // Helper to render a nice line
    function renderLine(hostname, players, maxPlayers){
      if(!fivemMeta) return;

      // Ensure the long details line always stays inside the card and scrolls horizontally when needed
      if(!fivemMeta.classList.contains('status-details')){
        fivemMeta.classList.add('status-details');
      }

      var parts = [];
      var cleanHost = stripFiveMCodes(hostname);
      if(cleanHost) parts.push(cleanHost);

      if(players!==null && players!==undefined && maxPlayers!==null && maxPlayers!==undefined){
        parts.push(players + ' / ' + maxPlayers + ' players');
      }

      fivemMeta.textContent = parts.length ? parts.join(' • ') : 'Status is updated from status.json when available.';
    }

    // Attempt live fetch
    // Prefer Worker API if configured (it can return both FiveM + Discord counts)
    if(workerBase){
      try{
        var w = await fetchJson(workerBase + '/status');

        // FiveM block
        if(w && w.fivem && w.fivem.online){
          setPill('fivem', 'ok', 'Online');
          renderLine(w.fivem.name, w.fivem.players, w.fivem.maxPlayers);
        } else {
          setPill('fivem', 'bad', 'Offline');
          renderLine(null, null, null);
        }

        // Discord block
        if(w && w.discord && (w.discord.members || w.discord.online || w.discord.members === 0 || w.discord.online === 0)){
          setPill('discord', 'ok', 'Online');
          if(discordMeta){
            var partsD = [];
            if(w.discord.members || w.discord.members === 0) partsD.push('Members: ' + w.discord.members);
            if(w.discord.online || w.discord.online === 0) partsD.push('Online: ' + w.discord.online);
            discordMeta.textContent = partsD.length ? partsD.join(' • ') : 'Live counts unavailable.';
          }
        } else {
          setPill('discord', 'warn', 'Unknown');
          if(discordMeta) discordMeta.textContent = 'Live counts unavailable.';
        }

        window.__irpStatusUpdatedAt = w && w.updatedAt ? w.updatedAt : new Date().toISOString();
        return;
      }catch(e){
        // Worker failed; fall back to direct FiveM fetch
        setPill('discord', 'warn', 'Unknown');
        if(discordMeta) discordMeta.textContent = 'Live counts unavailable.';
      }
    }

    if(fivemCfg && (fivemCfg.cfx_join || fivemCfg.dynamic_json || fivemCfg.info_json)){
      try{
        if(fivemCfg.cfx_join){
          // Cfx.re server single endpoint
          var data = await fetchJson('https://servers-frontend.fivem.net/api/servers/single/' + encodeURIComponent(fivemCfg.cfx_join));
          var d = data && data.Data ? data.Data : null;
          var hostname = d && d.hostname ? d.hostname : null;
          var players = d && typeof d.clients === 'number' ? d.clients : null;
          var maxPlayers = d && typeof d.sv_maxclients === 'number' ? d.sv_maxclients : null;

          setPill('fivem', 'ok', 'Online');
          renderLine(hostname, players, maxPlayers);
          window.__irpStatusUpdatedAt = new Date().toISOString();

          // Discord pill may exist on the page; keep it neutral if we didn't load via worker
          setPill('discord', 'warn', 'Unknown');
          if(discordMeta) discordMeta.textContent = 'Connect Discord counts via the status worker.';
          return;
        }

        // Direct server endpoints
        if(fivemCfg.dynamic_json){
          var dyn = await fetchJson(fivemCfg.dynamic_json);
          // dynamic.json often includes clients + sv_maxclients + hostname
          var hostname2 = dyn && (dyn.hostname || dyn.servername) ? (dyn.hostname || dyn.servername) : null;
          var players2 = dyn && typeof dyn.clients === 'number' ? dyn.clients : null;
          var maxPlayers2 = dyn && typeof dyn.sv_maxclients === 'number' ? dyn.sv_maxclients : null;

          setPill('fivem', 'ok', 'Online');
          renderLine(hostname2, players2, maxPlayers2);
          return;
        }

        if(fivemCfg.info_json){
          var info = await fetchJson(fivemCfg.info_json);
          // info.json varies by build; keep it simple
          setPill('fivem', 'ok', 'Online');
          renderLine(info && info.vars && info.vars.sv_projectName ? info.vars.sv_projectName : null, null, null);
          return;
        }
      }catch(e){
        setPill('fivem', 'bad', 'Offline');
        window.__irpStatusUpdatedAt = new Date().toISOString();
        renderLine(null, null, null);
        return;
      }
    }

    // Fallback: use values from status.json if present
    if(base){
      if(base.status && typeof base.status === 'string'){
        // overall status isn't used for the pills except a basic hint
      }
      if(base.players !== null && base.players !== undefined){
        setPill('fivem', 'warn', 'Unknown');
        renderLine(null, base.players, base.max_players);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
