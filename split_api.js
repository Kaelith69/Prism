const fs = require('fs');

// ----------------- SERVER.JS -----------------
let server = fs.readFileSync('server.js', 'utf8');

// 1. Rename buildSystemPrompt to buildOutlinePrompt and remove SVG generation
const oldPrompt = `function buildSystemPrompt(theme, totalSlides, themeConfig, graphs_enabled, diagrams_enabled) {
  const needsVisuals = graphs_enabled || diagrams_enabled;
  const svgPrompt = needsVisuals ? \`
SVG EXPERT. Raw SVG in "svg_code". NO OVERLAPS. NO HALLUCINATION.
MARGINS: min 24px. SPACING: min 16px. Align to grid.
GRAPHS: Labeled axes. Bars/lines DON'T touch.
DIAGRAMS: Clear flow. No crossing lines.
STYLE: Single font, no wrap/gradients/shadows.
COLORS: bg(\${themeConfig.bg}), text(\${themeConfig.text}), accent(\${themeConfig.accent}), sec(\${themeConfig.secondary}).
GEOMETRY: rect rx="\${themeConfig.uiRadius || '4px'}". stroke-width="\${themeConfig.uiBorderW || '1px'}".\` : '';

  return \`EXPERT PPT ARCHITECT. Output ONLY JSON.
RULES:
- Total slides: \${totalSlides}
- Theme: \${theme}
\${svgPrompt}

Output format:
{
  "presentation_title": "string",
  "theme": "\${theme}",
  "slides": [
    {
      "id": 1,
      "title": "string",
      "subtitle": "string (only for title slide)",
      "bullets": ["bullet1", "bullet2"],
      "needs_visual": true,
      "visual_type": "bar_chart",
      "visual_data": { "labels": [], "values": [], "title": "" },
      \${needsVisuals ? '"svg_code": "<svg>...</svg>",' : ''}
      "layout": "title-content-visual-right",
      "speaker_notes": "string"
    }
  ]
}\`;
}`;

const newPrompts = `function buildOutlinePrompt(theme, totalSlides) {
  return \`EXPERT PPT ARCHITECT. Output ONLY JSON.
RULES:
- Total slides: \${totalSlides}
- Theme: \${theme}
- DO NOT generate svg_code in this step. Only structure.

Output format:
{
  "presentation_title": "string",
  "theme": "\${theme}",
  "slides": [
    {
      "id": 1,
      "title": "string",
      "subtitle": "string (only for title slide)",
      "bullets": ["bullet1", "bullet2"],
      "needs_visual": true,
      "visual_type": "bar_chart",
      "visual_data": { "labels": [], "values": [], "title": "" },
      "layout": "title-content-visual-right",
      "speaker_notes": "string"
    }
  ]
}\`;
}

function buildVisualsPrompt(themeConfig) {
  return \`SVG EXPERT. Output ONLY JSON.
Raw SVG in "svg_code". NO OVERLAPS. NO HALLUCINATION.
MARGINS: min 24px. SPACING: min 16px. Align to grid.
GRAPHS: Labeled axes. Bars/lines DON'T touch.
DIAGRAMS: Clear flow. No crossing lines.
STYLE: Single font, no wrap/gradients/shadows.
COLORS: bg(\${themeConfig.bg}), text(\${themeConfig.text}), accent(\${themeConfig.accent}), sec(\${themeConfig.secondary}).
GEOMETRY: rect rx="\${themeConfig.uiRadius || '4px'}". stroke-width="\${themeConfig.uiBorderW || '1px'}".

Input will be a list of slides needing visuals.
Output format:
{
  "svgs": {
    "1": "<svg>...</svg>",
    "2": "<svg>...</svg>"
  }
}\`;
}`;

server = server.replace(oldPrompt, newPrompts);

// 2. Change /api/generate to /api/generate/outline
server = server.replace("app.post('/api/generate', async (req, res) => {", "app.post('/api/generate/outline', async (req, res) => {");

// 3. Update the groq call in outline to use buildOutlinePrompt
server = server.replace(
  "{ role: 'system', content: buildSystemPrompt(safeTheme, slideCount, themeConfig, graphs_enabled, diagrams_enabled) },",
  "{ role: 'system', content: buildOutlinePrompt(safeTheme, slideCount) },"
);

// 4. In outline endpoint, remove the fallback SVG builder because we do it in step 2.
// Wait, we can keep the local builder there? Actually, let's keep needs_visual=true but svg=null.
const outlineReplaceTarget = `        if (!graphs_enabled && isChart) {
          slide.needs_visual = false;
          slide.svg = null;
        } else if (!diagrams_enabled && isDiagram) {
          slide.needs_visual = false;
          slide.svg = null;
        } else {
          // Validate LLM SVG before use, fallback to local builder
          const llmSVG = validateSVG(slide.svg_code);
          slide.svg = llmSVG || buildSVG(slide.visual_type, slide.visual_data, safeTheme);
        }`;

const outlineReplaceWith = `        if (!graphs_enabled && isChart) {
          slide.needs_visual = false;
          slide.svg = null;
        } else if (!diagrams_enabled && isDiagram) {
          slide.needs_visual = false;
          slide.svg = null;
        } else {
          slide.svg = null; // Will be populated in /api/generate/visuals
        }`;
server = server.replace(outlineReplaceTarget, outlineReplaceWith);

