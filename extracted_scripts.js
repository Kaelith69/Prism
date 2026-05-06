<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>
/* ──────────────────────────────
   State
────────────────────────────── */
let slides = [];
let currentIdx = 0;
let presentationData = null;
let notesVisible = false;
let slideIdCounter = 0;
let isGenerating = false; // in-flight guard

/* ──────────────────────────────
   Security helpers
────────────────────────────── */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize an SVG string via DOMParser round-trip.
 * Strips <script> elements and on* event attributes before innerHTML injection.
 */
function sanitizeSVG(raw) {
  if (typeof raw !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return '';
    const svg = doc.documentElement;
    svg.querySelectorAll('script').forEach(el => el.remove());
    svg.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
    return new XMLSerializer().serializeToString(svg);
  } catch { return ''; }
}

/* ──────────────────────────────
   Theme application
────────────────────────────── */
const _loadedFonts = new Set(['Libre Baskerville', 'IBM Plex Mono']);

function loadFont(fontName) {
  if (!fontName || _loadedFonts.has(fontName)) return;
  _loadedFonts.add(fontName);
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  // Google Fonts needs spaces replaced with '+'
  link.href   = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

function applyTheme(tc) {
  if (!tc) return;
  loadFont(tc.font); // ensure font is available before the frame paints
  const frame = document.getElementById('slide-frame');
  // Set CSS custom properties that cascade down to all slide child elements
  frame.style.setProperty('--th-bg',        tc.bg        || '#ffffff');
  frame.style.setProperty('--th-text',      tc.text      || '#111111');
  frame.style.setProperty('--th-accent',    tc.accent    || '#2563EB');
  frame.style.setProperty('--th-secondary', tc.secondary || '#64748B');
  frame.style.setProperty('--th-font',      `'${tc.font || 'Libre Baskerville'}', Georgia, serif`);
  // Also set directly so the frame element itself (background, color) updates
  frame.style.background  = tc.bg   || '#ffffff';
  frame.style.color       = tc.text || '#111111';
  frame.style.fontFamily  = `'${tc.font || 'Libre Baskerville'}', Georgia, serif`;
}

function resetTheme() {
  const frame = document.getElementById('slide-frame');
  frame.style.removeProperty('--th-bg');
  frame.style.removeProperty('--th-text');
  frame.style.removeProperty('--th-accent');
  frame.style.removeProperty('--th-secondary');
  frame.style.removeProperty('--th-font');
  frame.style.background = '';
  frame.style.color      = '';
  frame.style.fontFamily = '';
}

/* ──────────────────────────────
   Live UI Theme Engine
   Mirrors server-side THEMES — updates CSS vars on :root instantly
   when the user picks a theme, giving a real-time preview.
────────────────────────────── */
const UI_THEMES = {
  minimalist: {
    font: 'DM Sans',
    surface: '#FEFEFE', surface2: '#F2F6FF', surface3: '#E4ECFA',
    ink: '#1A1A1A', ink2: '#3C3C3C', ink3: '#6E6E6E', ink4: '#A0A0A0',
    border: '#DDE4F0', border2: '#C8D2E8',
    primary: '#3B7DD8', signal: '#C0392B', btnText: '#ffffff',
    uiRadius: '4px', uiBorderW: '1px', uiShadow: '0 4px 20px rgba(59, 125, 216, 0.1)', uiShadowHover: '0 8px 30px rgba(59, 125, 216, 0.2)'
  },
  professional: {
    font: 'Merriweather',
    surface: '#0F1E3A', surface2: '#182848', surface3: '#203460',
    ink: '#E8EDF8', ink2: '#B8C8E4', ink3: '#7890B8', ink4: '#4860A0',
    border: '#253760', border2: '#304878',
    primary: '#4D9FFF', signal: '#FF6B6B', btnText: '#0F1E3A',
    uiRadius: '2px', uiBorderW: '1px', uiShadow: '0 2px 10px rgba(0,0,0,0.4)', uiShadowHover: '0 4px 15px rgba(0,0,0,0.6)'
  },
  dark: {
    font: 'Syne',
    surface: '#07090F', surface2: '#0E1020', surface3: '#161830',
    ink: '#EDE8F8', ink2: '#C0B4E0', ink3: '#8870B8', ink4: '#504080',
    border: '#1C1838', border2: '#28224C',
    primary: '#A78BFA', signal: '#F87171', btnText: '#07090F',
    uiRadius: '6px', uiBorderW: '1px', uiShadow: '0 4px 24px rgba(167, 139, 250, 0.15)', uiShadowHover: '0 6px 32px rgba(167, 139, 250, 0.3)'
  },
  scientific: {
    font: 'Source Serif 4',
    surface: '#F4F7FF', surface2: '#E8EFFE', surface3: '#D8E4FC',
    ink: '#0D1E3C', ink2: '#1E3560', ink3: '#4A68A8', ink4: '#7898C8',
    border: '#C0D0EE', border2: '#A8BCDE',
    primary: '#1A56DB', signal: '#DC2626', btnText: '#ffffff',
    uiRadius: '0px', uiBorderW: '1px', uiShadow: '0 2px 4px rgba(26, 86, 219, 0.1)', uiShadowHover: '0 4px 12px rgba(26, 86, 219, 0.2)'
  },
  cyberpunk: {
    font: 'Orbitron',
    surface: '#020610', surface2: '#060E20', surface3: '#0A1530',
    ink: '#DFFFF6', ink2: '#90DEC8', ink3: '#409898', ink4: '#205858',
    border: '#082030', border2: '#103040',
    primary: '#00FFB2', signal: '#FF007A', btnText: '#020610',
    uiRadius: '0px', uiBorderW: '1px', uiShadow: '0 0 10px rgba(0, 255, 178, 0.4)', uiShadowHover: '0 0 20px rgba(0, 255, 178, 0.8)'
  },
  brutalist: {
    font: 'Space Mono',
    surface: '#FFFFFF', surface2: '#F0F0F0', surface3: '#E0E0E0',
    ink: '#000000', ink2: '#1A1A1A', ink3: '#4A4A4A', ink4: '#7A7A7A',
    border: '#000000', border2: '#2A2A2A',
    primary: '#FF0000', signal: '#FF0000', btnText: '#FFFFFF',
    uiRadius: '0px', uiBorderW: '2px', uiShadow: 'none', uiShadowHover: 'none'
  },
  colorful: {
    font: 'Nunito',
    surface: '#FCF5FF', surface2: '#F4E8FF', surface3: '#E8D0FF',
    ink: '#1A0830', ink2: '#381060', ink3: '#7040A8', ink4: '#A870D8',
    border: '#D8B0F0', border2: '#C898E8',
    primary: '#D946EF', signal: '#FF3D00', btnText: '#ffffff',
    uiRadius: '12px', uiBorderW: '0px', uiShadow: '0 8px 24px rgba(217, 70, 239, 0.2)', uiShadowHover: '0 12px 32px rgba(217, 70, 239, 0.35)'
  },
  classic: {
    font: 'EB Garamond',
    surface: '#F9F2DF', surface2: '#F0E6C8', surface3: '#E5D4A8',
    ink: '#2A1500', ink2: '#4A2800', ink3: '#7A5830', ink4: '#AA8860',
    border: '#D8C890', border2: '#C0B078',
    primary: '#9B6400', signal: '#B03020', btnText: '#F9F2DF',
    uiRadius: '2px', uiBorderW: '1px', uiShadow: '0 4px 10px rgba(42, 21, 0, 0.15)', uiShadowHover: '0 6px 14px rgba(42, 21, 0, 0.25)'
  },
  'neo-brutalist': {
    font: 'Space Grotesk',
    surface: '#FFFBEE', surface2: '#FFF0CC', surface3: '#FFE4A8',
    ink: '#111111', ink2: '#222222', ink3: '#555555', ink4: '#888888',
    border: '#111111', border2: '#333333',
    primary: '#FF5722', signal: '#CC0000', btnText: '#ffffff',
    uiRadius: '6px', uiBorderW: '3px', uiShadow: '4px 4px 0px #111111', uiShadowHover: '6px 6px 0px #111111'
  },
  kids: {
    font: 'Fredoka One',
    surface: '#FFFDE7', surface2: '#FFF4B8', surface3: '#FFE880',
    ink: '#1A0050', ink2: '#3A0080', ink3: '#7030A8', ink4: '#A868D0',
    border: '#F8C0D8', border2: '#F4A0C8',
    primary: '#FF4081', signal: '#FF1744', btnText: '#ffffff',
    uiRadius: '24px', uiBorderW: '3px', uiShadow: '0 8px 0px rgba(255, 64, 129, 0.2)', uiShadowHover: '0 12px 0px rgba(255, 64, 129, 0.3)'
  },
  'colorblind-safe': {
    font: 'Outfit',
    surface: '#FFFFFF', surface2: '#EEF4FB', surface3: '#DDE8F6',
    ink: '#111111', ink2: '#2A3A4A', ink3: '#5A6A7A', ink4: '#8A9AAA',
    border: '#C0D0DC', border2: '#A8B8C8',
    primary: '#0072B2', signal: '#CC3311', btnText: '#ffffff',
    uiRadius: '4px', uiBorderW: '2px', uiShadow: '0 4px 12px rgba(0, 114, 178, 0.15)', uiShadowHover: '0 6px 16px rgba(0, 114, 178, 0.25)'
  }
,  claude: {
    font: 'Plus Jakarta Sans',
    surface: '#FAF9F7', surface2: '#F0EBE3', surface3: '#E6DDD4',
    ink: '#1C1917', ink2: '#3D2E28', ink3: '#78584E', ink4: '#A88278',
    border: '#E8DDD4', border2: '#D8C8BA',
    primary: '#DA7756', signal: '#C0392B', btnText: '#ffffff',
    uiRadius: '8px', uiBorderW: '1px', uiShadow: '0 2px 8px rgba(28, 25, 23, 0.05)', uiShadowHover: '0 6px 16px rgba(28, 25, 23, 0.08)'
  }
};

function applyUITheme(key) {
  const t = UI_THEMES[key] || UI_THEMES.minimalist;
  const r = document.documentElement.style;
  loadFont(t.font);
  r.setProperty('--surface',   t.surface);
  r.setProperty('--surface-2', t.surface2);
  r.setProperty('--surface-3', t.surface3);
  r.setProperty('--ink',       t.ink);
  r.setProperty('--ink-2',     t.ink2);
  r.setProperty('--ink-3',     t.ink3);
  r.setProperty('--ink-4',     t.ink4);
  r.setProperty('--border',    t.border);
  r.setProperty('--border-2',  t.border2);
  r.setProperty('--primary',   t.primary);
  r.setProperty('--active',    t.primary);
  r.setProperty('--signal',    t.signal);
  r.setProperty('--btn-text',  t.btnText || '#ffffff');
  
  // Physical Geometry
  r.setProperty('--ui-radius', t.uiRadius || '3px');
  r.setProperty('--ui-border-w', t.uiBorderW || '1px');
  r.setProperty('--ui-shadow', t.uiShadow || '0 2px 8px rgba(0,0,0,0.2)');
  r.setProperty('--ui-shadow-hover', t.uiShadowHover || '0 2px 12px rgba(0,0,0,0.22)');
  // Apply theme display font to the brand and page heading
  const displayFont = `'${t.font}', Georgia, serif`;
  document.querySelector('.brand').style.fontFamily          = displayFont;
  document.querySelector('.page-intro h1').style.fontFamily  = displayFont;
}

function resetUITheme() {
  const r = document.documentElement.style;
  ['--surface','--surface-2','--surface-3',
   '--ink','--ink-2','--ink-3','--ink-4',
   '--border','--border-2','--primary','--active','--signal','--btn-text'
  ].forEach(v => r.removeProperty(v));
  // Restore default fonts
  document.querySelector('.brand').style.fontFamily         = '';
  document.querySelector('.page-intro h1').style.fontFamily = '';
}

// Wire theme select to live preview
// Also re-applies slide frame theme if a presentation is already loaded
document.getElementById('ppt-theme').addEventListener('change', function() {
  applyUITheme(this.value);
  // If slides are already rendered, also update the slide frame theme
  // so the preview stays in sync with the selected theme
  if (presentationData?.theme_config) {
    // Build a transient theme config from UI_THEMES to preview the new theme
    const previewKey = this.value;
    const ut = UI_THEMES[previewKey];
    if (ut) {
      applyTheme({
        bg:        ut.surface,
        text:      ut.ink,
        accent:    ut.primary,
        secondary: ut.ink3,
        font:      ut.font
      });
    }
  }
});

// Auto-apply the default theme on first paint
applyUITheme(document.getElementById('ppt-theme').value || 'minimalist');

/* ──────────────────────────────
   Toggles
────────────────────────────── */
function toggleTrack(id, itemEl) {
  const track = document.getElementById(id);
  track.classList.toggle('on');
  // Sync ARIA state on the parent toggle-item
  const el = itemEl || track.closest('.toggle-item');
  if (el) el.setAttribute('aria-checked', track.classList.contains('on'));
  syncGlobalToggles();
}
function isOn(id) { return document.getElementById(id).classList.contains('on'); }

function syncGlobalToggles() {
  const graphsOn = isOn('tg-graphs');
  const diagramsOn = isOn('tg-diagrams');
  
  document.querySelectorAll('#slides-list .slide-item select').forEach(sel => {
    Array.from(sel.options).forEach(opt => {
      const isChart = ['bar_chart', 'line_chart', 'pie_chart'].includes(opt.value);
      const isDiagram = ['flow_diagram', 'tree_diagram', 'block_diagram'].includes(opt.value);
      if (isChart) opt.disabled = !graphsOn;
      if (isDiagram) opt.disabled = !diagramsOn;
    });
    
    const selected = sel.value;
    const isChart = ['bar_chart', 'line_chart', 'pie_chart'].includes(selected);
    const isDiagram = ['flow_diagram', 'tree_diagram', 'block_diagram'].includes(selected);
    if ((isChart && !graphsOn) || (isDiagram && !diagramsOn)) {
      sel.value = 'auto';
    }
  });
}

/* ──────────────────────────────
   Slide Builder
────────────────────────────── */
function syncListVisibility() {
  const list = document.getElementById('slides-list');
  const empty = document.getElementById('slides-empty');
  const hasItems = list.children.length > 0;
  list.style.display = hasItems ? 'flex' : 'none';
  empty.style.display = hasItems ? 'none' : 'block';
}

function addSlide() {
  slideIdCounter++;
  const id = slideIdCounter;
  const list = document.getElementById('slides-list');

  const div = document.createElement('div');
  div.className = 'slide-item';
  div.id = `si-${id}`;
  div.innerHTML = `
    <span class="slide-num">${list.children.length + 1}</span>
    <input type="text" placeholder="Slide title or topic" class="s-title-inp"/>
    <div class="vis-ctrl">
      <input type="checkbox" id="vc-${id}" checked onchange="syncVis(${id})"/>
      <select id="vs-${id}" class="">
        <option value="auto">auto</option>
        <option value="bar_chart">bar</option>
        <option value="line_chart">line</option>
        <option value="pie_chart">pie</option>
        <option value="flow_diagram">flow</option>
        <option value="tree_diagram">tree</option>
        <option value="block_diagram">block</option>
        <option value="none">none</option>
      </select>
    </div>
    <button class="slide-del" onclick="removeSlide(${id})" title="Remove">×</button>
  `;
  list.appendChild(div);
  syncListVisibility();
  renumber();
  syncGlobalToggles();
  
  const maxEl = document.getElementById('max-slides');
  const minEl = document.getElementById('min-slides');
  const currentCount = list.children.length;
  let maxV = parseInt(maxEl.value, 10) || 10;
  
  if (currentCount > maxV) {
    maxEl.value = currentCount > 32 ? 32 : currentCount;
    validateSlideRange();
  }
}

function removeSlide(id) {
  const el = document.getElementById(`si-${id}`);
  if (!el) return; // guard: element may have already been removed
  el.style.opacity = '0';
  el.style.transform = 'translateX(8px)';
  el.style.transition = 'opacity 0.15s, transform 0.15s';
  setTimeout(() => { el.remove(); renumber(); syncListVisibility(); }, 160);
}

function renumber() {
  document.querySelectorAll('#slides-list .slide-num').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

function syncVis(id) {
  const cb = document.getElementById(`vc-${id}`);
  const sel = document.getElementById(`vs-${id}`);
  sel.disabled = !cb.checked;
  sel.style.opacity = cb.checked ? '1' : '0.4';
}

function getSlideItems() {
  return Array.from(document.querySelectorAll('#slides-list .slide-item')).map((item, i) => ({
    title: item.querySelector('.s-title-inp')?.value.trim() || `Slide ${i + 1}`,
    needs_visual: item.querySelector('input[type="checkbox"]')?.checked ?? true,
    visual_type: item.querySelector('select')?.value || 'auto'
  }));
}

/* Validate that min <= max and give instant user feedback */
function validateSlideRange() {
  const minEl = document.getElementById('min-slides');
  const maxEl = document.getElementById('max-slides');
  const genBtn = document.getElementById('generate-btn');
  const min = parseInt(minEl.value, 10) || 3;
  const max = parseInt(maxEl.value, 10) || 32;
  if (min > max) {
    minEl.style.borderColor = 'var(--signal)';
    maxEl.style.borderColor = 'var(--signal)';
    genBtn.disabled = true;
    showError('Min slides cannot be greater than max slides.');
  } else {
    minEl.style.borderColor = '';
    maxEl.style.borderColor = '';
    genBtn.disabled = false;
    clearError();
  }
}

/* ──────────────────────────────
   Generate
────────────────────────────── */
const LOAD_MSGS = [
  'Structuring content…',
  'Drafting slide copy…',
  'Mapping visualizations…',
  'Applying theme and layout…',
  'Finishing up…'
];

async function generate() {
  if (isGenerating) return;
  const btn = document.getElementById('generate-btn'); // single source of truth
  const title = document.getElementById('ppt-title').value.trim();
  if (!title) { showError('A title is required to generate slides.'); return; }

  // Read slide range once — prevents stale read in payload vs validation
  const minV = parseInt(document.getElementById('min-slides').value, 10) || 5;
  const maxV = parseInt(document.getElementById('max-slides').value, 10) || 10;
  if (minV > maxV) {
    showError('Min slides cannot be greater than max slides.');
    return;
  }

  isGenerating = true;
  const genLabel = document.getElementById('gen-label');
  const payload = {
    title,
    author:           document.getElementById('ppt-author').value.trim(),
    details:          document.getElementById('ppt-details').value.trim(),
    theme:            document.getElementById('ppt-theme').value,
    min_slides:       minV,
    max_slides:       maxV,
    graphs_enabled:   isOn('tg-graphs'),
    diagrams_enabled: isOn('tg-diagrams'),
    slides:           getSlideItems()
  };

  clearError();
  setLoading(true);
  btn.disabled = true;
  genLabel.textContent = 'Generating…';

  // Animate progress bar
  let msgIdx = 0;
  const bar   = document.getElementById('loader-bar');
  const msgEl = document.getElementById('loader-msg');
  const progInterval = setInterval(() => {
    const pct = Math.min((msgIdx + 1) * 18, 90);
    bar.style.width = pct + '%';
    msgEl.textContent = LOAD_MSGS[msgIdx] || LOAD_MSGS[LOAD_MSGS.length - 1];
    msgIdx++;
  }, 900);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');

    clearInterval(progInterval);
    bar.style.width = '100%';
    msgEl.textContent = 'Done.';
    document.getElementById('status-dot').innerHTML = 'System � Rendered';

    await new Promise(r => setTimeout(r, 300));

    presentationData = data.presentation;
    slides = presentationData.slides || [];
    renderPresentation();
  } catch (err) {
    clearInterval(progInterval);
    showError(err.message);
  } finally {
    isGenerating = false;
    setLoading(false);
    bar.style.width = '0%';
    btn.disabled = false;
    genLabel.textContent = 'Generate presentation';
    document.getElementById('status-dot').innerHTML = 'System � Ready';
  }
}

/* ──────────────────────────────
   Render
────────────────────────────── */
function renderPresentation() {
  currentIdx   = 0;
  notesVisible = false;
  document.getElementById('notes-drawer').classList.remove('on');
  document.getElementById('notes-tog').textContent = 'notes';

  document.getElementById('v-title').textContent = presentationData.presentation_title || 'Untitled';
  // Show author in meta if present
  const authorStr = presentationData.author ? ` · ${presentationData.author}` : '';
  document.getElementById('v-meta').textContent =
    `${slides.length} slides · ${presentationData.theme || 'minimalist'} theme${authorStr}`;

  // Apply the selected theme to the slide frame (colors + font)
  applyTheme(presentationData.theme_config);

  renderThumbs();
  renderSlide(0);

  document.getElementById('slide-nav').classList.add('ready');

  const vs = document.getElementById('viewer-section');
  vs.classList.add('on');
  vs.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderThumbs() {
  const accent = presentationData?.theme_config?.accent || '';
  document.getElementById('thumb-rail').innerHTML = slides.map((s, i) => `
    <div class="slide-thumb ${i === 0 ? 'active' : ''}" id="th-${i}" onclick="goTo(${i})"
         style="${i === 0 && accent ? `border-color:${accent}` : ''}">
      <span class="thumb-idx">${i + 1}</span>
      <span class="thumb-label">${escapeHTML(s.title)}</span>
    </div>
  `).join('');
}

function renderSlide(idx) {
  // Bounds guard
  if (!slides.length || idx < 0 || idx >= slides.length) return;
  currentIdx = idx;
  const slide = slides[idx];

  // Sync active thumbnail with theme accent and scroll into view
  const accent = presentationData?.theme_config?.accent || '';
  document.querySelectorAll('.slide-thumb').forEach((t, i) => {
    const isActive = i === idx;
    t.classList.toggle('active', isActive);
    // Apply theme accent to active thumb border; clear it when inactive
    t.style.borderColor = isActive && accent ? accent : '';
    if (isActive) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  const frame = document.getElementById('slide-frame');
  frame.classList.add('transitioning');

  setTimeout(() => {
    frame.innerHTML = buildSlideHTML(slide, idx);
    frame.classList.remove('transitioning');
  }, 120);

  // Notes
  document.getElementById('notes-text').textContent = slide.speaker_notes || '—';
  document.getElementById('slide-count').textContent = `${idx + 1} / ${slides.length}`;
  document.getElementById('prev-btn').disabled = idx === 0;
  document.getElementById('next-btn').disabled = idx === slides.length - 1;
}

function buildSlideHTML(slide, idx) {
  const isTitleSlide = idx === 0 || slide.layout === 'title-only';
  const author = presentationData?.author || '';

  if (isTitleSlide) {
    return `
      <div class="slide-title-slide">
        <div class="slide-kicker">Presentation · ${idx + 1} of ${slides.length}</div>
        <div class="slide-rule"></div>
        <div class="slide-h1">${escapeHTML(slide.title)}</div>
        ${slide.subtitle ? `<div class="slide-subtitle">${escapeHTML(slide.subtitle)}</div>` : ''}
        ${author       ? `<div class="slide-author">${escapeHTML(author)}</div>` : ''}
      </div>`;
  }

  const bullets = (slide.bullets || []).map((b, bi) =>
    `<li class="slide-bullet" style="animation-delay:${bi * 60}ms"><span>${escapeHTML(b)}</span></li>`
  ).join('');

  const hasVis = slide.needs_visual && slide.svg;
  // Sanitize SVG via DOMParser before injecting into innerHTML (prevents XSS)
  const visualHTML = hasVis ? `<div class="visual-panel">${sanitizeSVG(slide.svg)}</div>` : '';

  // Map all LLM-defined layouts to grid CSS classes
  let gridClass = 'slide-grid';
  if (hasVis) {
    if (slide.layout === 'title-content-visual-right') gridClass = 'slide-grid with-visual';
    else if (slide.layout === 'title-content-visual-bottom') gridClass = 'slide-grid with-visual-bottom';
    else if (slide.layout === 'centered-visual')            gridClass = 'slide-grid with-visual-bottom';
  }

  return `
    <div class="slide-content-title">${escapeHTML(slide.title)}</div>
    <div class="${gridClass}">
      <ul class="slide-bullets">${bullets}</ul>
      ${visualHTML}
    </div>`;
}

/* ──────────────────────────────
   Navigation
────────────────────────────── */
function navigate(dir) {
  const next = currentIdx + dir;
  if (next >= 0 && next < slides.length) renderSlide(next);
}
function goTo(idx) { renderSlide(idx); }
function toggleNotes() {
  notesVisible = !notesVisible;
  document.getElementById('notes-drawer').classList.toggle('on', notesVisible);
  document.getElementById('notes-tog').textContent = notesVisible ? 'hide notes' : 'notes';
}

/* ──────────────────────────────
   PDF Export
────────────────────────────── */
let isExporting = false;
let _errorDismissTimer = null; // track auto-dismiss timer
async function exportPDF() {
  if (isExporting || !slides.length) return; // guard: no slides = nothing to export
  isExporting = true;
  const btn = document.getElementById('export-btn');
  const savedIdx = currentIdx;
  btn.disabled = true;
  btn.textContent = 'Exporting…';

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [13.33, 7.5] });
    const W = 13.33, H = 7.5;

    for (let i = 0; i < slides.length; i++) {
      if (i > 0) pdf.addPage();
      renderSlide(i);
      // Wait for the 120ms CSS transition + buffer before capture (220ms is sufficient)
      await new Promise(r => setTimeout(r, 220));
      const el = document.getElementById('slide-frame');
      const tc = presentationData?.theme_config;
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true,
        backgroundColor: tc?.bg || '#ffffff',
        logging: false
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, W, H);
    }

    pdf.save(`${presentationData?.presentation_title || 'presentation'}.pdf`);
  } catch (e) {
    showError('PDF export failed: ' + e.message);
  } finally {
    isExporting = false;
    renderSlide(savedIdx);
    btn.disabled = false;
    btn.textContent = 'Export PDF';
  }
}

