<p align="center">
  <img src="docs/assets/banner.svg" alt="Prism" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/license-ISC-green.svg" alt="License ISC" />
  <img src="https://img.shields.io/badge/language-JS%20%2F%20HTML-yellow.svg" alt="Language JS" />
  <img src="https://img.shields.io/badge/integration-Groq%20Cloud-blueviolet.svg" alt="Groq SDK" />
</p>

Prism is a brutally efficient, single-page presentation builder that turns a single sentence into beautifully formatted, chart-equipped slides.

---

## What even is this?
Prism is an AI-powered presentation studio wrapped in an elegant web interface. You type in a topic, outline some constraints, and hit generate. Behind the scenes, we coordinate with Groq’s high-speed inference cloud to compose an entire logical slide deck complete with auto-generated inline SVG data visualizations. It’s entirely localized in a single HTML page with a tiny Node backbone, giving you lightning-fast results you can directly export to PDF.

## Why does this exist?
Building quick slide decks is inherently tedious. You constantly have to fight template menus, worry about bullet-point densities, and dig for clipart just to convey a simple point. Prism was built to cut through that nonsense by treating presentation design as raw data extraction. It prioritizes structure and strict readability rules—making sure content isn't a cramped paragraph and graphs never overlap—while giving you a completely distraction-free interface.

## Features
* **1-Click Inference** — Pitch an idea and the engine structures a 5-26 slide narrative instantly utilizing an auto-generated core workflow (e.g., Problem Statement, System Logic).
* **Inline Visualization Engine** — The LLM natively auto-maps metrics and structures zero-dependency SVG charts avoiding false data/hallucinations perfectly.
* **Strict Density Boundaries** — Enforces a strict max 4-bullet limit globally so your slides are never cramped or redundant.
* **No-Hallucination Guardrails** — The AI safely falls back to visual qualitative placeholders over making up fake numbers when generating data diagrams.
* **Immediate PDF Exports** — Seamlessly packages the DOM layer structure right into a printable presentation file via html2canvas without complex libraries.

## Architecture
Prism relies on a decoupled structure where a deeply intelligent Express server guides and validates Groq’s JSON generation layer, while the frontend handles dynamic rendering. We avoid complex build pipelines, allowing UI logic changes to deploy instantly natively.

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Architecture diagram" />
</p>

## How it works
You interface with the frontend UI to lock in themes and outline expectations. The backend takes this payload, translates it into strict architectural schema prompts (ensuring proper spacing constraints and vocabulary limits), and runs it through Llama 3.1 8B. The data is returned as a JSON sequence injected with dynamic geometric SVG block strings, and painted straight to the screen.

<p align="center">
  <img src="docs/assets/flow.svg" alt="Request flow" />
</p>

## Tech stack

| Technology | Role | Why we picked it |
| :--- | :--- | :--- |
| **Express** | Main backend runtime | Extremely lightweight and handles JSON limit patching securely on port 3001. |
| **Vanilla JS & HTML5** | Frontend interface | Avoiding heavy frontend frameworks ensures maximum rendering speed processing dynamic charts natively. |
| **Groq-SDK** | Cloud LLM integration | Unbeatable response times regarding structural JSON constraint blocks mapping dynamic logic. |

## Getting started

### Prerequisites
* Node.js
* NPM or Yarn installed

### Installation
Clone the repository and install the backend modules directly tracking `package.json`:
```bash
npm install express cors groq-sdk
```

### Configuration
Currently, API keys are instantiated directly securely in local development blocks (`server.js`). Environmental variable injections are being planned as global configuration bindings.

### Running locally
Start the explicit node framework:
```bash
npm start
```
*The host application interfaces natively at `http://localhost:3001`*

## Usage
Simply load the webpage locally and configure an environment mapping boundary:

1. **Title**: "The Future of Space Exploration"
2. **Theme Selection**: e.g., `Minimalist` or `Cyberpunk` or `Brutalist`.
3. **Data Constraint Option**: Toggle inline native visuals mapping cleanly. 
4. **Slide Generation Constraints**: E.g., `Min 5, Max 10 slides`.

If the prompt lacks explicit slides manually added, the system safely triggers a comprehensive 26-point generic auto-template logic boundary cleanly (e.g. `Problem Statement`, `System Architecture Diagram`, `Future Scope`) and compiles a logically structured response limited implicitly to the slide bounds you set natively! Finally, click **Export PDF** instantly from the presentation viewer when finished.

## Use cases
* For **Product Managers** that need to prep weekly strategy sync presentations immediately safely bound by strict design parameters instead of tweaking fonts randomly.
* For **Engineers** forced to summarize complex systems without the pain of visual UI placement tracking.
* For **Students** that need structured logic outlines the night before a presentation natively bounded by clear hierarchical layouts automatically.

## Project structure
```text
Prism/
├── docs/assets         # Bounded UI README vector mappings securely mapped manually
├── package.json        # Backend explicit configurations & dependencies mapping natively
├── server.js           # Server application, prompt logic generation limits securely tracked natively
└── index_v2.html       # The single-page frontend styling, interface bound securely
```

## API reference

### `POST /api/generate`
Communicates frontend configuration parameters natively handling the LLM string.
* **Body constraints**:
  * `title` (String) Required topic.
  * `theme` (String) Defines strict visualization boundaries fallback bounds mapping (e.g. minimalistic padding tracking).
  * `min_slides` (Int) Defaults bound fallback 5.
  * `max_slides` (Int) Defaults target 12.
* **Returns**: Generates bounded JSON block `slides` safely formatting array of points mapped dynamically without hallucinations mapping arrays `[title, bullets (max 4 limits), visuals, layout layout string, svg_code]`. 

## Development

### Running tests
Currently tests execute via isolated Node start instances securely:
```bash
npm start
```

### Contributing
We happily take pulls for generating structured internal predefined layout block schemas. Ensure SVG contributions comply with `font-family="system-ui"` strictly handling flat geometric bounds limiting gradients securely globally.

## Roadmap
- [ ] Incorporate dynamic mapping arrays parsing explicit user environmental variables handling keys efficiently.
- [ ] Save presentation historical backups locally bound securely.
- [ ] Migrate local `.env` bindings logic manually mapped dynamically avoiding hardcoded values.

## License
ISC — do whatever you want, just don't blame us.

---

<p align="center">
  Made with ☕ and mild existential dread · Antigravity
</p>
