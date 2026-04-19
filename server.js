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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://127.0.0.1:3001'];

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
  minimalist:       { font: 'Playfair Display',  bg: '#FAFAFA',  text: '#111111', accent: '#2563EB', secondary: '#64748B', card: 'rgba(255,255,255,0.7)',   glass: 'rgba(255,255,255,0.5)' },
  professional:     { font: 'Merriweather',       bg: '#F8F9FA',  text: '#1A1A2E', accent: '#0F3460', secondary: '#533483', card: 'rgba(248,249,250,0.8)',   glass: 'rgba(240,244,248,0.6)' },
  dark:             { font: 'Syne',               bg: '#0B0B0F',  text: '#E2E8F0', accent: '#6366F1', secondary: '#8B5CF6', card: 'rgba(30,30,50,0.7)',      glass: 'rgba(20,20,40,0.5)' },
  scientific:       { font: 'Source Serif 4',     bg: '#F0F4FF',  text: '#1E293B', accent: '#1D4ED8', secondary: '#0891B2', card: 'rgba(224,232,255,0.7)',   glass: 'rgba(210,220,255,0.5)' },
  cyberpunk:        { font: 'Orbitron',           bg: '#0F172A',  text: '#F0FDFA', accent: '#00FFFF', secondary: '#FF00FF', card: 'rgba(0,255,255,0.08)',    glass: 'rgba(0,20,40,0.7)' },
  brutalist:        { font: 'Space Mono',         bg: '#FFFFF0',  text: '#000000', accent: '#FF3300', secondary: '#000000', card: 'rgba(255,255,240,0.9)',   glass: 'rgba(255,255,220,0.8)' },
  colorful:         { font: 'Nunito',             bg: '#FFF7F0',  text: '#1A0A2E', accent: '#F97316', secondary: '#8B5CF6', card: 'rgba(255,247,240,0.8)',   glass: 'rgba(255,230,210,0.5)' },
  classic:          { font: 'EB Garamond',        bg: '#FFFEF7',  text: '#2C1810', accent: '#8B4513', secondary: '#6B3A2A', card: 'rgba(255,254,247,0.85)',  glass: 'rgba(240,235,220,0.6)' },
  'neo-brutalist':  { font: 'DM Mono',            bg: '#F5F0E8',  text: '#1A1A1A', accent: '#FFD700', secondary: '#FF4444', card: 'rgba(245,240,232,0.9)',   glass: 'rgba(230,225,210,0.7)' },
  kids:             { font: 'Fredoka One',        bg: '#FFF0F5',  text: '#2D0A3B', accent: '#FF6B9D', secondary: '#4ECDC4', card: 'rgba(255,240,245,0.85)',  glass: 'rgba(255,220,235,0.6)' },
  'colorblind-safe':{ font: 'Outfit',             bg: '#F8F8F8',  text: '#1A1A1A', accent: '#0077BB', secondary: '#EE7733', card: 'rgba(248,248,248,0.8)',   glass: 'rgba(235,240,248,0.6)' }
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
  if (!trimmed.startsWith('<svg') || !trimmed.includes('</svg>')) return null;
  // Reject any embedded scripts or event attributes
  if (/<script[\s>]/i.test(trimmed)) return null;
  if (/\bon\w+\s*=/i.test(trimmed)) return null;
  return trimmed;
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(theme, totalSlides, themeConfig, graphs_enabled, diagrams_enabled) {
  const needsVisuals = graphs_enabled || diagrams_enabled;
  const svgPrompt = needsVisuals ? `
You are a data visualization SVG expert. For each slide needing a visual, generate raw SVG code in the "svg_code" field.
CORE: Readability > aesthetics, clear purpose, NO overlapping elements. DO NOT hallucinate facts or make up false statistical data. If exact metrics are absent, use qualitative or generalized markers instead of fabricated absolute numbers.
STRUCTURE: Proper margins (min 24px padding), grid/axis alignment, clear hierarchy (title, labels, data, legend). Minimum 16px element spacing.
GRAPHS: Visible axes, labeled ticks, even spacing. Bars/lines must NOT touch.
DIAGRAMS: Clear flow (top-bottom/left-right), equal node spacing, non-crossing lines, consistent strokes, arrowheads.
STYLE: Single font, no text wrapping, NO gradients/shadows/decorators/icons. Maintain aspect ratio balance.
COLORS: Use ONLY theme bg (${themeConfig.bg}), text (${themeConfig.text}), primary/accent (${themeConfig.accent}), secondary (${themeConfig.secondary}).` : '';

  return `You are an expert presentation architect. Generate a structured JSON presentation.

RULES:
- Output ONLY valid JSON, no markdown, no explanation
- Each slide has: id, title, bullets (array of strings, MAX 4 bullets strictly enforced, max 10 words each. NO paragraphs), needs_visual, visual_type, layout, speaker_notes${needsVisuals ? ', svg_code (string)' : ''}
- visual_type: "bar_chart" | "line_chart" | "pie_chart" | "flow_diagram" | "tree_diagram" | "block_diagram" | "none"
- layout: "title-content" | "title-content-visual-right" | "title-content-visual-bottom" | "centered-visual" | "title-only"
- First slide is always the title slide with layout "title-only"
- Last slide can be a summary or conclusion
- Assign visuals semantically: numbers→bar/line, process→flow, comparison→bar, hierarchy→tree
- CONTENT DENSITY: No redundant information. Use precise, accurate, professional terminology throughout.
- STRICT FACTUALITY: Do not hallucinate or fabricate facts, metrics, or statistics. Stay conceptual when data is unknown.
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
  const { accent, text, secondary } = t;

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
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${accent}" rx="4" opacity="0.85"/>
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
    const span   = values.length - 1 || 1;
    const pts    = values.map((v, i) => `${30 + i * (300 / span)},${180 - (v / maxVal) * 140}`).join(' ');
    const dots   = values.map((v, i) => {
      const x = 30 + i * (300 / span);
      const y = 180 - (v / maxVal) * 140;
      return `<circle cx="${x}" cy="${y}" r="4" fill="${accent}"/><text x="${x}" y="${y - 8}" text-anchor="middle" fill="${accent}" font-size="9" font-family="sans-serif">${v}</text>`;
    }).join('');
    const axisLabels = labels.map((label, i) => {
      const x = 30 + i * (300 / (labels.length - 1 || 1));
      return `<text x="${x}" y="198" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif">${label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 380 220" xmlns="http://www.w3.org/2000/svg">
      <text x="190" y="18" text-anchor="middle" fill="${text}" font-size="11" font-weight="bold" font-family="sans-serif">${title}</text>
      <polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="30,185 ${pts} 330,185" fill="${accent}" opacity="0.1"/>
      ${dots}${axisLabels}
      <line x1="25" y1="185" x2="360" y2="185" stroke="${text}" stroke-width="1" opacity="0.3"/>
    </svg>`;
  }

  if (visual_type === 'pie_chart') {
    const total  = values.reduce((a, b) => a + b, 0) || 1;
    const colors = [accent, secondary, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    let angle    = -Math.PI / 2;
    const slices = values.map((v, i) => {
      const slice = (v / total) * 2 * Math.PI;
      const x1 = 110 + 85 * Math.cos(angle);
      const y1 = 110 + 85 * Math.sin(angle);
      angle += slice;
      const x2    = 110 + 85 * Math.cos(angle);
      const y2    = 110 + 85 * Math.sin(angle);
      const large = slice > Math.PI ? 1 : 0;
      return `<path d="M110,110 L${x1},${y1} A85,85 0 ${large},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}" opacity="0.85"/>`;
    }).join('');
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
    const boxes = steps.map((s, i) => {
      const x     = 30 + i * 66;
      const arrow = i < steps.length - 1
        ? `<line x1="${x + 74}" y1="100" x2="${x + 80}" y2="100" stroke="${accent}" stroke-width="2" marker-end="url(#arrow)"/>`
        : '';
      return `
        <rect x="${x}" y="80" width="68" height="40" rx="8" fill="${accent}" opacity="0.15" stroke="${accent}" stroke-width="1.5"/>
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
        <line x1="190" y1="85" x2="${x + 40}" y2="130" stroke="${accent}" stroke-width="1.5" opacity="0.5"/>
        <rect x="${x}" y="130" width="80" height="32" rx="6" fill="${secondary}" opacity="0.2" stroke="${secondary}" stroke-width="1.2"/>
        <text x="${x + 40}" y="151" text-anchor="middle" fill="${text}" font-size="9" font-family="sans-serif">${c.substring(0, 10)}</text>
      `;
    }).join('');
    return `<svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
      <rect x="130" y="40" width="120" height="40" rx="8" fill="${accent}" opacity="0.2" stroke="${accent}" stroke-width="1.5"/>
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
          <rect x="${x}" y="${y}" width="100" height="50" rx="8" fill="${fill}" opacity="0.18" stroke="${fill}" stroke-width="1.5"/>
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
    const rawMin = Math.max(3, parseInt(min_slides) || 5);
    const rawMax = Math.min(32, parseInt(max_slides) || 12);
    // Guard: if user set min > max, swap them gracefully
    const minS = Math.min(rawMin, rawMax);
    const maxS = Math.max(rawMin, rawMax);
    const userCount  = Array.isArray(inputSlides) ? inputSlides.length : 0;
    const slideCount = Math.min(Math.max(userCount || minS, minS), maxS);

    // ── Prompt ──
    const slideTopics = Array.isArray(inputSlides) && inputSlides.length
      ? `Slide topics: ${inputSlides.map(s => sanitizeText(s.title, 100)).join(', ')}`
      : `Select and adapt the most appropriate topics from this standard structure to fit the ${slideCount}-slide constraint:\n- ${DEFAULT_TEMPLATE.join('\n- ')}`;

    const userPrompt = `Create a presentation titled: "${title}"
Author: ${author || 'Unknown'}
Additional context: ${details || 'None'}
Number of slides: ${slideCount}
${slideTopics}
Graphs enabled: ${graphs_enabled}
Diagrams enabled: ${diagrams_enabled}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: buildSystemPrompt(safeTheme, slideCount, themeConfig, graphs_enabled, diagrams_enabled) },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 8192
    });

    let raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty response from LLM.');

    // Strip markdown fences
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

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

    // ── Post-process slides ──
    parsed.slides = parsed.slides.map(slide => {
      // Enforce max 4 bullets server-side
      if (Array.isArray(slide.bullets)) {
        slide.bullets = slide.bullets.slice(0, 4);
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
    res.json({ success: true, presentation: parsed });

  } catch (err) {
    console.error('[/api/generate]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 PPT Gen server running on port ${PORT}`));