/* ──────────────────────────────
   Utils
────────────────────────────── */
function setLoading(on) {
  document.getElementById('loader').classList.toggle('on', on);
}
function showError(msg) {
  // Cancel any previous auto-dismiss timer before setting a new one
  if (_errorDismissTimer) clearTimeout(_errorDismissTimer);
  const el = document.getElementById('error-line');
  el.textContent = msg;
  el.classList.add('on');
  _errorDismissTimer = setTimeout(() => {
    el.classList.remove('on');
    _errorDismissTimer = null;
  }, 6000);
}
function clearError() {
  if (_errorDismissTimer) { clearTimeout(_errorDismissTimer); _errorDismissTimer = null; }
  document.getElementById('error-line').classList.remove('on');
}
function resetView() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  slides          = [];
  presentationData = null;
  currentIdx      = 0;
  notesVisible    = false;
  document.getElementById('notes-drawer').classList.remove('on');
  document.getElementById('notes-tog').textContent = 'notes';
  document.getElementById('slide-nav').classList.remove('ready');
  document.getElementById('slide-count').textContent = '';
  resetTheme(); // clear slide-frame theme styles
  // Keep the UI theme as-is (user's selected theme stays active)
  setTimeout(() => {
    document.getElementById('viewer-section').classList.remove('on');
  }, 500);
}

document.addEventListener('keydown', e => {
  // Only fire keyboard nav when NOT focused inside a text input or textarea
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!presentationData || !slides || !slides.length) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
});
</script>