<p align="center">
  <img src="docs/assets/banner.svg" alt="Prism — AI Presentation Studio" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/license-ISC-green.svg" alt="License ISC" />
  <img src="https://img.shields.io/badge/stack-Node.js%20%2F%20Vanilla%20JS-yellow.svg" alt="Stack" />
  <img src="https://img.shields.io/badge/LLM-Llama%203.1%208B-blueviolet.svg" alt="Llama 3.1" />
  <img src="https://img.shields.io/badge/inference-Groq%20Cloud-orange.svg" alt="Groq Cloud" />
</p>

---

**Prism** is an AI-powered presentation studio that turns a topic, a theme, and mild optimism into a complete slide deck — complete with structured bullet points, inline SVG visualizations, and a one-click 16:9 PDF export.

No PowerPoint. No design degree. No dignity sacrificed fumbling with alignment guides at 2 AM.

---

## Why I Made This

I was tired of staring at blank PowerPoint slides, wondering if I could just describe what I wanted and have something competent appear. Turns out, yes. You can.

Prism was built to skip the part where you spend 40 minutes making a title slide look "professional" and get straight to the part where you have a full deck. It's not magic — it's just an LLM with strong opinions about bullet point length and a local Node.js server acting as a very strict intermediary.

The actual reason: I wanted a project where the boring parts (slide logic, theme tokens, SVG validation, PDF export) were all handled correctly once, so I never had to think about them again. Prism is that project. It works. It's done. This README is the proof.

---

## What It Does

1. You type a topic. Something like *"Quantum Computing for Non-Physicists"* or *"Why My Cat Is a Net Negative to Society."*
2. You pick a theme. There are 11. One of them is Cyberpunk, which is objectively the correct choice.
3. You click **Generate**.
4. Groq runs Llama 3.1 8B on your prompt at speeds that make OpenAI look like it's thinking very hard.
5. The server validates the output, sanitizes it, builds fallback SVGs where needed, and sends back a clean JSON payload.
6. The browser renders a full slide deck — title, bullets, speaker notes, charts, diagrams — in a 16:9 viewer.
7. You click **Export PDF** and get a properly sized widescreen PDF that won't embarrass you.

The LLM is explicitly told not to invent statistics. It uses qualitative markers instead. This is a feature, not a cope.

---

## Features

| Feature | Detail |
| :--- | :--- |
| **LLM-Powered Generation** | Groq's Llama 3.1 8B Instant — fast, structured JSON output, no hallucinated percentages |
| **26-Topic Generic Template** | Leave the topic list empty and Prism auto-selects the most relevant slides from a standard academic/engineering template |
| **Strict Content Rules** | Max 4 bullets per slide, max 10 words per bullet — enforced at the prompt level *and* post-processing. Double-enforced because trust is earned |
| **No-Hallucination Guardrails** | Qualitative framing over fabricated data; server validates and sanitizes all SVG output |
| **11 Themes** | Minimalist, Professional, Dark, Scientific, Cyberpunk, Brutalist, Neo-Brutalist, Colorful, Classic, Kids, Colorblind-Safe |
| **6 Visual Types** | Bar chart, line chart, pie chart, flow diagram, tree diagram, block diagram — semantically auto-assigned |
| **Standard 16:9 PDF Export** | Exactly 13.33 × 7.5 inches (PowerPoint widescreen standard) via jsPDF + html2canvas |
| **Keyboard Navigation** | Arrow keys work. They don't work inside form inputs. This distinction matters more than you'd think |
| **Security Hardened** | CORS locked to localhost, inputs sanitized server-side, SVG validated against script injection, no secrets in version control |

---

## Use Cases

<p align="center">
  <img src="docs/assets/usecases.svg" alt="Prism Use Cases" />
</p>

Prism doesn't care what you're presenting. As long as you give it a topic, it will produce something structured and coherent. Whether that's a PhD defence or a slide deck explaining to your team why the deployment broke on Friday — it will handle it.

---

## Architecture

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Prism System Architecture" />
</p>

Three zones. One request. No magic.

- **Browser** — the UI, the slide renderer, and the PDF exporter. Vanilla JS, no frameworks. It knows how to build a form, talk to an API, and capture DOM to canvas. That's its whole job.
- **Express Server** — the pipeline. It sanitizes input, builds the system prompt, calls Groq, parses the response, validates SVGs, and builds fallback visuals when the LLM gets creative with the SVG spec. It also refuses to start without an API key, which is the most security-conscious thing it does.
- **Groq Cloud** — the actual intelligence. Llama 3.1 8B Instant running on Groq's inference hardware. Returns structured JSON. Fast enough that you'll wonder if it actually ran.

