function lcEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lcSanitizeUrl(url) {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return '';
  const stripped = raw.replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (/^(javascript|vbscript|data|file):/i.test(stripped)) return '';
  return raw;
}

function lcClampRating(value, max) {
  const m = Math.max(0, Number(max) || 0);
  let v = Number(value);
  if (!isFinite(v)) v = 0;
  v = Math.max(0, Math.min(m, v));
  return Math.round(v * 2) / 2;
}

// Minimal, safe Markdown -> HTML. Escapes everything first, then re-introduces
// a small, deliberately limited set of constructs (bold, italic, links, lists,
// paragraphs). This avoids depending on HA's internal ha-markdown element,
// which is not a public API for custom cards.
function lcInline(line) {
  let out = lcEsc(line);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, txt, url) => {
    const safe = lcSanitizeUrl(url);
    return safe ? `<a href="${lcEsc(safe)}" target="_blank" rel="noopener noreferrer">${txt}</a>` : txt;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>');
  return out;
}

function lcMarkdown(src) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const blocks = text.split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n').filter(l => l.length);
    if (lines.length && lines.every(l => /^\s*[-*]\s+/.test(l))) {
      return '<ul>' + lines.map(l => `<li>${lcInline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
    }
    return `<p>${lines.map(lcInline).join('<br>')}</p>`;
  }).join('');
}

const LC_NONE_ACTION = { action: 'none' };

// Cache for the lazily-loaded HEIC/HEIF decoder (see LunchCard._loadHeicLib).
// Chrome, Firefox and Edge cannot decode HEIC natively (no browser licenses
// the HEVC codec); Safari/WebKit can, so this path only ever runs when the
// native <img> decode has already failed.


const LC_DEFAULT = {
  card_color: '#e8eddd',
  duration: '',
  difficulty: '',
  category: '',
  rating_count: null,
  recipe: {},
  title: '',
  rating: null,
  max_rating: 5,
  description: '',
  image_1: '',
  image_2: '',
  image_3: '',
  tap_action: LC_NONE_ACTION,
  hold_action: LC_NONE_ACTION,
  double_tap_action: LC_NONE_ACTION,
};

const LC_COLOR_PRESETS = [['Rot', '#f3dddd'], ['Rosa', '#f2dfe9'], ['Violett', '#eaddf1'], ['Dunkelviolett', '#d6cee5'], ['Indigo', '#d9dcef'], ['Blau', '#dae6f4'], ['Hellblau', '#dcecf6'], ['Cyan', '#d8eff0'], ['Türkisblau', '#d8ece8'], ['Grün', '#dce9dd'], ['Hellgrün', '#e8eddd'], ['Limone', '#e9efcf'], ['Gelb', '#f5efcf'], ['Bernstein', '#f5e9ce'], ['Orange', '#f5e5d5'], ['Tieforange', '#f0ddd4'], ['Braun', '#e9dfd7'], ['Hellgrau', '#ececea'], ['Grau', '#dededc'], ['Dunkelgrau', '#cacdcd'], ['Blaugrau', '#dbe3e6']];
const LC_COLOR_DEFAULT = '#e8eddd';
const LC_ORDER = ['type','title','duration','difficulty','category','card_color','recipe','rating','max_rating','rating_count','image_1','image_2','image_3','description','tap_action','hold_action','double_tap_action'];

const LC_EDITOR_CSS = `
*,*::before,*::after{box-sizing:border-box} :host{display:block;padding:20px;border-radius:20px;font-family:system-ui,sans-serif;background:var(--surface);color:var(--ink)}
:host([theme=bistro]){--surface:#181818;--panel:#242321;--ink:#f4eddf;--muted:#b9afa2;--line:#51483c;--accent:#e4b567;--field:#302e2a}
:host([theme=gallery]){--surface:color-mix(in srgb,var(--gallery-base,#e8eddd) 55%,white);--panel:color-mix(in srgb,var(--surface) 42%,white);--ink:color-mix(in srgb,var(--surface) 22%,#101510);--muted:color-mix(in srgb,var(--surface) 34%,#283028);--line:color-mix(in srgb,var(--surface) 75%,#758075);--accent:color-mix(in srgb,var(--surface) 34%,#142414);--field:color-mix(in srgb,var(--surface) 18%,white)}
.editor-header{padding:4px 0 18px;border-bottom:1px solid var(--line);margin-bottom:20px}.editor-kicker{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}.editor-title{font:600 27px/1.15 Georgia,serif;margin:7px 0}.editor-sub{color:var(--muted);font-size:13px;line-height:1.5}
.sec{display:block;color:var(--accent);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin:23px 2px 8px}.box{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}.row{display:flex;align-items:center;gap:14px;padding:13px 15px;border-bottom:1px solid var(--line)}.row:last-child{border:0}.row.sub{padding-top:8px}.rl{flex:1;font-size:14px;font-weight:600}.rs{color:var(--muted);font-size:12px;line-height:1.4}.rating-pair{display:flex;width:100%;gap:10px;flex-wrap:wrap}.rp-item{flex:1;min-width:90px;display:flex;flex-direction:column;gap:6px}
.txt-in,input.num-in,select.pick{box-sizing:border-box;border:1px solid var(--line);background:var(--field);border-radius:9px;padding:10px;color:var(--ink);font:14px system-ui,sans-serif;min-width:0}.txt-in{width:100%;max-width:220px}.txt-in.wide,input.num-in.wide{max-width:none;width:100%}.textarea-in{resize:vertical;min-height:80px}.txt-in:focus-visible,input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.txt-in:disabled{opacity:.45}.img-slot{border-bottom:1px solid var(--line)}.img-slot:last-child{border:0}.img-slot.disabled{opacity:.45;pointer-events:none}
.adv-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:16px;background:none;border:0;color:var(--accent);font:600 14px system-ui;cursor:pointer}.adv-btn svg{flex:none}.nav-hdr{display:flex;align-items:center;gap:12px;padding-bottom:20px;border-bottom:1px solid var(--line)}.nav-back{border:1px solid var(--line);background:var(--panel);color:var(--accent);border-radius:10px;width:38px;height:38px;cursor:pointer}.nav-hdr-title{font:600 25px Georgia,serif}.nav-hdr-sub{font-size:12px;color:var(--muted);margin-top:4px}ha-selector{display:block;width:100%}input[type=color]{width:52px;height:38px;border:1px solid var(--line);border-radius:8px;background:var(--field);cursor:pointer}
`;

class MenuCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = { ...LC_DEFAULT };
    this._hass = null;
    this._rendered = false;
    this._page = 'main';
    this._mediaSelEls = {};
  }

  setConfig(config) {
    this._config = { ...LC_DEFAULT, ...config };
    this.setAttribute('theme', config.type === 'custom:recipe-gallery-card' ? 'gallery' : 'bistro');
    this._applyColor();
    this._render();
  }

  set hass(h) {
    this._hass = h;
    Object.keys(this._mediaSelEls).forEach(k => {
      if (this._mediaSelEls[k]) this._mediaSelEls[k].hass = h;
    });
    if (!this._rendered) this._render();
  }

  get hass() { return this._hass; }

  _applyColor() {
    const color = /^#[0-9a-f]{6}$/i.test(this._config.card_color || '') ? this._config.card_color : LC_COLOR_DEFAULT;
    this.style.setProperty('--gallery-base', color);
  }

  _dispatch(cfg) {
    this._config = cfg;
    this._applyColor();
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._minimize(cfg) },
      bubbles: true,
      composed: true,
    }));
  }

  _minimize(cfg) {
    const out = {};
    for (const k of [...LC_ORDER, ...Object.keys(cfg).filter(k => !LC_ORDER.includes(k))]) {
      if (!(k in cfg)) continue;
      if (!(k in LC_DEFAULT)) { out[k] = cfg[k]; continue; }
      const def = LC_DEFAULT[k], value = cfg[k];
      const actionIsNone = k.endsWith('_action') && value && value.action === 'none' && Object.keys(value).length === 1;
      const same = actionIsNone || (k === 'card_color' && typeof value === 'string' && value.toLowerCase() === def) || ((typeof def === 'object' && def !== null) ? JSON.stringify(value) === JSON.stringify(def) : value === def);
      if (!same) out[k] = value;
    }
    return out;
  }

  _set(key, value) {
    this._dispatch({ ...this._config, [key]: value });
  }

  _render() {
    this._rendered = true;
    if (this._page === 'actions') { this._renderActionsPage(); return; }
    this._page = 'main';
    this._renderMainPage();
  }

  _renderMainPage() {
    const c = this._config;
    const maxR = Math.max(0, Math.min(10, Number(c.max_rating) || 0));
    const rating = c.rating === null || c.rating === undefined || c.rating === '' ? '' : Math.max(0, Math.min(maxR, Number(c.rating) || 0));
    const img1Set = !!c.image_1;
    const img2Set = !!c.image_2;

    this.shadowRoot.innerHTML = `
<style>${LC_EDITOR_CSS}</style>
<div class="editor-header"><div class="editor-kicker">${c.type === 'custom:recipe-gallery-card' ? 'MENU-CARD · REZEPTKARTE' : 'MENU-CARD · BISTRO'}</div><div class="editor-title">Deine Speisekarte</div><div class="editor-sub">Gestalte dein Gericht und lege fest, was beim Antippen passiert.</div></div>

<span class="sec">Gericht</span>
<div class="box">
  <div class="row">
    <div class="rl">Name</div>
    <input type="text" class="txt-in wide" id="title-in" value="${lcEsc(c.title || '')}" placeholder="z. B. Cremige Tomatenpasta" style="max-width:220px">
  </div>
</div>

<span class="sec">Details zum Gericht</span>
<div class="box">
<div class="row"><label class="rl" for="duration-in">Dauer</label><input class="txt-in" id="duration-in" value="${lcEsc(c.duration || '')}" placeholder="z. B. 25 Min."></div>
<div class="row"><label class="rl" for="difficulty-in">Schwierigkeit</label><input class="txt-in" id="difficulty-in" value="${lcEsc(c.difficulty || '')}" placeholder="z. B. Einfach"></div>
<div class="row"><label class="rl" for="category-in">Art</label><input class="txt-in" id="category-in" value="${lcEsc(c.category || '')}" placeholder="z. B. Vegetarisch"></div>
</div>
${c.type === 'custom:recipe-gallery-card' ? `<span class="sec">Hintergrundfarbe</span><div class="box"><div class="row"><label class="rl" for="card-color">Farbe</label><select class="pick" id="card-color">${!LC_COLOR_PRESETS.some(([,hex]) => hex === String(c.card_color).toLowerCase()) ? `<option value="${lcEsc(c.card_color)}" selected>Benutzerdefiniert (${lcEsc(c.card_color)})</option>` : ''}${LC_COLOR_PRESETS.map(([name,hex]) => `<option value="${hex}" ${hex === String(c.card_color).toLowerCase() ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="row"><label class="rl" for="custom-color">Eigene Farbe</label><input type="color" id="custom-color" value="${/^#[0-9a-f]{6}$/i.test(c.card_color) ? c.card_color : LC_COLOR_DEFAULT}"></div></div>` : ''}
${c.type === 'custom:recipe-gallery-card' ? `<span class="sec">Rezept-Button</span><div class="box"><div class="row"><label class="rl" for="recipe-label">Beschriftung</label><input class="txt-in" id="recipe-label" value="${lcEsc((c.recipe && c.recipe.label) || 'Rezept anzeigen')}"></div>${this._actionGroup('recipe', 'Rezept-Aktion', (c.recipe && c.recipe.action), true)}${c.recipe && c.recipe.action && c.recipe.action.action === 'recipe' ? `<div class="row" style="display:block"><label class="rs" for="ingredients">Zutaten – eine pro Zeile</label><textarea id="ingredients" class="txt-in wide textarea-in">${lcEsc(((c.recipe.recipe_details || {}).ingredients || []).join('\n'))}</textarea></div><div class="row" style="display:block"><label class="rs" for="steps">Zubereitung – ein Schritt pro Zeile</label><textarea id="steps" class="txt-in wide textarea-in">${lcEsc(((c.recipe.recipe_details || {}).steps || []).join('\n'))}</textarea></div>` : ''}</div>` : ''}
<span class="sec">Bewertung</span>
<div class="box">
  <div class="row">
    <div class="rating-pair">
      <div class="rp-item">
        <div class="rs">Wertung</div>
        <input type="number" class="num-in wide" id="rating-in" min="0" max="${maxR}" step="0.1" value="${rating}">
      </div>
      <div class="rp-item">
        <div class="rs">Maximum</div>
        <input type="number" class="num-in wide" id="maxrating-in" min="0" max="10" step="1" value="${maxR}">
      </div>
      <div class="rp-item"><label class="rs" for="count-in">Anzahl Bewertungen</label><input type="number" class="num-in wide" id="count-in" min="0" step="1" value="${c.rating_count == null ? '' : lcEsc(c.rating_count)}" placeholder="Optional"></div>
    </div>
  </div>
</div>

<span class="sec">Bilder</span>
<div class="box">
  <div class="img-slot" id="slot-1">
    <div class="row">
      <div><div class="rl">Bild 1</div><div class="rs">Aus der Medienbibliothek wählen oder URL einfügen</div></div>
    </div>
    <div class="row sub" id="sel-wrap-1"></div>
    <div class="row sub">
      <input type="text" class="txt-in wide" id="url-in-1" value="${lcEsc(c.image_1 || '')}" placeholder="https:// or media-source://">
    </div>
  </div>
  <div class="img-slot${img1Set ? '' : ' disabled'}" id="slot-2">
    <div class="row">
      <div><div class="rl">Bild 2</div><div class="rs">${img1Set ? 'Aus der Medienbibliothek wählen oder URL einfügen' : 'Zuerst Bild 1 wählen'}</div></div>
    </div>
    <div class="row sub" id="sel-wrap-2"></div>
    <div class="row sub">
      <input type="text" class="txt-in wide" id="url-in-2" value="${lcEsc(c.image_2 || '')}" placeholder="https:// or media-source://" ${img1Set ? '' : 'disabled'}>
    </div>
  </div>
  <div class="img-slot${img2Set ? '' : ' disabled'}" id="slot-3">
    <div class="row">
      <div><div class="rl">Bild 3</div><div class="rs">${img2Set ? 'Aus der Medienbibliothek wählen oder URL einfügen' : 'Zuerst Bild 2 wählen'}</div></div>
    </div>
    <div class="row sub" id="sel-wrap-3"></div>
    <div class="row sub">
      <input type="text" class="txt-in wide" id="url-in-3" value="${lcEsc(c.image_3 || '')}" placeholder="https:// or media-source://" ${img2Set ? '' : 'disabled'}>
    </div>
  </div>
</div>

<span class="sec">Beschreibung</span>
<div class="box">
  <div class="row" style="flex-direction:column;align-items:flex-start">
    <textarea class="txt-in wide textarea-in" id="desc-in" placeholder="Eine kurze Beschreibung …">${lcEsc(c.description || '')}</textarea>
    <div class="rs">Unterstützt Markdown</div>
  </div>
</div>

<span class="sec">Aktionen</span>
<div class="box">
  <button class="adv-btn" id="actions-btn">
    <span>Aktionen</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
  </button>
</div>`;

    const s = this.shadowRoot;
    ['duration','difficulty','category'].forEach(key => s.getElementById(key + '-in').addEventListener('change', e => this._set(key, e.target.value.trim())));
    s.getElementById('count-in').addEventListener('change', e => this._set('rating_count', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0))));
    this._bindActionGroup('recipe');
    const label = s.getElementById('recipe-label');
    if (label) label.addEventListener('change', e => this._set('recipe', { ...this._config.recipe, label: e.target.value }));
    ['ingredients','steps'].forEach(key => { const field = s.getElementById(key); if (field) field.addEventListener('change', e => this._set('recipe', { ...this._config.recipe, recipe_details: { ...(this._config.recipe.recipe_details || {}), [key]: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) } })); });
    const color = s.getElementById('card-color');
    if (color) color.addEventListener('change', e => { this._set('card_color', e.target.value); this._render(); });
    const customColor = s.getElementById('custom-color');
    if (customColor) customColor.addEventListener('change', e => { this._set('card_color', e.target.value); this._render(); });
    s.getElementById('title-in').addEventListener('change', e => this._set('title', e.target.value));

    s.getElementById('rating-in').addEventListener('change', e => {
      this._set('rating', e.target.value === '' ? null : Math.max(0, Math.min(maxR, Number(e.target.value))));
    });
    s.getElementById('maxrating-in').addEventListener('change', e => {
      const newMax = Math.max(0, Math.min(10, Math.round(parseFloat(e.target.value) || 0)));
      this._dispatch({ ...this._config, max_rating: newMax, rating: this._config.rating == null ? null : Math.max(0, Math.min(newMax, Number(this._config.rating) || 0)) });
    });

    s.getElementById('url-in-1').addEventListener('change', e => this._set('image_1', e.target.value.trim()));
    s.getElementById('url-in-2').addEventListener('change', e => { if (img1Set) this._set('image_2', e.target.value.trim()); });
    s.getElementById('url-in-3').addEventListener('change', e => { if (img2Set) this._set('image_3', e.target.value.trim()); });

    s.getElementById('desc-in').addEventListener('change', e => this._set('description', e.target.value));
    s.getElementById('actions-btn').addEventListener('click', () => { this._page = 'actions'; this._render(); });

    this._mountMediaSelector(1, s.getElementById('sel-wrap-1'), true);
    this._mountMediaSelector(2, s.getElementById('sel-wrap-2'), img1Set);
    this._mountMediaSelector(3, s.getElementById('sel-wrap-3'), img2Set);
  }

  _mountMediaSelector(n, wrap, enabled) {
    if (!wrap) return;
    const key = 'image_' + n;
    const val = this._config[key] || '';
    let sel;
    try {
      sel = document.createElement('ha-selector');
    } catch (err) {
      wrap.remove();
      return;
    }
    sel.hass = this._hass;
    sel.selector = { media: { accept: ['image/*'] } };
    sel.label = 'Medienbibliothek';
    sel.disabled = !enabled;
    if (val.indexOf('media-source://') === 0) {
      sel.value = { media_content_id: val, media_content_type: 'image/*' };
    }
    sel.addEventListener('value-changed', e => {
      if (!enabled) return;
      const v = e.detail.value;
      const id = v && typeof v === 'object' ? v.media_content_id : v;
      this._set(key, id || '');
    });
    wrap.innerHTML = '';
    wrap.appendChild(sel);
    this._mediaSelEls[key] = sel;
  }

  _actionKeyFor(k) { return k === 'recipe' ? 'recipe_action' : k === 'tap' ? 'tap_action' : k === 'hold' ? 'hold_action' : 'double_tap_action'; }

  _renderActionsPage() {
    const c = this._config;
    this.shadowRoot.innerHTML = `
<style>${LC_EDITOR_CSS}</style>
<div class="nav-hdr">
  <button class="nav-back" id="back-btn" title="Back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
  </button>
  <div class="nav-hdr-txt">
    <div class="nav-hdr-title">Aktionen</div>
    <div class="nav-hdr-sub">Diese Aktionen gelten für die Karte.${c.type === 'custom:recipe-gallery-card' ? ' Die Aktion für den Rezept-Button findest du bei den Rezept-Button-Einstellungen.' : ''}</div>
  </div>
</div>
${this._actionGroup('tap', 'Tippen', c.tap_action)}
${this._actionGroup('hold', 'Halten', c.hold_action)}
${this._actionGroup('double', 'Doppeltippen', c.double_tap_action)}`;

    const s = this.shadowRoot;
    s.getElementById('back-btn').addEventListener('click', () => { this._page = 'main'; this._render(); });
    ['tap', 'hold', 'double'].forEach(k => this._bindActionGroup(k));
  }

  _actionGroup(k, label, action, inline = false) {
    const a = (action && action.action) || 'none';
    let extra = '';
    if (a === 'navigate') {
      extra = `<div class="row sub"><input type="text" class="txt-in wide" id="act-${k}-navpath" value="${lcEsc(action.navigation_path || '')}" placeholder="/lovelace/0"></div>`;
    } else if (a === 'url') {
      extra = `<div class="row sub"><input type="text" class="txt-in wide" id="act-${k}-url" value="${lcEsc(action.url_path || '')}" placeholder="https://example.com"></div>`;
    } else if (a === 'perform-action') {
      extra = `
      <div class="row sub"><input type="text" class="txt-in wide" id="act-${k}-service" value="${lcEsc(action.perform_action || '')}" placeholder="light.turn_on"></div>
      <div class="row sub"><input type="text" class="txt-in wide" id="act-${k}-entity" value="${lcEsc((action.target && action.target.entity_id) || '')}" placeholder="Target entity id (optional)"></div>`;
    }
    return `
${inline ? '' : `<span class="sec">${label}</span><div class="box">`}
  <div class="row">
    <div class="rl">Aktion</div>
    <select class="pick" id="act-${k}-type">
      <option value="none" ${a === 'none' ? 'selected' : ''}>Keine</option>${k === 'recipe' ? `<option value="recipe" ${a === 'recipe' ? 'selected' : ''}>Rezept anzeigen</option>` : ''}
      <option value="navigate" ${a === 'navigate' ? 'selected' : ''}>Navigieren</option>
      <option value="url" ${a === 'url' ? 'selected' : ''}>URL</option>
      <option value="assist" ${a === 'assist' ? 'selected' : ''}>Assist</option>
      <option value="perform-action" ${a === 'perform-action' ? 'selected' : ''}>Aktion ausführen</option>
    </select>
  </div>
  ${extra}
${inline ? '' : '</div>'}`;
  }

  _bindActionGroup(k) {
    const s = this.shadowRoot;
    const key = this._actionKeyFor(k);
    const current = () => k === 'recipe' ? ((this._config.recipe || {}).action || {}) : (this._config[key] || {});
    const setAction = value => k === 'recipe' ? this._set('recipe', { ...this._config.recipe, action: value }) : this._set(key, value);
    const typeSel = s.getElementById(`act-${k}-type`);
    if (!typeSel) return;
    typeSel.addEventListener('change', e => {
      setAction({ action: e.target.value });
      this._render();
    });

    const nav = s.getElementById(`act-${k}-navpath`);
    if (nav) nav.addEventListener('change', e => {
      setAction({ ...current(), action: 'navigate', navigation_path: e.target.value.trim() });
    });
    const url = s.getElementById(`act-${k}-url`);
    if (url) url.addEventListener('change', e => {
      setAction({ ...current(), action: 'url', url_path: e.target.value.trim() });
    });
    const svc = s.getElementById(`act-${k}-service`);
    if (svc) svc.addEventListener('change', e => {
      setAction({ ...current(), action: 'perform-action', perform_action: e.target.value.trim() });
    });
    const ent = s.getElementById(`act-${k}-entity`);
    if (ent) ent.addEventListener('change', e => {
      const v = e.target.value.trim();
      const cur = { ...current(), action: 'perform-action' };
      if (v) cur.target = { entity_id: v }; else delete cur.target;
      setAction(cur);
    });
  }
}
customElements.define('menu-card-editor', MenuCardEditor);

