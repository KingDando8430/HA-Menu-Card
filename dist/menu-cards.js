const LC_EDITOR_URL = new URL('./menu-card-editor.js', import.meta.url).href;
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

// ── Dashboard actions (mirrors the config keys/behaviour of HA's own
//    tap_action / hold_action / double_tap_action, restricted to the
//    5 action types this card supports) ─────────────────────────────
function lcNavigate(path, replace) {
  if (!path) return;
  try {
    if (replace) history.replaceState(history.state, '', path);
    else history.pushState(null, '', path);
  } catch (err) { /* ignore malformed paths */ }
  window.dispatchEvent(new CustomEvent('location-changed', {
    detail: { replace: !!replace }, bubbles: true, composed: true,
  }));
}

function lcOpenUrl(url) {
  const safe = lcSanitizeUrl(url);
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
}

function lcOpenAssist(node, hass, actionConfig) {
  const pipelineId = (actionConfig && actionConfig.pipeline_id) || 'last_used';
  if (hass && hass.auth && hass.auth.external && hass.auth.external.config && hass.auth.external.config.hasAssist) {
    hass.auth.external.fireMessage({
      type: 'assist/show',
      payload: { pipeline_id: pipelineId, start_listening: true },
    });
    return;
  }
  node.dispatchEvent(new CustomEvent('show-dialog', {
    bubbles: true,
    composed: true,
    detail: {
      dialogTag: 'ha-voice-command-dialog',
      dialogImport: () => customElements.whenDefined('ha-voice-command-dialog'),
      dialogParams: { pipeline_id: pipelineId, start_listening: false },
    },
  }));
}

function lcPerformAction(hass, actionConfig) {
  if (!hass || !actionConfig || !actionConfig.perform_action) return;
  const parts = String(actionConfig.perform_action).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return;
  hass.callService(parts[0], parts[1], actionConfig.data || undefined, actionConfig.target || undefined);
}

function lcHandleAction(node, hass, actionConfig) {
  if (!actionConfig || !actionConfig.action || actionConfig.action === 'none') return;
  switch (actionConfig.action) {
    case 'navigate': lcNavigate(actionConfig.navigation_path, actionConfig.navigation_replace); break;
    case 'url': lcOpenUrl(actionConfig.url_path); break;
    case 'assist': lcOpenAssist(node, hass, actionConfig); break;
    case 'perform-action': lcPerformAction(hass, actionConfig); break;
    default: break;
  }
}

const LC_NONE_ACTION = { action: 'none' };

// Cache for the lazily-loaded HEIC/HEIF decoder (see LunchCard._loadHeicLib).
// Chrome, Firefox and Edge cannot decode HEIC natively (no browser licenses
// the HEVC codec); Safari/WebKit can, so this path only ever runs when the
// native <img> decode has already failed.
let LC_HEIC_CACHE = null;