The only external dependency is Groq. Everything else runs locally.

```
Browser (index_v2.html)
    │
    │  POST /api/generate  { title, theme, slides[], min/max, toggles }
    ▼
Express Server (server.js)
    │  sanitizeText()       →  strips HTML tags and dangerous characters
    │  buildSystemPrompt()  →  injects theme colors + SVG/density rules
    │  Groq SDK             →  llama-3.1-8b-instant  (max 8192 tokens)
    │  validateSVG()        →  rejects <script>, on* event attributes
    │  buildSVG()           →  local fallback if LLM SVG is absent or invalid
    ▼
JSON { presentation_title, theme_config, slides[] }
    │
    ▼
Browser renders slides  →  html2canvas  →  jsPDF (13.33×7.5 in)  →  .pdf
```

---

## Data Flow

<p align="center">
  <img src="docs/assets/flow.svg" alt="Prism Request Data Flow" />
</p>

A complete lifecycle, step by step:

| Step | Where | What happens |
| :---: | :--- | :--- |
| 1 | Browser | User fills the form — topic, theme, slide count, context |
| 2 | Browser | Client validates: title required, min ≤ max. Red border if violated, no request sent |
| 3 | Browser → Server | `POST /api/generate` with full JSON payload, CORS restricted to localhost |
| 4 | Server | `sanitizeText()` strips HTML, clamps slide count to `[3..32]` |
| 5 | Server | `buildSystemPrompt()` injects theme tokens, visual rules, 26-topic template fallback |
| 6 | Server → Groq | Llama 3.1 8B Instant runs inference, returns structured JSON in ~1–3s |
| 7 | Server | Strips markdown fences, `JSON.parse()`, enforces 4-bullet cap via `slice(0, 4)`, validates SVG |
| 8 | Server | `buildSVG()` generates local fallback chart if LLM SVG is absent or failed validation |
| 9 | Server → Browser | Clean `{ success, slides[], theme_config }` response |
| 10 | Browser | Deck hydrated into viewer — thumbnails, slide frame, speaker notes become active |
| 11 | Browser | User clicks **Export PDF** → html2canvas at 2× scale → JPEG → jsPDF 13.33×7.5in |

---

## Getting Started

### Requirements

