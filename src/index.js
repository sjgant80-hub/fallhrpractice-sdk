// fallhrpractice SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallhrpractice/index.html · 66978 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallhrpractice" }); }
    else go();
  })();
'use strict';
const TOOLNAME='fallhrpractice',VERSION='1.0.0',PRIME=1021,STORE='fallhrpractice-v1';
const TABS=[{id:'dashboard',label:'dashboard'},{id:'payroll',label:'payroll runs'},{id:'employees',label:'employees'},{id:'pension',label:'pension'},{id:'holiday',label:'holiday accrual'},{id:'sickness',label:'sickness & SSP'},{id:'returns',label:'HMRC returns'},{id:'compliance',label:'compliance'},{id:'qa',label:'Q&A'}];
const RULES={
  personalAllowance:12570,
  basicBand:37700,
  basicRate:0.20,higherRate:0.40,additionalRate:0.45,
  niEmployerRate:0.138,niEmployerThreshold:9100,
  niEmployeePrimaryThreshold:12570,niEmployeeUpperThreshold:50270,
  niEmployeeMainRate:0.08,niEmployeeUpperRate:0.02,
  pensionEmployer:0.03,pensionEmployee:0.05,
  pensionLowerBand:6240,pensionUpperBand:50270,
  sspWeekly:118.75,sspWaitingDays:3,sspMaxWeeks:28,
  smpFlatWeekly:184.03,smpHigherWeeks:6,smpFlatWeeks:33,
  nlw21Plus:11.44, // 2024 rate; 2025-26 figure updates
  redundancyWeeklyCap:719,
  apprenticeshipLevyThreshold:3000000,
  apprenticeshipLevyRate:0.005,
  employmentAllowance:5000,
};
let state={active:'dashboard',firm:null,employees:[],payrollRuns:[],pensionRuns:[],sicknessEpisodes:[],hmrcReturns:[],compliance:[],audit:[],
  ui:{chat:[]},settings:{anthropicKey:'',auditChain:true}};