const LC_DEFAULT = {
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

const LC_CARD_CSS = `
*,*::before,*::after{box-sizing:border-box}
:host{display:block;height:100%;container-type:inline-size}
ha-card{height:100%;overflow:hidden;box-sizing:border-box;border-radius:18px;font-family:Georgia,serif}
ha-card.lc-clickable{cursor:pointer} ha-card:focus-visible,button:focus-visible,.lc-img-wrap:focus-visible{outline:3px solid #d9a54c;outline-offset:2px}
.lc-body{height:100%;display:flex;gap:18px;min-width:0}
.lc-text{min-width:0;display:flex;flex-direction:column;flex:1}
.lc-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.lc-title{font-size:clamp(23px,3.2cqw,32px);line-height:1.08;letter-spacing:-.025em;margin:0;overflow-wrap:anywhere;font-weight:600}
.lc-rating{flex-shrink:0}.lc-stars{display:flex;gap:1px;white-space:nowrap}.lc-stars ha-icon{--mdc-icon-size:20px}.lc-score{font-size:14px;white-space:nowrap}
.lc-desc{font-size:17px;line-height:1.35;overflow-wrap:anywhere}.lc-desc p{margin:0}.lc-desc p+p{margin-top:8px}.lc-desc ul{padding-left:20px;margin:4px 0}.lc-desc a{color:inherit}
.lc-meta{display:flex;align-items:center;gap:0;border-top:1px solid;margin-top:auto;padding-top:16px}.lc-meta-item{display:flex;align-items:center;gap:8px;min-width:0;flex:1;padding:0 12px;border-right:1px solid;font-size:14px}.lc-meta-item:first-child{padding-left:0}.lc-meta-item:last-child{border-right:0;padding-right:0}.lc-meta-item ha-icon{--mdc-icon-size:24px;flex:none}.lc-meta-item span{overflow-wrap:anywhere}
.lc-images{min-width:0;min-height:0}.lc-img-wrap{overflow:hidden;position:relative;cursor:pointer;background:#ffffff12;min-width:0;min-height:0;border-radius:10px}.lc-img{width:100%;height:100%;object-fit:cover;display:block}.lc-img-fallback{display:none;width:100%;height:100%;align-items:center;justify-content:center;color:inherit;font:12px sans-serif}.lc-img-wrap.lc-img-broken .lc-img{display:none}.lc-img-wrap.lc-img-broken .lc-img-fallback{display:flex}.lc-img-fallback ha-icon{--mdc-icon-size:20px}
.bistro{background:#171717;color:#f2eadc;border:1px solid #252525;padding:14px}.bistro .lc-body{flex-direction:column-reverse;gap:18px}.bistro .lc-text{padding:0 12px 12px;gap:14px}.bistro .lc-images{height:55%;min-height:190px;display:flex;gap:6px}.bistro .lc-img-wrap{flex:1}.bistro .lc-img-wrap:first-child{flex:4}.bistro .lc-rating{color:#b6a68f}.bistro .lc-stars{color:#f2be64}.bistro .lc-desc{color:#c3bdb6}.bistro .lc-meta{border-color:#a98d63;color:#f5eee3}.bistro .lc-meta-item{border-color:#4c4842}.bistro .lc-meta ha-icon{color:#f4c05f}
.gallery{background:var(--gallery-color,#e8eddd);color:color-mix(in srgb,var(--gallery-color,#e8eddd) 22%,#101510);border:0;padding:16px}.gallery .lc-body{gap:10px}.gallery .lc-text{padding:14px 12px 8px;background:color-mix(in srgb,var(--gallery-color,#e8eddd) 42%,white);border-radius:14px;gap:8px;flex:0 0 42%}.gallery .lc-body.no-images .lc-text{flex:1 1 100%}.gallery .lc-heading{display:block}.gallery .lc-title{font-size:clamp(25px,3.6cqw,38px)}.gallery .lc-rating{display:flex;align-items:center;gap:10px;margin-top:5px}.gallery .lc-stars{color:#dd990a}.gallery .lc-score{color:color-mix(in srgb,var(--gallery-color,#e8eddd) 34%,#283028)}.gallery .lc-desc{color:color-mix(in srgb,var(--gallery-color,#e8eddd) 32%,#253025)}.gallery .lc-meta{border-color:color-mix(in srgb,var(--gallery-color,#e8eddd) 75%,#758075);padding-top:10px}.gallery .lc-meta-item{border-color:color-mix(in srgb,var(--gallery-color,#e8eddd) 75%,#758075);font-size:12px;gap:5px;padding:0 7px}.gallery .lc-meta-item:first-child{padding-left:0}.gallery .lc-meta-item ha-icon{--mdc-icon-size:20px}.gallery .lc-images{flex:1;display:grid;grid-template-columns:1.58fr 1fr;grid-template-rows:1fr 1fr;gap:6px}.gallery .lc-img-wrap:first-child{grid-row:1 / 3}.gallery .lc-images.count-1{grid-template-columns:1fr}.gallery .lc-images.count-2{grid-template-rows:1fr}.gallery .lc-images.count-2 .lc-img-wrap:first-child{grid-row:auto}
.lc-recipe{margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:12px;background:color-mix(in srgb,var(--gallery-color,#e8eddd) 30%,#142414);color:#fff;font:16px Georgia,serif;min-height:44px;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1)}.lc-recipe ha-icon{--mdc-icon-size:22px}.lc-recipe .arrow{margin-left:auto}.lc-recipe:active{transform:scale(.98)}.lc-recipe:disabled{opacity:.6;cursor:default}
.bistro .lc-placeholder{flex:1}.lc-placeholder{min-width:0;min-height:0;border-radius:10px;background:#ffffff12;display:flex;align-items:center;justify-content:center;color:#c4b7a2}.lc-placeholder ha-icon{--mdc-icon-size:38px}.gallery .lc-placeholder{background:#d3dbc8;color:#799075}.gallery .lc-placeholder:first-child{grid-row:1 / 3}:host([data-preview]) .bistro .lc-images{height:145px;min-height:145px}:host([data-preview]) .bistro .lc-text{gap:8px}:host([data-preview]) .bistro .lc-meta{padding-top:9px}:host([data-preview]) ha-card{height:auto}:host([data-preview]) .gallery .lc-images{min-height:160px}
.lc-empty{padding:18px;color:inherit;font:14px sans-serif;opacity:.8}
@container (max-width: 520px){.gallery .lc-body{flex-direction:column-reverse}.gallery .lc-text{flex:auto}.gallery .lc-images{flex:none;width:100%;height:220px}.gallery .lc-title{font-size:28px}.bistro .lc-heading{flex-wrap:wrap}.bistro .lc-images{min-height:180px}.lc-meta-item{font-size:12px;padding:0 6px}}
@media(prefers-reduced-motion:reduce){.lc-recipe{transition:none}.lc-recipe:active{transform:none}}
`;

class LunchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = { ...LC_DEFAULT };
    this._hass = null;
    this._rendered = false;
    this._preview = false;
    this._popup = null;
    this._onEsc = null;
    this._img1PictureCache = null;
    this._pressTimer = null;
    this._clickTimer = null;
    this._holdFired = false;
    this._startX = 0;
    this._startY = 0;
    this._objectUrls = [];
  }

  static _loadHeicLib() {
    if (!LC_HEIC_CACHE) {
      LC_HEIC_CACHE = import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm')
        .then(mod => (mod && (mod.default || mod)))
        .catch(err => { LC_HEIC_CACHE = null; throw err; });
    }
    return LC_HEIC_CACHE;
  }

  static async getConfigElement() { await import(LC_EDITOR_URL); return document.createElement('menu-card-editor'); }
  static getStubConfig() { return { type: this === RecipeGalleryCard ? 'custom:recipe-gallery-card' : 'custom:bistro-menu-card' }; }

  getCardSize() { return this._config.type === 'custom:recipe-gallery-card' ? 5 : 7; }
  getGridOptions() { return this._config.type === 'custom:recipe-gallery-card' ? { rows: "auto", columns: 24, min_rows: 4, min_columns: 12 } : { rows: "auto", columns: 12, min_rows: 5, min_columns: 6 }; }

  set preview(value) {
    if (this._preview !== !!value) { this._preview = !!value; this.toggleAttribute('data-preview', this._preview); if (this._rendered) this._render(); }
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...LC_DEFAULT, ...config };
    this._render();
  }

  set hass(h) {
    this._hass = h;
    if (!this._rendered) { this._render(); return; }
    const pic = this._entityPictureFor(this._config.image_1);
    if (pic !== this._img1PictureCache) {
      this._img1PictureCache = pic;
      const el = this.shadowRoot.getElementById('lc-img-1');
      if (el && pic) el.src = pic;
    }
    if (this._pendingMedia) {
      Object.keys(this._pendingMedia).forEach(n => this._tryResolveMediaSource(Number(n), this._pendingMedia[n]));
    }
  }

  get hass() { return this._hass; }

  _isInCardPicker() {
    let node = this.parentNode;
    while (node) {
      if (node.tagName && node.tagName.toLowerCase() === 'hui-card-picker') return true;
      node = node.host || node.parentNode;
    }
    return false;
  }

  connectedCallback() {
    if (this._isInCardPicker()) {
      this.setAttribute('data-preview', '');
      if (this._rendered) this._render();
    }
  }

  disconnectedCallback() {
    clearTimeout(this._pressTimer);
    clearTimeout(this._clickTimer);
    this._closePopup();
    this._objectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (err) { /* ignore */ } });
    this._objectUrls = [];
  }

  _entityPictureFor(value) {
    if (!value || !this._hass || !this._hass.states) return null;
    if (value.indexOf('image.') !== 0) return null;
    const st = this._hass.states[value];
    return (st && st.attributes && st.attributes.entity_picture) || null;
  }

  _imgSource(n) {
    const raw = this._config['image_' + n];
    if (!raw) return null;
    if (n === 1) {
      const pic = this._entityPictureFor(raw);
      if (pic) return { src: pic, async: null };
    }
    if (raw.indexOf('media-source://') === 0) return { src: '', async: raw };
    return { src: raw, async: null };
  }

  _render() {
    this._rendered = true;
    const previewSample = (this._preview || this._isInCardPicker()) && !this._config.title && !this._config.description && !this._config.image_1 && !this._config.image_2 && !this._config.image_3;
    const c = previewSample ? { ...this._config, title:'Cremige Tomatenpasta', rating:5, rating_count:128, description:'Samtige Tomatensauce mit Knoblauch, frischem Basilikum und Parmesan.', duration:'25 Min.', difficulty:'Einfach', category:'Vegetarisch' } : this._config;
    const maxR = Math.max(0, Math.min(10, Number(c.max_rating) || 0));
    const rating = lcClampRating(c.rating, maxR);
    const hasTitle = !!c.title;
    const hasStars = maxR > 0 && c.rating !== null && c.rating !== undefined && c.rating !== '' && Number.isFinite(Number(c.rating));
    const hasDesc = !!(c.description && String(c.description).trim());
    const imgs = [1, 2, 3].map(n => ({ n, v: this._imgSource(n) }));
    const anyImg = imgs.some(i => i.v) || previewSample;
    const hasContent = hasTitle || hasStars || hasDesc || anyImg;
    const tapActive = !!(c.tap_action && c.tap_action.action && c.tap_action.action !== 'none');

    const gallery = c.type === 'custom:recipe-gallery-card';
    const rawRating = Math.max(0, Math.min(maxR, Number(c.rating) || 0));
    const count = c.rating_count !== null && c.rating_count !== '' && Number.isFinite(Number(c.rating_count)) ? ` (${lcEsc(Math.max(0, Math.floor(Number(c.rating_count))))})` : '';
    let starsHtml = '';
    if (hasStars) {
      const full = Math.floor(rating), half = rating - full >= .5 ? 1 : 0;
      starsHtml = `<div class="lc-rating" aria-label="${rawRating.toFixed(1)} von ${maxR} Sternen${count}"><div class="lc-stars" aria-hidden="true">${'<ha-icon icon="mdi:star"></ha-icon>'.repeat(full)}${half ? '<ha-icon icon="mdi:star-half-full"></ha-icon>' : ''}${'<ha-icon icon="mdi:star-outline"></ha-icon>'.repeat(Math.max(0, maxR-full-half))}</div><div class="lc-score">${rawRating.toFixed(1)}${count}</div></div>`;
    }
    const metadata = [['mdi:clock-outline',c.duration],['mdi:chef-hat',c.difficulty],['mdi:leaf',c.category]].filter(x => x[1] !== null && x[1] !== undefined && String(x[1]).trim());
    const metaHtml = metadata.length ? `<div class="lc-meta">${metadata.map(([icon,value]) => `<div class="lc-meta-item"><ha-icon icon="${icon}"></ha-icon><span>${lcEsc(value)}</span></div>`).join('')}</div>` : '';
    const visibleImages = imgs.filter(i => i.v);
    let imagesHtml = '';
    if (previewSample) {
      imagesHtml = `<div class="lc-images lc-preview-images count-${gallery ? 3 : 1}">${Array.from({length: gallery ? 3 : 1}, () => '<div class="lc-placeholder"><ha-icon icon="mdi:image-outline"></ha-icon></div>').join('')}</div>`;
    } else if (anyImg) {
      imagesHtml = `<div class="lc-images count-${visibleImages.length}">` + visibleImages.map(({ n, v }) => {
        const src = v.async ? '' : lcEsc(lcSanitizeUrl(v.src));
        return `<div class="lc-img-wrap" data-n="${n}" role="button" tabindex="0" aria-label="Bild ${n} vergrößern"><img class="lc-img" id="lc-img-${n}" ${src ? `src="${src}"` : ''} alt="${lcEsc(c.title || ('Bild ' + n))}" loading="lazy"><div class="lc-img-fallback"><ha-icon icon="mdi:image-off-outline"></ha-icon><span>Kein Bild</span></div></div>`;
      }).join('') + '</div>';
    }
    const recipe = c.recipe || {};
    const recipeActive = recipe.action && recipe.action.action && recipe.action.action !== 'none';
    const recipeHtml = gallery && (recipeActive || previewSample) ? `<button class="lc-recipe" type="button" ${previewSample ? 'disabled' : ''}><ha-icon icon="mdi:book-open-page-variant-outline"></ha-icon><span>${lcEsc(recipe.label || 'Rezept anzeigen')}</span><ha-icon class="arrow" icon="mdi:chevron-right"></ha-icon></button>` : '';
    this.shadowRoot.innerHTML = `
<style>${LC_CARD_CSS}</style>
<ha-card style="${gallery && /^#[0-9a-f]{6}$/i.test(c.card_color || '') ? `--gallery-color:${c.card_color}` : ''}" class="${gallery ? 'gallery' : 'bistro'} ${tapActive ? 'lc-clickable' : ''}"${tapActive ? ' tabindex="0"' : ''}>
  ${hasContent ? `<div class="lc-body${anyImg ? '' : ' no-images'}"><div class="lc-text"><div class="lc-heading">${hasTitle ? `<div class="lc-title">${lcEsc(c.title)}</div>` : ''}${starsHtml}</div>${hasDesc ? `<div class="lc-desc">${lcMarkdown(c.description)}</div>` : ''}${metaHtml}${recipeHtml}</div>${imagesHtml}</div>` : `<div class="lc-empty">Konfiguriere diese Karte, um ein Gericht anzuzeigen.</div>`}
</ha-card>`;

    const card = this.shadowRoot.querySelector('ha-card');
    this._attachCardActions(card);
    const recipeButton = this.shadowRoot.querySelector('.lc-recipe');
    if (recipeButton) recipeButton.addEventListener('click', ev => { ev.stopPropagation(); if (recipe.action && recipe.action.action === 'recipe') this._showRecipe(recipe.recipe_details || {}, c); else lcHandleAction(recipeButton, this._hass, recipe.action); });

    this.shadowRoot.querySelectorAll('.lc-img-wrap').forEach(wrap => {
      const img = wrap.querySelector('img');
      if (img) {
        img.addEventListener('load', () => wrap.classList.remove('lc-img-broken'));
        img.addEventListener('error', () => {
          if (img.dataset.lcHeicTried) { wrap.classList.add('lc-img-broken'); return; }
          img.dataset.lcHeicTried = '1';
          this._tryHeicRecovery(img, wrap);
        });
      }
      wrap.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); wrap.click(); } });
      wrap.addEventListener('pointerdown', ev => ev.stopPropagation());
      wrap.addEventListener('click', () => {
        if (wrap.classList.contains('lc-img-broken')) return;
        if (img && img.getAttribute('src')) this._showImagePopup(img.src, c.title);
      });
    });

    imgs.forEach(({ n, v }) => { if (v && v.async) this._tryResolveMediaSource(n, v.async); });

    this._img1PictureCache = this._entityPictureFor(c.image_1);
  }

  _tryResolveMediaSource(n, mediaContentId) {
    if (!this._pendingMedia) this._pendingMedia = {};
    this._pendingMedia[n] = mediaContentId;
    if (!this._hass || !this._hass.callWS) return;
    this._hass.callWS({
      type: 'media_source/resolve_media',
      media_content_id: mediaContentId,
    }).then(res => {
      if (this._pendingMedia) delete this._pendingMedia[n];
      const el = this.shadowRoot.getElementById('lc-img-' + n);
      if (el && res && res.url) el.src = res.url;
    }).catch(err => {
      console.warn('[lunch-card] could not resolve media source for image_' + n, mediaContentId, err);
    });
  }

  _attachCardActions(el) {
    if (!el) return;
    const c = this._config;
    const hasHold = !!(c.hold_action && c.hold_action.action && c.hold_action.action !== 'none');
    const hasDouble = !!(c.double_tap_action && c.double_tap_action.action && c.double_tap_action.action !== 'none');

    el.addEventListener('pointerdown', ev => {
      if (ev.target.closest && ev.target.closest('.lc-recipe, a')) return;
      this._holdFired = false;
      const pt = ev.touches ? ev.touches[0] : ev;
      this._startX = pt.clientX; this._startY = pt.clientY;
      if (hasHold) {
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => {
          this._holdFired = true;
          lcHandleAction(el, this._hass, c.hold_action);
        }, 500);
      }
    });
    el.addEventListener('pointermove', ev => {
      const pt = ev.touches ? ev.touches[0] : ev;
      if (Math.abs(pt.clientX - this._startX) > 12 || Math.abs(pt.clientY - this._startY) > 12) {
        clearTimeout(this._pressTimer);
      }
    });
    const clearPress = () => clearTimeout(this._pressTimer);
    el.addEventListener('pointerup', clearPress);
    el.addEventListener('pointercancel', clearPress);

    el.addEventListener('click', ev => {
      if (ev.target.closest && ev.target.closest('.lc-img-wrap, .lc-recipe, a')) return;
      if (this._holdFired) { this._holdFired = false; return; }
      if (hasDouble) {
        if (this._clickTimer) {
          clearTimeout(this._clickTimer);
          this._clickTimer = null;
          lcHandleAction(el, this._hass, c.double_tap_action);
        } else {
          this._clickTimer = setTimeout(() => {
            this._clickTimer = null;
            lcHandleAction(el, this._hass, c.tap_action);
          }, 260);
        }
      } else {
        lcHandleAction(el, this._hass, c.tap_action);
      }
    });
    el.addEventListener('keydown', ev => {
      if (ev.target !== el) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        lcHandleAction(el, this._hass, c.tap_action);
      }
    });
  }

  // Only reached after a native <img> decode has already failed once (see the
  // 'error' listener below). Chrome/Firefox/Edge can't decode HEIC/HEIF, so
  // this fetches the original bytes and converts them to a JPEG in the
  // browser via a lazily-loaded WASM decoder. Needs the source to be
  // same-origin-fetchable (true for image.* entities and HA media — both
  // served by Home Assistant itself; an arbitrary external https:// HEIC URL
  // without CORS headers will still fall through to the fallback icon).
  async _tryHeicRecovery(img, wrap) {
    const src = img.src;
    try {
      const heic2any = await this.constructor._loadHeicLib();
      const resp = await fetch(src);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const result = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 });
      const outBlob = Array.isArray(result) ? result[0] : result;
      const objectUrl = URL.createObjectURL(outBlob);
      this._objectUrls.push(objectUrl);
      img.src = objectUrl;
    } catch (err) {
      console.warn('[lunch-card] could not display image (possibly HEIC/HEIF, unsupported in this browser)', src, err);
      wrap.classList.add('lc-img-broken');
    }
  }

  _showRecipe(details, config) {
    this._closePopup();
    const previous = document.activeElement;
    const overlay = document.createElement('div');
    const color = /^#[0-9a-f]{6}$/i.test(config.card_color || '') ? config.card_color : '#e8eddd';
    const ingredients = Array.isArray(details.ingredients) ? details.ingredients : [];
    const steps = Array.isArray(details.steps) ? details.steps : [];
    overlay.innerHTML = `<style>
      .recipe-overlay{position:fixed;inset:0;z-index:9999;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Georgia,serif}
      .recipe-dialog{width:min(660px,100%);max-height:90dvh;overflow:auto;border-radius:20px;background:var(--base);color:#213026;padding:clamp(22px,5vw,38px);box-shadow:0 24px 80px #0006}
      .recipe-top{display:flex;align-items:start;justify-content:space-between;gap:16px}.recipe-kicker{font:700 11px system-ui;letter-spacing:.16em;text-transform:uppercase;opacity:.65}.recipe-title{font-size:32px;line-height:1.1;margin:8px 0 20px}.recipe-close{border:0;background:#fff8;border-radius:50%;width:40px;height:40px;font-size:24px;cursor:pointer;color:inherit}.recipe-section{background:#ffffff80;border-radius:14px;padding:20px;margin-top:12px}.recipe-section h3{font-size:20px;margin:0 0 14px}.recipe-section ul,.recipe-section ol{padding-left:22px;margin:0;line-height:1.6}.recipe-section li+li{margin-top:8px}.recipe-empty{opacity:.7}
      </style><div class="recipe-overlay"><section class="recipe-dialog" role="dialog" aria-modal="true" aria-labelledby="recipe-title" style="--base:${color}"><div class="recipe-top"><div><div class="recipe-kicker">Rezept</div><h2 class="recipe-title" id="recipe-title">${lcEsc(config.title || 'Rezept')}</h2></div><button class="recipe-close" aria-label="Schließen">×</button></div><div class="recipe-section"><h3>Zutaten</h3>${ingredients.length ? `<ul>${ingredients.map(x => `<li>${lcEsc(x)}</li>`).join('')}</ul>` : '<div class="recipe-empty">Keine Zutaten angegeben.</div>'}</div><div class="recipe-section"><h3>Zubereitung</h3>${steps.length ? `<ol>${steps.map(x => `<li>${lcEsc(x)}</li>`).join('')}</ol>` : '<div class="recipe-empty">Keine Zubereitung angegeben.</div>'}</div></section></div>`;
    const backdrop = overlay.firstElementChild.nextElementSibling;
    const close = () => { this._closePopup(); if (previous && previous.focus) previous.focus(); };
    overlay.querySelector('.recipe-close').addEventListener('click', close);
    backdrop.addEventListener('click', ev => { if (ev.target === backdrop) close(); });
    this._onEsc = ev => { if (ev.key === 'Escape') close(); else if (ev.key === 'Tab') { ev.preventDefault(); overlay.querySelector('.recipe-close').focus(); } };
    document.addEventListener('keydown', this._onEsc);
    document.body.appendChild(overlay); this._popup = overlay;
    overlay.querySelector('.recipe-close').focus();
  }

  _showImagePopup(src, title) {
    this._closePopup();
    const overlay = document.createElement('div');
    overlay.className = 'lc-popup-overlay';
    overlay.innerHTML = `
      <style>
        .lc-popup-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:lcFadeIn .16s ease}
        @keyframes lcFadeIn{from{opacity:0}to{opacity:1}}
        .lc-popup-wrap{position:relative;max-width:92vw;max-height:86vh;animation:lcSlideUp .18s cubic-bezier(.34,1.26,.64,1)}
        @keyframes lcSlideUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
        .lc-popup-img{display:block;max-width:92vw;max-height:86vh;border-radius:var(--ha-card-border-radius,12px);box-shadow:0 24px 64px rgba(0,0,0,.4)}
        .lc-popup-close{position:absolute;top:-14px;right:-14px;background:var(--card-background-color,#fff);border:none;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--primary-text-color);box-shadow:0 2px 8px rgba(0,0,0,.3)}
      </style>
      <div class="lc-popup-wrap">
        <img class="lc-popup-img" src="${lcEsc(src)}" alt="${lcEsc(title || 'Image')}">
        <button class="lc-popup-close" id="lc-pop-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>`;
    overlay.addEventListener('click', ev => { if (ev.target === overlay) this._closePopup(); });
    overlay.querySelector('#lc-pop-close').addEventListener('click', () => this._closePopup());
    this._onEsc = ev => { if (ev.key === 'Escape') this._closePopup(); };
    document.addEventListener('keydown', this._onEsc);
    document.body.appendChild(overlay);
    this._popup = overlay;
  }

  _closePopup() {
    if (this._popup) { this._popup.remove(); this._popup = null; }
    if (this._onEsc) { document.removeEventListener('keydown', this._onEsc); this._onEsc = null; }
  }
}
class BistroMenuCard extends LunchCard {}
class RecipeGalleryCard extends LunchCard {}
customElements.define('bistro-menu-card', BistroMenuCard);
customElements.define('recipe-gallery-card', RecipeGalleryCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'bistro-menu-card',name:'Bistro Menu Card',description:'Dark, photo-led meal card',preview:true}, {type:'recipe-gallery-card',name:'Recipe Gallery Card',description:'Colorful meal card with photo gallery',preview:true});