- **Node.js ≥ 18** — if you're on something older, update. The ecosystem has moved on.
- **A [Groq Cloud](https://console.groq.com) API key** — free tier exists and is more than enough for this
- **npm** — comes with Node.js
- **A browser** — yes, this is technically a requirement

### Installation

```bash
git clone https://github.com/your-username/prism.git
cd prism
npm install
```

Installs four dependencies. That's it. The entire thing is Express, Groq SDK, dotenv, and cors. No build step. No webpack. No configuration files for your configuration files.

### Configuration

```bash
cp .env.example .env
```

Open `.env` and fill it in:

```env
GROQ_API_KEY=your_groq_api_key_here
```

The server checks for this on startup and refuses to run without it. Not rudely. It just exits.

Optionally, restrict CORS for production:

```env
ALLOWED_ORIGINS=https://yourdomain.com
```

### Run

```bash
npm start
```

Open **http://localhost:3001**. That's it. There's no step 4.

---

## Usage

1. **Title** *(required)* — What the presentation is about. Be descriptive; the LLM is not a mind reader.
2. **Author** *(optional)* — Your name. Or a pseudonym. No judgment.
3. **Context** *(optional)* — Target audience, key arguments, domain specifics. More context = better slides.
4. **Theme** — 11 options. Cyberpunk remains the correct choice.
5. **Min / Max Slides** — Slide count is clamped to this range. Min must be ≤ Max. A red border appears if it isn't.
6. **Visualizations** — Toggle charts and/or diagrams independently.
7. **Slide Topics** *(optional)* — Add specific topics manually. Leave empty to use the built-in 26-topic template, automatically adapted to your slide count.
8. Click **Generate presentation** → viewer appears with thumbnails, slide frame, and speaker notes.
9. Navigate with **← Prev / Next →** or your keyboard arrow keys.
10. Click **Export PDF** → standard 16:9 widescreen PDF.
11. Click **← New** to reset and start over.

---

## Project Structure

```
prism/
├── server.js          # Express server — prompt engine, SVG builder, API endpoint
├── index_v2.html      # Single-page frontend — UI, renderer, PDF export
├── package.json       # Four dependencies. That's the whole thing.
├── .env               # Your secrets. Gitignored. Don't commit this.
├── .env.example       # The template. Safe to commit. Already committed.
├── .gitignore         # Ignores .env, node_modules, and your past mistakes
└── docs/
    └── assets/
        ├── banner.svg          # Header banner (this README)
        ├── architecture.svg    # System architecture diagram
        ├── flow.svg            # Request data flow diagram
        └── usecases.svg        # Use case overview
```

---

## API Reference

### `POST /api/generate`

Generates a complete presentation. Accepts JSON. Returns JSON.

**Request body:**

| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `title` | `string` | ✅ | — | Presentation topic |
| `author` | `string` | | `"Unknown"` | Author name or org |
| `details` | `string` | | `"None"` | Additional context |
| `theme` | `string` | | `"minimalist"` | One of 11 named themes |
| `min_slides` | `number` | | `5` | Minimum slides (clamped ≥ 3) |
| `max_slides` | `number` | | `12` | Maximum slides (clamped ≤ 32) |
| `graphs_enabled` | `boolean` | | `true` | Include bar/line/pie charts |
| `diagrams_enabled` | `boolean` | | `true` | Include flow/tree/block diagrams |
| `slides` | `array` | | `[]` | Optional topic list `[{ title, needs_visual, visual_type }]` |

**Success `200`:**

```json
{
  "success": true,
  "presentation": {
    "presentation_title": "string",
    "theme": "minimalist",
    "theme_config": { "font": "...", "bg": "...", "accent": "..." },
    "slides": [
      {
        "id": 1,
        "title": "string",
        "subtitle": "string",
        "bullets": ["max 4 items", "max 10 words each"],
        "needs_visual": true,
        "visual_type": "bar_chart",
        "visual_data": { "labels": [], "values": [], "title": "" },
        "svg": "<svg>...</svg>",
        "layout": "title-content-visual-right",
        "speaker_notes": "string"
      }
    ]
  }
}
```

**Error `400` / `500`:**

```json
{ "error": "A non-empty title is required." }
```

---

## Security

Because "it works locally" is not a security posture.

| Control | Implementation |
| :--- | :--- |
| **API key storage** | `.env` file — never committed; hard failure on startup if missing |
| **CORS** | Restricted to `localhost:3001` by default; configurable via `ALLOWED_ORIGINS` |
| **Input sanitization** | All user strings stripped of HTML tags and dangerous characters server-side |
| **SVG validation** | LLM-generated SVG rejected if it contains `<script>` or `on*=` event attributes |
| **Bullet enforcement** | Max 4 bullets enforced in the prompt *and* `slice(0, 4)` post-processing |
| **Static file exposure** | Only `/docs` and root HTML are served; `.env` and `server.js` are not reachable via HTTP |
| **Body size limit** | `express.json({ limit: '2mb' })` — prevents oversized payload attacks |

---

## Themes

| Key | Font | Style |
| :--- | :--- | :--- |
| `minimalist` | Playfair Display | Clean white, blue accent |
| `professional` | Merriweather | Navy/purple, corporate |
| `dark` | Syne | Near-black, indigo glow |
| `scientific` | Source Serif 4 | Cool blue-grey, data-focused |
| `cyberpunk` | Orbitron | Dark navy, cyan/magenta neon |
| `brutalist` | Space Mono | Ivory, red-black |
| `neo-brutalist` | DM Mono | Warm beige, gold/red |
| `colorful` | Nunito | Warm orange-purple |
| `classic` | EB Garamond | Parchment, brown |
| `kids` | Fredoka One | Pink-teal, playful |
| `colorblind-safe` | Outfit | High-contrast blue/orange |

---

## Roadmap

Things that would make this better. Listed here mostly so I remember they exist.

- [ ] Regenerate individual slides without re-running the full deck
- [ ] Presentation history — auto-save to `localStorage`
- [ ] PPTX export (for the people who still live inside Microsoft Office)
- [ ] Custom slide topic ordering via drag-and-drop
- [ ] Theme preview before generation

---

## License

**ISC**

Do whatever you want with this. Fork it, deploy it, ship it to clients, name your startup after it. Just don't ask me to debug your fork.

The ISC license is functionally identical to MIT but shorter. Pick your battles.

---

<p align="center">Made with ☕ and mild existential dread · Antigravity</p>
