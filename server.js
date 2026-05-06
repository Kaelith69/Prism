require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  console.error('FATAL: Environment variable GROQ_API_KEY is not defined.');
  process.exit(1);
}

const express = require('express');
const cors    = require('cors');
const Groq    = require('groq-sdk');
const path    = require('path');

const app = express();

// CORS: restrict to same origin in production, allow localhost in dev
const _port = process.env.PORT || 3001;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [`http://localhost:${_port}`, `http://127.0.0.1:${_port}`];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, curl)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '2mb' }));

// Serve only the HTML file at root — do NOT expose the entire __dirname
// (which would leak .env, server.js, node_modules etc.)
app.use('/docs', express.static(path.join(__dirname, 'docs')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index_v2.html'));
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Themes ──────────────────────────────────────────────────────────────────
const THEMES = {
  minimalist:       { font: 'DM Sans',        bg: '#FEFEFE', text: '#1A1A1A', accent: '#3B7DD8', secondary: '#93B4DC', card: 'rgba(255,255,255,0.92)',  glass: 'rgba(240,246,255,0.55)', uiRadius: '4px', uiBorderW: '1px', uiShadow: '0 4px 20px rgba(59, 125, 216, 0.1)' },
  professional:     { font: 'Merriweather',   bg: '#0F1E3A', text: '#E8EDF8', accent: '#4D9FFF', secondary: '#8BBEFF', card: 'rgba(15,30,58,0.88)',     glass: 'rgba(30,55,100,0.55)',   uiRadius: '2px', uiBorderW: '1px', uiShadow: '0 2px 10px rgba(0,0,0,0.4)' },
  dark:             { font: 'Syne',           bg: '#07090F', text: '#EDE8F8', accent: '#A78BFA', secondary: '#F472B6', card: 'rgba(18,14,35,0.82)',     glass: 'rgba(12,10,28,0.65)',    uiRadius: '6px', uiBorderW: '1px', uiShadow: '0 4px 24px rgba(167, 139, 250, 0.15)' },
  scientific:       { font: 'Source Serif 4', bg: '#F4F7FF', text: '#0D1E3C', accent: '#1A56DB', secondary: '#0891B2', card: 'rgba(228,237,255,0.80)',  glass: 'rgba(210,226,255,0.52)', uiRadius: '0px', uiBorderW: '1px', uiShadow: '0 2px 4px rgba(26, 86, 219, 0.1)' },
  cyberpunk:        { font: 'Orbitron',       bg: '#020610', text: '#DFFFF6', accent: '#00FFB2', secondary: '#FF007A', card: 'rgba(0,255,178,0.04)',    glass: 'rgba(0,12,30,0.88)',     uiRadius: '0px', uiBorderW: '1px', uiShadow: '0 0 10px rgba(0, 255, 178, 0.4)' },
  brutalist:        { font: 'Space Mono',     bg: '#FFFFFF', text: '#000000', accent: '#FF0000', secondary: '#CC0000', card: 'rgba(255,255,255,0.95)',  glass: 'rgba(238,238,238,0.90)', uiRadius: '0px', uiBorderW: '2px', uiShadow: 'none' },
  colorful:         { font: 'Nunito',         bg: '#FCF5FF', text: '#1A0830', accent: '#D946EF', secondary: '#F97316', card: 'rgba(252,245,255,0.88)',  glass: 'rgba(238,215,255,0.58)', uiRadius: '12px', uiBorderW: '0px', uiShadow: '0 8px 24px rgba(217, 70, 239, 0.2)' },
  classic:          { font: 'EB Garamond',    bg: '#F9F2DF', text: '#2A1500', accent: '#9B6400', secondary: '#6B3F00', card: 'rgba(249,242,223,0.90)',  glass: 'rgba(232,218,188,0.65)', uiRadius: '2px', uiBorderW: '1px', uiShadow: '0 4px 10px rgba(42, 21, 0, 0.15)' },
  'neo-brutalist':  { font: 'Space Grotesk',  bg: '#FFFBEE', text: '#111111', accent: '#FF5722', secondary: '#00ACC1', card: 'rgba(255,251,238,0.93)',  glass: 'rgba(245,240,220,0.72)', uiRadius: '6px', uiBorderW: '3px', uiShadow: '4px 4px 0px #111111' },
  kids:             { font: 'Fredoka One',    bg: '#FFFDE7', text: '#1A0050', accent: '#FF4081', secondary: '#00BFA5', card: 'rgba(255,253,231,0.92)',  glass: 'rgba(255,244,200,0.62)', uiRadius: '24px', uiBorderW: '3px', uiShadow: '0 8px 0px rgba(255, 64, 129, 0.2)' },
  'colorblind-safe':{ font: 'Outfit',         bg: '#FFFFFF', text: '#111111', accent: '#0072B2', secondary: '#D55E00', card: 'rgba(255,255,255,0.95)',  glass: 'rgba(240,248,255,0.65)', uiRadius: '4px', uiBorderW: '2px', uiShadow: '0 4px 12px rgba(0, 114, 178, 0.15)' },
  claude:           { font: 'Plus Jakarta Sans', bg: '#FAF9F7', text: '#1C1917', accent: '#DA7756', secondary: '#78584E', card: 'rgba(250,249,247,0.95)', glass: 'rgba(240,235,227,0.60)', uiRadius: '8px', uiBorderW: '1px', uiShadow: '0 2px 8px rgba(28, 25, 23, 0.05)' }
};

// ─── Input sanitisation ───────────────────────────────────────────────────────
/**
 * Strip HTML tags and control characters from a string to prevent XSS.
 * Used on user-supplied strings before embedding them in LLM prompts or HTML.
 */
function sanitizeText(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  // Single-pass: strip tags, then dangerous solo chars, trim and truncate
  return str
    .replace(/<[^>]*>|[<>"'`]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ─── SVG validation ───────────────────────────────────────────────────────────
/**
 * Lightweight check that svg_code is a well-typed SVG string and does not
 * contain script elements or event handler attributes.
 */
function validateSVG(code) {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  // Must start with <svg and end with </svg> — blocks trailing <script> payloads
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) return null;
  // Reject any embedded scripts or event handler attributes
  if (/<script[\s>]/i.test(trimmed)) return null;
  if (/\bon\w+\s*=/i.test(trimmed)) return null;
  return trimmed;
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(theme, totalSlides, themeConfig, graphs_enabled, diagrams_enabled) {
  const needsVisuals = graphs_enabled || diagrams_enabled;
  const svgPrompt = needsVisuals ? `
SVG EXPERT. Raw SVG in "svg_code". NO OVERLAPS. NO HALLUCINATION.
MARGINS: min 24px. SPACING: min 16px. Align to grid.
GRAPHS: Labeled axes. Bars/lines DON'T touch.
DIAGRAMS: Clear flow. No crossing lines.
STYLE: Single font, no wrap/gradients/shadows.
COLORS: bg(${themeConfig.bg}), text(${themeConfig.text}), accent(${themeConfig.accent}), sec(${themeConfig.secondary}).
GEOMETRY: rect rx="${themeConfig.uiRadius || '4px'}". stroke-width="${themeConfig.uiBorderW || '1px'}".` : '';

  return `EXPERT PPT ARCHITECT. Output ONLY JSON.
RULES:
- Total slides: ${totalSlides}
- Theme: ${theme}
${svgPrompt}

Output format:
{
  "presentation_title": "string",
  "theme": "${theme}",
  "slides": [
    {
      "id": 1,
      "title": "string",
      "subtitle": "string (only for title slide)",
      "bullets": ["bullet1", "bullet2"],
      "needs_visual": true,
      "visual_type": "bar_chart",
      "visual_data": { "labels": [], "values": [], "title": "" },
      ${needsVisuals ? '"svg_code": "<svg>...</svg>",' : ''}
      "layout": "title-content-visual-right",
      "speaker_notes": "string"
    }
  ]
}`;
}

// ─── Fallback local SVG builder (no dummy data) ───────────────────────────────
function buildSVG(visual_type, visual_data, theme) {
  const t = THEMES[theme] || THEMES.minimalist;
    const { accent, text, secondary, uiRadius, uiBorderW } = t;
  const rx = uiRadius ? parseInt(uiRadius) : 4;
  const strokeW = uiBorderW ? parseFloat(uiBorderW) : 1;

  // Require real labels and values — never fabricate fallback data
  if (!visual_data?.labels?.length || !visual_data?.values?.length) return null;

  const labels = visual_data.labels;
  const values = visual_data.values;
  const title  = visual_data.title || '';

  if (visual_type === 'bar_chart') {
    const maxVal = Math.max(...values, 1);
    const barW   = Math.floor(320 / labels.length) - 10;
    const bars   = labels.map((label, i) => {
      const h = Math.floor((values[i] / maxVal) * 140);
      const x = 30 + i * (barW + 10);
      const y = 180 - h;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${accent}" rx="${rx}" opacity="0.85"/>
        <text x="${x + barW / 2}" y="198" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif">${label}</text>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" fill="${accent}" font-size="9" font-family="sans-serif">${values[i]}</text>
      `;
    }).join('');
    return `<svg viewBox="0 0 380 230" xmlns="http://www.w3.org/2000/svg">
      <text x="190" y="18" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      <line x1="25" y1="185" x2="360" y2="185" stroke="${text}" stroke-width="1" opacity="0.3"/>
      ${bars}
    </svg>`;
  }

  if (visual_type === 'line_chart') {
    const maxVal = Math.max(...values, 1);
    const n      = values.length;
    const span   = (n - 1) || 1;
    const xOf    = i => 30 + i * (300 / span);
    const yOf    = v => 180 - (v / maxVal) * 140;
    const pts    = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
    // Polygon close point uses the actual last x — not hardcoded 330
    const lastX  = xOf(n - 1);
    const dots   = values.map((v, i) => {
      const x = xOf(i), y = yOf(v);
      return `<circle cx="${x}" cy="${y}" r="4" fill="${accent}"/><text x="${x}" y="${y - 8}" text-anchor="middle" fill="${accent}" font-size="9" font-family="sans-serif">${v}</text>`;
    }).join('');
    const axisSpan = (labels.length - 1) || 1;
    const axisLabels = labels.map((label, i) =>
      `<text x="${30 + i * (300 / axisSpan)}" y="198" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif">${label}</text>`
    ).join('');
    return `<svg viewBox="0 0 380 220" xmlns="http://www.w3.org/2000/svg">
      <text x="190" y="18" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      <polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="30,185 ${pts} ${lastX},185" fill="${accent}" opacity="0.1"/>
      ${dots}${axisLabels}
      <line x1="25" y1="185" x2="360" y2="185" stroke="${text}" stroke-width="1" opacity="0.3"/>
    </svg>`;
  }

  if (visual_type === 'pie_chart') {
    const total  = values.reduce((a, b) => a + b, 0) || 1;
    const colors = [accent, secondary, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    // Use reduce to accumulate angle without side-effectful map
    const { slices } = values.reduce((acc, v, i) => {
      const slice = (v / total) * 2 * Math.PI;
      const x1 = 110 + 85 * Math.cos(acc.angle);
      const y1 = 110 + 85 * Math.sin(acc.angle);
      const nextAngle = acc.angle + slice;
      const x2    = 110 + 85 * Math.cos(nextAngle);
      const y2    = 110 + 85 * Math.sin(nextAngle);
      const large = slice > Math.PI ? 1 : 0;
      acc.slices += `<path d="M110,110 L${x1},${y1} A85,85 0 ${large},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}" opacity="0.85"/>`;
      acc.angle = nextAngle;
      return acc;
    }, { slices: '', angle: -Math.PI / 2 });
    const legend = labels.map((l, i) => `
      <rect x="215" y="${30 + i * 22}" width="12" height="12" fill="${colors[i % colors.length]}" rx="2"/>
      <text x="232" y="${41 + i * 22}" fill="${text}" font-size="10" font-family="sans-serif">${l} (${Math.round(values[i] / total * 100)}%)</text>
    `).join('');
    return `<svg viewBox="0 0 380 230" xmlns="http://www.w3.org/2000/svg">
      <text x="110" y="18" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      ${slices}${legend}
    </svg>`;
  }

  if (visual_type === 'flow_diagram') {
    const steps = labels.slice(0, 5);
    const BOX_W = 68, GAP = 10;
    const boxes = steps.map((s, i) => {
      const x     = 30 + i * (BOX_W + GAP);
      // Arrow runs from end of current box to start of next box
      const arrow = i < steps.length - 1
        ? `<line x1="${x + BOX_W}" y1="100" x2="${x + BOX_W + GAP - 2}" y2="100" stroke="${accent}" stroke-width="${strokeW}" marker-end="url(#arrow)"/>`
        : '';
      return `
        <rect x="${x}" y="80" width="68" height="40" rx="${rx}" fill="${accent}" opacity="0.15" stroke="${accent}" stroke-width="${strokeW}"/>
        <text x="${x + 34}" y="97" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif" font-weight="bold">${s.substring(0, 10)}</text>
        <text x="${x + 34}" y="110" text-anchor="middle" fill="${text}" font-size="8" font-family="sans-serif">${i + 1}</text>
        ${arrow}
      `;
    }).join('');
    return `<svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${accent}"/></marker></defs>
      <text x="190" y="30" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      ${boxes}
    </svg>`;
  }

  if (visual_type === 'tree_diagram') {
    const root      = labels[0] || 'Root';
    const children  = labels.slice(1, 5);
    const childNodes = children.map((c, i) => {
      const x = 50 + i * 85;
      return `
        <line x1="190" y1="85" x2="${x + 40}" y2="130" stroke="${accent}" stroke-width="${strokeW}" opacity="0.5"/>
        <rect x="${x}" y="130" width="80" height="32" rx="6" fill="${secondary}" opacity="0.2" stroke="${secondary}" stroke-width="1.2"/>
        <text x="${x + 40}" y="151" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif">${c.substring(0, 10)}</text>
      `;
    }).join('');
    return `<svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
      <rect x="130" y="40" width="120" height="40" rx="${rx}" fill="${accent}" opacity="0.2" stroke="${accent}" stroke-width="${strokeW}"/>
      <text x="190" y="65" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${root.substring(0, 15)}</text>
      ${childNodes}
    </svg>`;
  }

  if (visual_type === 'block_diagram') {
    const blocks = labels.slice(0, 6);
    const rows   = [blocks.slice(0, 3), blocks.slice(3, 6)];
    const rects  = rows.map((row, ri) =>
      row.map((b, ci) => {
        const x    = 20 + ci * 115;
        const y    = 50 + ri * 80;
        const fill = ri === 0 ? accent : secondary;
        return `
          <rect x="${x}" y="${y}" width="100" height="50" rx="${rx}" fill="${fill}" opacity="0.18" stroke="${fill}" stroke-width="${strokeW}"/>
          <text x="${x + 50}" y="${y + 30}" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif" font-weight="bold">${b.substring(0, 12)}</text>
        `;
      }).join('')
    ).join('');
    return `<svg viewBox="0 0 380 220" xmlns="http://www.w3.org/2000/svg">
      <text x="190" y="30" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      ${rects}
    </svg>`;
  }

  return null;
}

// ─── Default slide template ───────────────────────────────────────────────────
const DEFAULT_TEMPLATE = [
  'Title Slide', 'Outline / Index', 'Introduction', 'Problem Statement',
  'Objectives', 'Existing System / Background', 'Limitations of Existing System',
  'Proposed Solution', 'Key Features', 'System Overview', 'Use Case Diagram',
  'System Architecture', 'Data Flow Diagram', 'Methodology / Working',
  'Modules / Components', 'Implementation', 'Results / Output',
  'Performance / Analysis', 'Applications / Use Cases', 'Advantages',
  'Limitations', 'Future Scope', 'Tech Stack / Requirements', 'Conclusion',
  'References', 'Q&A / Thank You'
];

// ─── Generate endpoint ────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const {
      title: rawTitle,
      author: rawAuthor,
      details: rawDetails,
      slides: inputSlides,
      theme = 'minimalist',
      min_slides = 5,
      max_slides = 12,
      graphs_enabled = true,
      diagrams_enabled = true
    } = req.body;

    // ── Input validation ──
    const title = sanitizeText(rawTitle, 200);
    if (!title) return res.status(400).json({ error: 'A non-empty title is required.' });

    const author  = sanitizeText(rawAuthor, 100);
    const details = sanitizeText(rawDetails, 1000);

    const safeTheme = THEMES[theme] ? theme : 'minimalist';
    const themeConfig = THEMES[safeTheme];

    // ── Slide count: clamp strictly within [min, max] ──
    const rawMin = Math.max(3, parseInt(min_slides, 10) || 5);
    const rawMax = Math.min(32, parseInt(max_slides, 10) || 12);
    // Guard: if user set min > max, swap them gracefully
    const minS = Math.min(rawMin, rawMax);
    const maxS = Math.max(rawMin, rawMax);
    const userCount  = Array.isArray(inputSlides) ? inputSlides.length : 0;
    const slideCount = Math.min(Math.max(userCount || minS, minS), maxS);

    // ── Prompt ──
    // Valid visual type values accepted by the server
    const VALID_VIS = new Set(['auto','bar_chart','line_chart','pie_chart','flow_diagram','tree_diagram','block_diagram','none']);

    const slideTopics = Array.isArray(inputSlides) && inputSlides.length
      ? `Slide topics (respect the visual preference hint on each slide):\n${inputSlides.map((s, i) => {
          const t       = sanitizeText(s.title, 100) || `Auto-generate topic`;
          const wantsVis = s.needs_visual !== false;
          const vt       = VALID_VIS.has(s.visual_type) ? s.visual_type : 'auto';
          const hint     = !wantsVis          ? ' [no visual]'
                         : (vt !== 'auto' && vt !== 'none') ? ` [prefer visual: ${vt}]` : '';
          return `  ${i + 1}. ${t}${hint}`;
        }).join('\n')}`
      : `Select and adapt the most appropriate topics from this standard structure to fit the ${slideCount}-slide constraint:\n- ${DEFAULT_TEMPLATE.join('\n- ')}`;

    const userPrompt = `Title: "${title}"
Author: ${author || 'Unknown'}
Context: ${details || 'None'}
Slides: ${slideCount}
${slideTopics}
Graphs: ${graphs_enabled}
Diagrams: ${diagrams_enabled}`;

    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(safeTheme, slideCount, themeConfig, graphs_enabled, diagrams_enabled) },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 4000
    });

    let raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty response from LLM.');

    // Strip markdown fences
    // Handle leading newlines before the fence and trailing fences
    raw = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch { throw new Error('LLM returned malformed JSON. Please try again.'); }
      } else {
        throw new Error('LLM returned malformed JSON. Please try again.');
      }
    }

    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error('LLM returned an empty slide list. Please try again.');
    }

    // Build a title→needs_visual lookup from user-supplied slides so we can
    // enforce the user's explicit "no visual" choices even if the LLM ignores the hint.
    const userVisMap = new Map();
    if (Array.isArray(inputSlides)) {
      inputSlides.forEach((s, i) => {
        const key = sanitizeText(s.title, 100) || `Slide ${i + 1}`;
        if (s.needs_visual === false) {
          userVisMap.set(key.toLowerCase(), false);
          userVisMap.set(`__idx_${i}`, false);
        }
      });
    }

    // ── Post-process slides ──
    parsed.slides = parsed.slides.map((slide, i) => {
      // Enforce max 4 bullets server-side
      if (Array.isArray(slide.bullets)) {
        slide.bullets = slide.bullets.slice(0, 4);
      }

      // Enforce user's explicit "no visual" preference for this slide title or index
      const titleKey = (typeof slide.title === 'string' ? slide.title : '').toLowerCase();
      if (userVisMap.get(titleKey) === false || userVisMap.get(`__idx_${i}`) === false) {
        slide.needs_visual = false;
        slide.svg = null;
        delete slide.svg_code;
        return slide;
      }

      if (slide.needs_visual && slide.visual_type !== 'none') {
        const isChart   = ['bar_chart', 'line_chart', 'pie_chart'].includes(slide.visual_type);
        const isDiagram = ['flow_diagram', 'tree_diagram', 'block_diagram'].includes(slide.visual_type);

        if (!graphs_enabled && isChart) {
          slide.needs_visual = false;
          slide.svg = null;
        } else if (!diagrams_enabled && isDiagram) {
          slide.needs_visual = false;
          slide.svg = null;
        } else {
          // Validate LLM SVG before use, fallback to local builder
          const llmSVG = validateSVG(slide.svg_code);
          slide.svg = llmSVG || buildSVG(slide.visual_type, slide.visual_data, safeTheme);
        }
      }

      // Remove raw svg_code from response (already consumed)
      delete slide.svg_code;
      return slide;
    });

    parsed.theme_config = themeConfig;
    parsed.author        = author; // echo back so client can render it reliably
    res.json({ success: true, presentation: parsed });

  } catch (err) {
    console.error('[/api/generate]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = _port;
app.listen(PORT, () => console.log(`🚀 PPT Gen server running on port ${PORT}`));