const $=(s,p=document)=>p.querySelector(s);const uid=p=>(p||'')+'_'+Math.random().toString(36).slice(2,11);const now=()=>Date.now();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>{const v=Number(n);return isNaN(v)?'—':'£'+v.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})};
const pct=n=>(n*100).toFixed(1)+'%';
const dateStr=ts=>{if(!ts)return '—';return new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1900)}
async function sha256(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
let db;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=e=>{const d=e.target.result;['state','audit','firms','employees','payrollRuns','pensionRuns','sicknessEpisodes','hmrcReturns'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:s==='state'?undefined:'id'})})};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=rej})}
function idbGetAll(s){return new Promise(res=>{const tx=db.transaction(s,'readonly');const q=tx.objectStore(s).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
function idbGet(s,k){return new Promise(res=>{const tx=db.transaction(s,'readonly');const q=tx.objectStore(s).get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}
function idbPut(s,v,k){return new Promise(res=>{const tx=db.transaction(s,'readwrite');const o=tx.objectStore(s);const q=k!=null?o.put(v,k):o.put(v);q.onsuccess=()=>res(true);q.onerror=()=>res(false)})}
async function loadAll(){if(!db)await openDB();const[firms,emps,pr,pn,sk,hr,auditArr,uiState]=await Promise.all([idbGetAll('firms'),idbGetAll('employees'),idbGetAll('payrollRuns'),idbGetAll('pensionRuns'),idbGetAll('sicknessEpisodes'),idbGetAll('hmrcReturns'),idbGetAll('audit'),idbGet('state','ui')]);state.firm=firms[0]||null;state.employees=emps;state.payrollRuns=pr;state.pensionRuns=pn;state.sicknessEpisodes=sk;state.hmrcReturns=hr;state.audit=auditArr.sort((a,b)=>a.i-b.i);if(uiState){state.ui=Object.assign({},state.ui,uiState.value||{});state.settings=Object.assign({},state.settings,uiState.settings||{});if(uiState.value?.compliance)state.compliance=uiState.value.compliance}}
async function persistUI(){await idbPut('state',{value:{...state.ui,compliance:state.compliance},settings:state.settings},'ui')}
async function auditLog(action,opts={}){if(!state.settings.auditChain)return;const prev=state.audit.length?state.audit[state.audit.length-1]:null;const i=(prev?prev.i:0)+1;const entry={id:uid('au'),i,ts:now(),tool:TOOLNAME,action,reasoning:opts.reasoning||'',configVersion:TOOLNAME+'@'+VERSION,prevHash:prev?.docHash||'',docHash:'',payload:opts.payload||{}};entry.docHash=await sha256(JSON.stringify({i,ts:entry.ts,action,prevHash:entry.prevHash,payload:entry.payload}));state.audit.push(entry);await idbPut('audit',entry)}
let bcHr,bcSignal;
function initMesh(){try{bcSignal=new BroadcastChannel('fall-signal');bcSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()})}catch(e){}try{bcHr=new BroadcastChannel('fall-hr');bcHr.addEventListener('message',async e=>{const m=e.data;if(!m||m.source===TOOLNAME)return;if(m.type==='sync.snapshot'){const p=m.payload||{};if(Array.isArray(p.employees))for(const x of p.employees){if(!state.employees.find(y=>y.id===x.id)){state.employees.push(x);await idbPut('employees',x)}}if(p.firm&&!state.firm){state.firm=p.firm;await idbPut('firms',p.firm)}render()}});bcHr.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME})}catch(e){}}
function calcPaye(annualGross){
  const pa=RULES.personalAllowance;
  const basicBandTop=pa+RULES.basicBand;
  let tax=0;
  if(annualGross>pa){tax+=Math.min(annualGross-pa,RULES.basicBand)*RULES.basicRate}
  if(annualGross>basicBandTop){tax+=Math.min(annualGross-basicBandTop,125140-basicBandTop)*RULES.higherRate}
  if(annualGross>125140){tax+=(annualGross-125140)*RULES.additionalRate}
  return tax;
}
function calcNiEmployee(annualGross){
  if(annualGross<=RULES.niEmployeePrimaryThreshold)return 0;
  const upper=Math.min(annualGross,RULES.niEmployeeUpperThreshold)-RULES.niEmployeePrimaryThreshold;
  const overUpper=Math.max(0,annualGross-RULES.niEmployeeUpperThreshold);
  return upper*RULES.niEmployeeMainRate+overUpper*RULES.niEmployeeUpperRate;
}
function calcNiEmployer(annualGross){
  if(annualGross<=RULES.niEmployerThreshold)return 0;
  return (annualGross-RULES.niEmployerThreshold)*RULES.niEmployerRate;
}
function calcPensionEmployee(annualGross,empPct){
  const band=Math.min(annualGross,RULES.pensionUpperBand)-RULES.pensionLowerBand;
  if(band<=0)return 0;
  return band*(empPct/100||RULES.pensionEmployee);
}
function calcPensionEmployer(annualGross,erPct){
  const band=Math.min(annualGross,RULES.pensionUpperBand)-RULES.pensionLowerBand;
  if(band<=0)return 0;
  return band*(erPct/100||RULES.pensionEmployer);
}
function runPayroll(period){
  // simulate monthly payroll for active employees
  const monthly=state.employees.filter(e=>e.status==='active'||e.status==='probation').map(e=>{
    const annual=Number(e.salary||0);
    const monthGross=annual/12;
    const annualTax=calcPaye(annual);
    const monthTax=annualTax/12;
    const annualNI=calcNiEmployee(annual);
    const monthNI=annualNI/12;
    const annualPensionEmp=calcPensionEmployee(annual,Number(e.pensionEmployeePct||5));
    const monthPensionEmp=annualPensionEmp/12;
    const annualPensionEr=calcPensionEmployer(annual,Number(e.pensionEmployerPct||3));
    const monthPensionEr=annualPensionEr/12;
    const annualNIEr=calcNiEmployer(annual);
    const monthNIEr=annualNIEr/12;
    const studentLoan=e.studentLoan?Math.max(0,(annual-27295)*0.09)/12:0; // assume plan 2
    const netPay=monthGross-monthTax-monthNI-monthPensionEmp-studentLoan;
    return {employeeId:e.id,name:e.firstName+' '+e.lastName,gross:monthGross,tax:monthTax,ni:monthNI,pensionEmp:monthPensionEmp,pensionEr:monthPensionEr,niEr:monthNIEr,studentLoan,netPay};
  });
  return monthly;
}
function totalGrossYTD(){return state.payrollRuns.reduce((s,r)=>s+r.lines.reduce((t,l)=>t+l.gross,0),0)}
function totalTaxYTD(){return state.payrollRuns.reduce((s,r)=>s+r.lines.reduce((t,l)=>t+l.tax,0),0)}
function totalNIYTD(){return state.payrollRuns.reduce((s,r)=>s+r.lines.reduce((t,l)=>t+l.ni+l.niEr,0),0)}
function totalPensionYTD(){return state.payrollRuns.reduce((s,r)=>s+r.lines.reduce((t,l)=>t+l.pensionEmp+l.pensionEr,0),0)}
function render(){$('#tabNav').innerHTML=TABS.map(t=>`<button class="${state.active===t.id?'active':''}" onclick="switchTab('${t.id}')">${t.label}</button>`).join('');const v=$('#view');switch(state.active){case 'dashboard':return renderDashboard(v);case 'payroll':return renderPayroll(v);case 'employees':return renderEmployees(v);case 'pension':return renderPension(v);case 'holiday':return renderHolidayAccrual(v);case 'sickness':return renderSickness(v);case 'returns':return renderReturns(v);case 'compliance':return renderCompliance(v);case 'qa':return renderQA(v)}}
function switchTab(id){state.active=id;persistUI();render()}
function renderDashboard(v){const active=state.employees.filter(e=>e.status==='active'||e.status==='probation').length;
function renderPayroll(v){v.innerHTML=`<div class="section-h"><h2>Payroll Runs</h2><div class="actions"><button class="btn brass sm" onclick="openModal('runPayroll')">+ Run Payroll</button></div></div>${state.payrollRuns.length?`<table><thead><tr><th>Period</th><th>Pay date</th><th>Employees</th><th class="num">Gross</th><th class="num">PAYE</th><th class="num">NI (er+ee)</th><th class="num">Net pay</th><th>FPS</th></tr></thead><tbody>${state.payrollRuns.sort((a,b)=>(b.payDate||'').localeCompare(a.payDate||'')).map(r=>{const g=r.lines.reduce((t,l)=>t+l.gross,0);const tx=r.lines.reduce((t,l)=>t+l.tax,0);const ni=r.lines.reduce((t,l)=>t+l.ni+l.niEr,0);const net=r.lines.reduce((t,l)=>t+l.netPay,0);return `<tr><td>${esc(r.period)}</td><td>${esc(r.payDate)}</td><td>${r.lines.length}</td><td class="num">${fmt(g)}</td><td class="num">${fmt(tx)}</td><td class="num">${fmt(ni)}</td><td class="num">${fmt(net)}</td><td><span class="pill ${r.fpsSubmitted?'green':'amber'}">${r.fpsSubmitted?'submitted':'pending'}</span></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">No payroll runs yet. Click + Run Payroll to simulate one.</div>'}`}
function renderEmployees(v){v.innerHTML=`<div class="section-h"><h2>Employees</h2><div class="sub">${state.employees.length}</div><div class="actions"><button class="btn brass sm" onclick="openModal('addEmp')">+ Employee</button></div></div>${state.employees.length?`<table><thead><tr><th>Name</th><th>NI no</th><th>Tax code</th><th class="num">Salary</th><th>Pension</th><th>Status</th></tr></thead><tbody>${state.employees.map(e=>`<tr><td><strong>${esc(e.firstName)} ${esc(e.lastName)}</strong></td><td style="font-family:var(--mono);font-size:11px">${esc(e.niNumber||'—')}</td><td style="font-family:var(--mono);font-size:11px">${esc(e.taxCode||'1257L')}</td><td class="num">${fmt(e.salary)}</td><td><span class="pill ${e.pensionEnrolled?'green':'amber'}">${e.pensionEnrolled?'enrolled':'not enrolled'}</span></td><td><span class="pill ${e.status==='active'?'green':'amber'}">${e.status}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No employees. Sync from fallhr (BroadcastChannel) or add manually.</div>'}`}
function renderPension(v){const enrolledCount=state.employees.filter(e=>e.pensionEnrolled).length;v.innerHTML=`<div class="section-h"><h2>Pension Auto-Enrolment</h2><div class="sub">${enrolledCount}/${state.employees.length} enrolled · employer ${pct(RULES.pensionEmployer)} · employee ${pct(RULES.pensionEmployee)}</div></div><div class="card"><h3>Status</h3><p style="font-size:12px;color:var(--cream-dim);line-height:1.55">Pensions Act 2008 auto-enrolment. Eligible jobholders: age 22 to State Pension Age, earning over £10,000/year in pay reference period. Minimum contributions on qualifying earnings band £${RULES.pensionLowerBand.toLocaleString()} – £${RULES.pensionUpperBand.toLocaleString()}.</p></div>${state.employees.length?`<table><thead><tr><th>Employee</th><th>Annual salary</th><th>Qualifying earnings</th><th class="num">Employee 5%</th><th class="num">Employer 3%</th><th class="num">Monthly total</th><th>Status</th></tr></thead><tbody>${state.employees.map(e=>{const annual=Number(e.salary||0);const qe=Math.max(0,Math.min(annual,RULES.pensionUpperBand)-RULES.pensionLowerBand);const empContrib=calcPensionEmployee(annual,Number(e.pensionEmployeePct||5))/12;const erContrib=calcPensionEmployer(annual,Number(e.pensionEmployerPct||3))/12;return `<tr><td>${esc(e.firstName)} ${esc(e.lastName)}</td><td class="num">${fmt(annual)}</td><td class="num">${fmt(qe)}</td><td class="num">${fmt(empContrib)}</td><td class="num">${fmt(erContrib)}</td><td class="num">${fmt(empContrib+erContrib)}</td><td><span class="pill ${e.pensionEnrolled?'green':'amber'}">${e.pensionEnrolled?'enrolled':'not enrolled'}</span></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">No employees.</div>'}`}
function renderHolidayAccrual(v){v.innerHTML=`<div class="section-h"><h2>Holiday Accrual</h2><div class="sub">WTR 1998 · 5.6 weeks (28 days FT incl bank holidays)</div></div><div class="card"><h3>Method</h3><p style="font-size:12px;color:var(--cream-dim);line-height:1.55">Working Time Regulations 1998: 5.6 weeks paid annual leave for full-time workers (28 days inclusive of bank holidays). Part-time: pro-rata. Accrual rate: 12.07% of hours worked for variable-hour / casual workers (post-Harpur Trust v Brazel [2022] UKSC 21). Rolled-up holiday pay permitted from 1 Jan 2024 for irregular-hours and part-year workers (regulation 16A WTR 1998).</p></div>${state.employees.length?`<table><thead><tr><th>Employee</th><th>Annual entitlement</th><th>Hours/week</th><th>Accrued YTD</th><th>Taken YTD</th><th>Balance</th></tr></thead><tbody>${state.employees.map(e=>{const ent=Number(e.holidayEntitlement||28);const monthsThruYr=new Date().getMonth()+1;const accrued=Math.round(ent*(monthsThruYr/12)*10)/10;return `<tr><td>${esc(e.firstName)} ${esc(e.lastName)}</td><td class="num">${ent} days</td><td class="num">${e.hoursPerWeek||37.5}</td><td class="num">${accrued} days</td><td class="num">${e.holidayTakenYTD||0} days</td><td class="num">${(accrued-(e.holidayTakenYTD||0)).toFixed(1)} days</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">No employees.</div>'}`}
function renderSickness(v){v.innerHTML=`<div class="section-h"><h2>Sickness & SSP</h2><div class="sub">SSP ${fmt(RULES.sspWeekly)}/wk · ${RULES.sspWaitingDays} waiting days · max ${RULES.sspMaxWeeks} weeks</div><div class="actions"><button class="btn brass sm" onclick="openModal('addSickness')">+ Sickness</button></div></div>${state.sicknessEpisodes.length?`<table><thead><tr><th>Employee</th><th>Start</th><th>End</th><th class="num">Days</th><th class="num">SSP weeks</th><th class="num">SSP £</th><th>Status</th></tr></thead><tbody>${state.sicknessEpisodes.sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||'')).map(s=>{const emp=state.employees.find(e=>e.id===s.employeeId);const days=Number(s.days||0);const sspDays=Math.max(0,days-RULES.sspWaitingDays);const sspWeeks=Math.min(sspDays/7,RULES.sspMaxWeeks);const sspAmt=sspWeeks*RULES.sspWeekly;return `<tr><td>${esc(emp?(emp.firstName+' '+emp.lastName):s.employeeId.slice(0,8))}</td><td>${esc(s.startDate)}</td><td>${esc(s.endDate||'ongoing')}</td><td class="num">${days}</td><td class="num">${sspWeeks.toFixed(2)}</td><td class="num">${fmt(sspAmt)}</td><td><span class="pill ${s.endDate?'green':'amber'}">${s.endDate?'closed':'open'}</span></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">No sickness recorded.</div>'}`}
function renderReturns(v){v.innerHTML=`<div class="section-h"><h2>HMRC Returns</h2><div class="actions"><button class="btn brass sm" onclick="openModal('addReturn')">+ Return</button></div></div><div class="card"><h3>Key deadlines</h3><table><thead><tr><th>Return</th><th>Frequency</th><th>Deadline</th></tr></thead><tbody><tr><td><strong>FPS</strong> (Full Payment Submission)</td><td>per pay date</td><td>On or before payday</td></tr><tr><td><strong>EPS</strong> (Employer Payment Summary)</td><td>monthly</td><td>19th of following month</td></tr><tr><td><strong>P60</strong> (year-end summary to employees)</td><td>annual</td><td>By 31 May</td></tr><tr><td><strong>P11D</strong> (benefits in kind)</td><td>annual</td><td>By 6 July</td></tr><tr><td><strong>P11D(b)</strong> (Class 1A NIC on benefits)</td><td>annual</td><td>By 6 July (pay 22 July)</td></tr><tr><td><strong>Gender pay gap</strong> (250+ employees)</td><td>annual</td><td>By 4 April (snapshot 5 April)</td></tr></tbody></table></div>${state.hmrcReturns.length?`<table style="margin-top:14px"><thead><tr><th>Date</th><th>Type</th><th>Period</th><th>Reference</th><th>Status</th></tr></thead><tbody>${state.hmrcReturns.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.period)}</td><td style="font-family:var(--mono);font-size:11px">${esc(r.reference)}</td><td><span class="pill ${r.status==='submitted'?'green':'amber'}">${r.status}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty" style="margin-top:14px">No returns logged yet.</div>'}`}
function renderCompliance(v){const checks=[
  {id:'rti',name:'RTI registered with HMRC',cat:'HMRC',desc:'PAYE scheme reference + Accounts Office reference. Required before first FPS.'},
  {id:'fps',name:'FPS submitted on or before payday',cat:'HMRC',desc:'Late filing penalty £100-£400 per period depending on scheme size.'},
  {id:'eps',name:'EPS submitted by 19th of month',cat:'HMRC',desc:'Required even with nil payroll. Reports recoverable amounts (SMP, SPP, employment allowance).'},
  {id:'p60',name:'P60 issued to all employees by 31 May',cat:'HMRC',desc:'Year-end summary. Penalty £300 per failure + £60/day continuing.'},
  {id:'p11d',name:'P11D filed by 6 July (if benefits-in-kind)',cat:'HMRC',desc:'Plus P11D(b) reporting Class 1A NIC. NIC payment due by 22 July (electronic).'},
  {id:'autoEnrol',name:'Pension auto-enrolment up to date',cat:'Pensions',desc:'Eligible jobholders enrolled within 3 months. Re-enrolment every 3 years. TPR Declaration of Compliance required.'},
  {id:'workplacePension',name:'Workplace pension scheme set up (Nest/private)',cat:'Pensions',desc:'Qualifying scheme. Minimum 8% total contributions on qualifying earnings.'},
  {id:'ssp',name:'SSP scheme operating correctly',cat:'Payroll',desc:'£118.75/week. 3 waiting days. Max 28 weeks. Records retained 3 years.'},
  {id:'minimumWage',name:'NMW/NLW compliance',cat:'Pay',desc:'NLW £11.44/hr (21+) from Apr 2024. Records retained 6 years. HMRC enforcement. Naming and shaming.'},
  {id:'genderPayGap',name:'Gender pay gap report (250+ employees)',cat:'Equality',desc:'Snapshot 5 April. Publish by 4 April following. 6 metrics required. Equality Act 2010 (GPG Info) Regs 2017.'},
  {id:'elInsurance',name:'Employers Liability insurance certificate displayed',cat:'Insurance',desc:'£5M minimum. Certificate displayed. Penalty £2,500/day uninsured. EL(CI) Act 1969.'},
  {id:'apprenticeshipLevy',name:'Apprenticeship Levy reported (if payroll >£3M)',cat:'HMRC',desc:'0.5% of payroll over £3M annual paybill. £15,000 allowance. Apprenticeship Service account.'},
  {id:'employmentAllowance',name:'Employment Allowance claimed (if eligible)',cat:'HMRC',desc:'Up to £5,000/year off employer NI. Not for sole-director-only companies. Claim via EPS.'},
];
  const done=state.compliance||[];
  v.innerHTML=`<div class="section-h"><h2>Compliance</h2><div class="sub">${done.length}/${checks.length}</div></div><div style="display:flex;flex-direction:column;gap:6px">${checks.map(c=>{const isDone=done.includes(c.id);return `<div class="card" style="cursor:pointer;padding:12px 16px;${isDone?'opacity:0.6':''}" onclick="toggleComp('${c.id}')"><div style="display:flex;gap:10px;align-items:flex-start"><span style="font-size:16px;flex-shrink:0;width:20px">${isDone?'<span style="color:var(--green)">✓</span>':'○'}</span><div><strong>${esc(c.name)}</strong><div style="font-size:11px;color:var(--cream-muted);margin-top:2px">${esc(c.cat)} · ${esc(c.desc)}</div></div></div></div>`}).join('')}</div>`}
async function toggleComp(id){if(!state.compliance)state.compliance=[];const idx=state.compliance.indexOf(id);if(idx>=0)state.compliance.splice(idx,1);else state.compliance.push(id);await persistUI();await auditLog('compliance.toggle',{payload:{id}});render()}
const T0_QA=[
  {q:/paye|tax.?code|1257l|emergency/i,a:'PAYE tax codes (2025/26): 1257L = standard, £12,570 personal allowance, cumulative. K codes = additions to tax (e.g. underpaid tax). 0T = no allowance. BR = basic rate (20%) on all earnings. D0 = higher rate. D1 = additional rate. NT = no tax. W1/M1 (suffix) = non-cumulative (Week 1 / Month 1). Emergency code: 1257L W1/M1.'},
  {q:/ni|class.?1|class.?4|primary|secondary|threshold/i,a:'NI 2025/26: Employee (Class 1 primary) — 8% on earnings £12,570-£50,270, 2% above. Employer (Class 1 secondary) — 13.8% on earnings above £9,100 secondary threshold. Class 1A NIC on benefits-in-kind via P11D(b) at 13.8%. Reduction available via Employment Allowance (£5,000/year for eligible employers).'},
  {q:/rti|fps|eps|full.?payment|employer.?payment/i,a:'RTI Real Time Information: FPS (Full Payment Submission) on or before each payday for each employee. EPS (Employer Payment Summary) by 19th of following month — reports recoverable amounts (SMP, SPP, SAP, ShPP, employment allowance, apprenticeship levy). NIL EPS still required if no FPS sent (otherwise HMRC assumes a payment due). Late filing penalties: £100-£400 per scheme by size.'},
  {q:/p60|p11d|p45/i,a:'Year-end forms: P60 to each employee by 31 May (summary of pay and deductions in the tax year). P11D to HMRC by 6 July for benefits-in-kind (company car, medical insurance, etc) — also to employee. P11D(b) reports Class 1A NIC payable on benefits; NIC payment by 22 July (electronic). P45 issued to leaver — Parts 2 and 3 to next employer.'},
  {q:/auto.?enrol|qualifying.?earnings|pension/i,a:'Auto-enrolment qualifying earnings 2025/26: £6,240 lower – £50,270 upper. Eligible jobholder: 22 to SPA, earns £10,000+. Minimum total contribution 8% (employer 3%, employee 5%). Re-enrolment cyclical every 3 years (re-enrol anyone who opted out). Declaration of Compliance to TPR. Salary sacrifice can be used. NEST is government-backed default scheme.'},
  {q:/ssp|sick.?pay|waiting/i,a:'SSP 2025/26: £118.75/week. 3 waiting days (qualifying days only). Max 28 weeks. Eligibility: earn over Lower Earnings Limit (£123/week 2024/25). Self-cert days 1-7; fit note (Med3) from day 8. Linking periods: episodes within 8 weeks count as one. Records retained 3 years. Form SSP1 if SSP exhausted.'},
  {q:/holiday|wtr|accrual|harpur|brazel|rolled/i,a:'Holiday entitlement WTR 1998: 5.6 weeks paid (28 days FT incl bank holidays). Pro-rata for PT. Accrual for variable-hours: 12.07% of hours worked (post Harpur Trust v Brazel [2022] UKSC 21). Rolled-up holiday pay permitted from 1 Jan 2024 for irregular-hours and part-year workers (Employment Rights (Amendment) Regs 2023). Carry-over: 4 weeks (EU-derived) cannot generally be carried; 1.6 weeks UK-derived can by agreement.'},
  {q:/redund|cap|719|statutory.?pay/i,a:'Statutory redundancy pay 2025/26: half/full/1.5 weeks pay per year of service for age under 22 / 22-40 / 41+. Weekly pay capped at £719 (2025). Maximum 20 years service counted. Maximum payment: 20 × 1.5 × £719 = £21,570. Tax-free up to £30,000 (ITEPA 2003 s.401). Qualifying service 2 years. PILON taxable as earnings.'},
  {q:/levy|apprenticeship/i,a:'Apprenticeship Levy: 0.5% of annual paybill above £3M. £15,000 levy allowance offset. Paid monthly via PAYE. Funds go to Apprenticeship Service account; spent on apprenticeship training within 24 months or expire. Non-levy payers (under £3M) pay 5% co-investment.'},
  {q:/min.?wage|nmw|nlw/i,a:'National Minimum Wage / National Living Wage 2024/25 (rates increase from 1 Apr each year): NLW £11.44 (age 21+) · 18-20 £8.60 · 16-17 £6.40 · Apprentice £6.40. Records retained 6 years (Employment Act 2008 increased from 3). HMRC enforcement. Naming and shaming. Civil penalty 200% of underpayment (capped £20,000/worker). Criminal offence for deliberate underpayment.'},
];
function askT0(q){for(const r of T0_QA){if(r.q.test(q))return {answer:r.a,source:'T0 · UK payroll/HR rules'}}return null}
async function askT3(q){if(!state.settings.anthropicKey)return null;try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':state.settings.anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:'You are a UK payroll/HR practice expert. PAYE, RTI, NI, pension auto-enrolment, SSP, holiday accrual, P11D, gender pay gap. Concise.\n\n'+q}]})});if(!res.ok)return null;const j=await res.json();return {answer:j.content?.[0]?.text,source:'T3 · Anthropic'}}catch(e){return null}}
function renderQA(v){v.innerHTML=`<div class="section-h"><h2>Q & A</h2><div class="sub">T0 + T3 BYOK</div></div><div class="card" style="max-width:780px"><div class="chat" id="chatBox">${(state.ui.chat||[]).map(m=>`<div class="msg ${m.role}">${esc(m.text)}${m.source?`<div class="src">${esc(m.source)}</div>`:''}</div>`).join('')}</div><div class="chat-input"><input id="chatIn" placeholder="Ask… 'NI 2025/26 rates?' · 'P11D deadline?' · 'rolled-up holiday pay?'" onkeydown="if(event.key==='Enter')askQ()"><button class="btn brass" onclick="askQ()">Ask</button></div></div>`;const box=$('#chatBox');if(box)box.scrollTop=box.scrollHeight}
async function askQ(){const inp=$('#chatIn');if(!inp)return;const q=inp.value.trim();if(!q)return;inp.value='';if(!state.ui.chat)state.ui.chat=[];state.ui.chat.push({role:'user',text:q});render();let r=askT0(q);if(!r)r=await askT3(q);state.ui.chat.push(r?{role:'bot',text:r.answer,source:r.source}:{role:'bot',text:'No T0 match. Add BYOK key for T3.',source:'system'});persistUI();render()}
function openModal(type){const modal=$('#modal');modal.classList.add('open');
  if(type==='settings'){$('#modalTitle').textContent='Settings';$('#modalBody').innerHTML=`<div class="card"><h3>Firm</h3><div class="row"><div class="field"><label>Firm name</label><input id="fName" value="${esc(state.firm?.name||'')}"></div><div class="field"><label>Company no</label><input id="fCoNo" value="${esc(state.firm?.companyNo||'')}"></div></div><div class="row"><div class="field"><label>PAYE reference</label><input id="fPaye" value="${esc(state.firm?.payeRef||'')}"></div><div class="field"><label>Accounts office ref</label><input id="fAor" value="${esc(state.firm?.aorRef||'')}"></div></div></div><div class="card"><h3>API</h3><div class="field"><label>Anthropic key (T3)</label><input type="password" id="sKey" value="${esc(state.settings.anthropicKey||'')}"></div><div style="margin:10px 0"><label style="font-size:12px"><input type="checkbox" id="sAudit" ${state.settings.auditChain?'checked':''}> Audit chain</label></div></div><div class="actions"><button class="btn ghost sm" onclick="exportAll()">Export</button><button class="btn ghost sm" onclick="importAll()">Import</button><button class="btn danger sm" onclick="wipeAll()">Wipe</button><button class="btn brass" onclick="saveSettings()">Save</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`}
  else if(type==='runPayroll'){const today=new Date().toISOString().slice(0,10);const monthName=new Date().toLocaleString('en-GB',{month:'long',year:'numeric'});$('#modalTitle').textContent='Run Payroll';$('#modalBody').innerHTML=`<div class="row"><div class="field"><label>Period</label><input id="rpPeriod" value="${esc(monthName)}"></div><div class="field"><label>Pay date</label><input type="date" id="rpDate" value="${today}"></div></div><div class="card" style="margin-top:8px"><h3>Preview</h3>${activePayrollPreview()}</div><div class="actions"><button class="btn brass" onclick="commitPayroll()">Commit run</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`}
  else if(type==='addEmp'){$('#modalTitle').textContent='Add Employee';$('#modalBody').innerHTML=`<div class="row"><div class="field"><label>First name</label><input id="eFirst"></div><div class="field"><label>Last name</label><input id="eLast"></div></div><div class="row"><div class="field"><label>NI number</label><input id="eNi" placeholder="AB123456C"></div><div class="field"><label>Tax code</label><input id="eTax" value="1257L"></div></div><div class="row"><div class="field"><label>Annual salary £</label><input type="number" id="eSal"></div><div class="field"><label>Hours/week</label><input type="number" id="eHrs" value="37.5"></div></div><div class="row"><div class="field"><label>Holiday entitlement (days)</label><input type="number" id="eHol" value="28"></div><div class="field"><label>Status</label><select id="eStatus"><option>active</option><option>probation</option><option>leaver</option><option>maternity</option></select></div></div><div class="row"><div class="field"><label>Pension enrolled</label><select id="ePen"><option value="1">Yes</option><option value="0">No</option></select></div><div class="field"><label>Student loan (plan 2)</label><select id="eSL"><option value="0">No</option><option value="1">Yes</option></select></div></div><div class="actions"><button class="btn brass" onclick="addEmployee()">Add</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`}
  else if(type==='addSickness'){$('#modalTitle').textContent='Record Sickness';$('#modalBody').innerHTML=`<div class="field"><label>Employee</label><select id="sEmp">${state.employees.map(e=>`<option value="${e.id}">${esc(e.firstName)} ${esc(e.lastName)}</option>`).join('')}</select></div><div class="row"><div class="field"><label>Start date</label><input type="date" id="sStart"></div><div class="field"><label>End date (blank if ongoing)</label><input type="date" id="sEnd"></div></div><div class="row"><div class="field"><label>Days</label><input type="number" step="0.5" id="sDays"></div><div class="field"><label>Reason</label><input id="sReason" placeholder="optional"></div></div><div class="actions"><button class="btn brass" onclick="addSickness()">Record</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`}
  else if(type==='addReturn'){$('#modalTitle').textContent='Log HMRC Return';$('#modalBody').innerHTML=`<div class="row"><div class="field"><label>Date</label><input type="date" id="hrDate" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Type</label><select id="hrType"><option>FPS</option><option>EPS</option><option>P60</option><option>P11D</option><option>P11D(b)</option><option>Gender Pay Gap</option><option>Apprenticeship Levy</option></select></div></div><div class="row"><div class="field"><label>Period</label><input id="hrPeriod" placeholder="e.g. Month 3 2025-26"></div><div class="field"><label>Reference</label><input id="hrRef" placeholder="HMRC submission ref"></div></div><div class="field"><label>Status</label><select id="hrStatus"><option>submitted</option><option>pending</option><option>rejected</option></select></div><div class="actions"><button class="btn brass" onclick="addReturn()">Save</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`}
}
function activePayrollPreview(){const lines=runPayroll();if(!lines.length)return '<p style="color:var(--cream-muted)">No active employees.</p>';const g=lines.reduce((t,l)=>t+l.gross,0);const tx=lines.reduce((t,l)=>t+l.tax,0);const ni=lines.reduce((t,l)=>t+l.ni,0);const net=lines.reduce((t,l)=>t+l.netPay,0);return `<table><thead><tr><th>Name</th><th class="num">Gross</th><th class="num">PAYE</th><th class="num">NI</th><th class="num">Pension</th><th class="num">Net</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.name)}</td><td class="num">${fmt(l.gross)}</td><td class="num">${fmt(l.tax)}</td><td class="num">${fmt(l.ni)}</td><td class="num">${fmt(l.pensionEmp)}</td><td class="num">${fmt(l.netPay)}</td></tr>`).join('')}<tr style="border-top:2px solid var(--brass);font-weight:700"><td>Total</td><td class="num">${fmt(g)}</td><td class="num">${fmt(tx)}</td><td class="num">${fmt(ni)}</td><td class="num">${fmt(lines.reduce((t,l)=>t+l.pensionEmp,0))}</td><td class="num">${fmt(net)}</td></tr></tbody></table>`}
function closeModal(){$('#modal').classList.remove('open')}
async function commitPayroll(){const period=$('#rpPeriod').value.trim();const payDate=$('#rpDate').value;const lines=runPayroll();const r={id:uid('pr'),period,payDate,lines,fpsSubmitted:false,ts:now()};state.payrollRuns.push(r);await idbPut('payrollRuns',r);await auditLog('payroll.run',{payload:{id:r.id,period,employees:lines.length}});closeModal();toast('Payroll committed');render()}
async function addEmployee(){const e={id:uid('em'),firstName:$('#eFirst').value.trim(),lastName:$('#eLast').value.trim(),niNumber:$('#eNi').value.trim(),taxCode:$('#eTax').value.trim(),salary:Number($('#eSal').value||0),hoursPerWeek:Number($('#eHrs').value||37.5),holidayEntitlement:Number($('#eHol').value||28),status:$('#eStatus').value,pensionEnrolled:$('#ePen').value==='1',studentLoan:$('#eSL').value==='1',ts:now()};state.employees.push(e);await idbPut('employees',e);try{bcHr?.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{employees:[e]}})}catch(_){}await auditLog('employee.added',{payload:{id:e.id}});closeModal();toast('Added');render()}
async function addSickness(){const s={id:uid('sk'),employeeId:$('#sEmp').value,startDate:$('#sStart').value,endDate:$('#sEnd').value,days:Number($('#sDays').value||0),reason:$('#sReason').value.trim(),ts:now()};state.sicknessEpisodes.push(s);await idbPut('sicknessEpisodes',s);await auditLog('sickness.recorded',{payload:{id:s.id}});closeModal();toast('Recorded');render()}
async function addReturn(){const r={id:uid('hr'),date:$('#hrDate').value,type:$('#hrType').value,period:$('#hrPeriod').value.trim(),reference:$('#hrRef').value.trim(),status:$('#hrStatus').value,ts:now()};state.hmrcReturns.push(r);await idbPut('hmrcReturns',r);await auditLog('hmrc.return.logged',{payload:{id:r.id,type:r.type}});closeModal();toast('Logged');render()}
async function saveSettings(){const f=state.firm||{id:uid('fi'),ts:now()};f.name=$('#fName').value.trim();f.companyNo=$('#fCoNo').value.trim();f.payeRef=$('#fPaye').value.trim();f.aorRef=$('#fAor').value.trim();f.updatedAt=now();state.firm=f;await idbPut('firms',f);state.settings.anthropicKey=$('#sKey').value.trim();state.settings.auditChain=$('#sAudit').checked;$('#tierBadge').textContent=state.settings.anthropicKey?'T3':'T0';await persistUI();closeModal();toast('Saved');render()}
function exportAll(){const d={tool:TOOLNAME,v:VERSION,ts:now(),firm:state.firm,employees:state.employees,payrollRuns:state.payrollRuns,sicknessEpisodes:state.sicknessEpisodes,hmrcReturns:state.hmrcReturns};const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='fallhrpractice-export.json';a.click();URL.revokeObjectURL(u);toast('Exported')}
function importAll(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=async()=>{const f=inp.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.firm){state.firm=d.firm;await idbPut('firms',d.firm)}for(const k of['employees','payrollRuns','sicknessEpisodes','hmrcReturns']){if(Array.isArray(d[k]))for(const r of d[k]){state[k].push(r);await idbPut(k,r)}}persistUI();toast('Imported');render()}catch(e){toast('Failed')}};inp.click()}
async function wipeAll(){if(!confirm('Wipe ALL data?'))return;for(const s of['firms','employees','payrollRuns','pensionRuns','sicknessEpisodes','hmrcReturns','audit','state']){const tx=db.transaction(s,'readwrite');tx.objectStore(s).clear();await new Promise(r=>{tx.oncomplete=r})}location.reload()}
async function seedDemo(){if(state.employees.length||state.firm)return;
  const firm={id:uid('fi'),name:'Northgate Sciences Ltd',companyNo:'09876543',payeRef:'120/AB12345',aorRef:'120PA00012345',updatedAt:now(),isDemo:true};
  state.firm=firm;await idbPut('firms',firm);
  const emps=[
    {id:uid('em'),firstName:'Sarah',lastName:'Lewis',niNumber:'AB123456C',taxCode:'1257L',salary:62000,hoursPerWeek:37.5,holidayEntitlement:28,status:'active',pensionEnrolled:true,pensionEmployeePct:5,pensionEmployerPct:3,studentLoan:false,holidayTakenYTD:10,ts:now(),isDemo:true},
    {id:uid('em'),firstName:'Adam',lastName:'Ross',niNumber:'CD987654A',taxCode:'1257L',salary:54000,hoursPerWeek:37.5,holidayEntitlement:28,status:'active',pensionEnrolled:true,pensionEmployeePct:5,pensionEmployerPct:3,studentLoan:true,holidayTakenYTD:8,ts:now(),isDemo:true},
    {id:uid('em'),firstName:'Priya',lastName:'Mehta',niNumber:'EF112233B',taxCode:'1257L',salary:42000,hoursPerWeek:37.5,holidayEntitlement:28,status:'probation',pensionEnrolled:true,pensionEmployeePct:5,pensionEmployerPct:3,studentLoan:false,holidayTakenYTD:3,ts:now(),isDemo:true},
    {id:uid('em'),firstName:'Olu',lastName:'Adeyemi',niNumber:'GH445566C',taxCode:'1257L',salary:38000,hoursPerWeek:30,holidayEntitlement:22,status:'maternity',pensionEnrolled:true,pensionEmployeePct:5,pensionEmployerPct:3,studentLoan:false,holidayTakenYTD:5,ts:now(),isDemo:true},
  ];
  state.employees=emps;for(const e of emps)await idbPut('employees',e);
  // Seed one payroll run
  const lines=runPayroll();
  const r={id:uid('pr'),period:'May 2026',payDate:'2026-05-31',lines,fpsSubmitted:true,ts:now(),isDemo:true};
  state.payrollRuns.push(r);await idbPut('payrollRuns',r);
  state.compliance=['rti','fps','eps','autoEnrol','workplacePension','minimumWage','elInsurance'];
  await auditLog('demo.seeded',{reasoning:'first boot'});await persistUI()}

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { TABS };