// 5. Append /api/generate/visuals endpoint
const visualsEndpoint = `
// ─── Visuals endpoint ────────────────────────────────────────────────────────
app.post('/api/generate/visuals', async (req, res) => {
  try {
    const { slides, theme = 'minimalist' } = req.body;
    if (!Array.isArray(slides)) return res.status(400).json({ error: 'Slides array required.' });

    const safeTheme = THEMES[theme] ? theme : 'minimalist';
    const themeConfig = THEMES[safeTheme];

    // Filter slides that need visuals
    const slidesNeedingVisuals = slides.filter(s => s.needs_visual && s.visual_type !== 'none' && s.visual_type !== 'auto');

    if (slidesNeedingVisuals.length === 0) {
      return res.json({ success: true, svgs: {} });
    }

    const userPrompt = JSON.stringify(slidesNeedingVisuals.map(s => ({
      id: s.id,
      title: s.title,
      visual_type: s.visual_type,
      visual_data: s.visual_data
    })));

    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildVisualsPrompt(themeConfig) },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000
    });

    let raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty response from LLM.');
    raw = raw.replace(/^\\s*\`\`\`(?:json)?\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\\{[\\s\\S]*\\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Malformed JSON.');
    }

    // Validate and fallback
    const svgs = {};
    for (const s of slidesNeedingVisuals) {
      const llmSVG = validateSVG(parsed.svgs?.[s.id] || parsed.svgs?.[String(s.id)]);
      svgs[s.id] = llmSVG || buildSVG(s.visual_type, s.visual_data, safeTheme);
    }

    res.json({ success: true, svgs });
  } catch (err) {
    console.error('[/api/generate/visuals]', err.message);
    res.status(500).json({ error: err.message });
  }
});
`;

server = server.replace("// ─── Start server ─────────────────────────────────────────────────────────────", visualsEndpoint + "\n// ─── Start server ─────────────────────────────────────────────────────────────");
fs.writeFileSync('server.js', server);

// ----------------- INDEX_V2.HTML -----------------
let html = fs.readFileSync('index_v2.html', 'utf8');

// 1. Modify the fetch in generate()
const fetchOld = `    currentAbortController = new AbortController();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: currentAbortController.signal
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');

    clearInterval(progInterval);
    bar.style.width = '100%';
    msgEl.textContent = 'Done.';
    document.getElementById('status-dot').innerHTML = 'System · Rendered';

    await new Promise(r => setTimeout(r, 300));

    presentationData = data.presentation;
    slides = presentationData.slides || [];
    renderPresentation();`;

const fetchNew = `    currentAbortController = new AbortController();
    const res = await fetch('/api/generate/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: currentAbortController.signal
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Outline generation failed');

    clearInterval(progInterval);
    bar.style.width = '100%';
    msgEl.textContent = 'Drafting visuals...';
    document.getElementById('status-dot').innerHTML = 'System · Drafting visuals...';

    presentationData = data.presentation;
    slides = presentationData.slides || [];
    renderPresentation();

    // Fire second phase: Visuals
    const visRes = await fetch('/api/generate/visuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides, theme: presentationData.theme }),
      signal: currentAbortController.signal
    });
    const visData = await visRes.json();
    if (!visRes.ok || !visData.success) {
       console.warn('Visuals generation failed, using fallbacks or leaving empty.', visData.error);
    } else {
       // Merge SVGs back into slides
       slides.forEach(s => {
         if (visData.svgs[s.id]) s.svg = visData.svgs[s.id];
       });
       // Re-render current slide if it got updated
       renderSlide(currentIdx);
    }
    
    msgEl.textContent = 'Done.';
    document.getElementById('status-dot').innerHTML = 'System · Rendered';`;

html = html.replace(fetchOld, fetchNew);

// 2. Add skeleton loader in buildSlideHTML
const visualHTMLOld = `  const hasVis = slide.needs_visual && slide.svg;
  // Sanitize SVG via DOMParser before injecting into innerHTML (prevents XSS)
  const visualHTML = hasVis ? \`<div class="visual-panel">\${sanitizeSVG(slide.svg)}</div>\` : '';`;

const visualHTMLNew = `  const expectsVis = slide.needs_visual && slide.visual_type !== 'none' && slide.visual_type !== 'auto';
  const hasVis = expectsVis && slide.svg;
  // Sanitize SVG via DOMParser before injecting into innerHTML (prevents XSS)
  let visualHTML = '';
  if (hasVis) {
    visualHTML = \`<div class="visual-panel">\${sanitizeSVG(slide.svg)}</div>\`;
  } else if (expectsVis && isGenerating) {
    visualHTML = \`<div class="visual-panel skeleton"><div class="skel-anim"></div><div style="font-size:10px; opacity:0.4; margin-top:8px">Generating \${slide.visual_type}...</div></div>\`;
  }`;

html = html.replace(visualHTMLOld, visualHTMLNew);

// 3. Add skeleton CSS
const cssOld = `/* "?"?"? Error "?"?"? */`;
const cssNew = `/* "?"?"? Skeleton "?"?"? */
.skeleton {
  background: var(--surface-2);
  border: 1px dashed var(--border-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  min-height: 200px;
}
.skel-anim {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
  animation: skelMove 1.5s infinite;
}
@keyframes skelMove {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
/* "?"?"? Error "?"?"? */`;
html = html.replace(cssOld, cssNew);

fs.writeFileSync('index_v2.html', html);
console.log('done splitting api');
