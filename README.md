# 🦷 DentalMentor AI

An interactive dental radiology teaching platform where an AI mentor narrates X-ray findings while the canvas automatically zooms and highlights relevant teeth in sync with the voice — like having an expert dentist looking over your shoulder.

> ⚠️ **Hackathon prototype.** This tool is a demonstration and does not replace consultation with a qualified dentist. Not validated as a medical device.

---

## What it does

Upload a dental radiograph (panoramic, periapical, or bitewing). The ThakaaMed AI engine analyses it, detecting cavities, infections, implants, bone loss, and more. Then an AI mentor — powered by Claude — narrates a full teaching session:

- The canvas **zooms in** on each tooth before it is discussed
- Detected pathologies are **highlighted in color** (red = urgent, yellow = watch, green = healthy, blue = restoration)
- The mentor **speaks aloud** in your chosen language
- When finished with a tooth, the view **resets** before moving to the next

Everything is synchronized: the voice, the zoom, and the highlights play in sequence like a real mentor at a lightbox.

---

## Demo mode

You do not need API keys to try the UI. A hardcoded sample session with 6 teeth and pre-built script events lets you test the full canvas and audio pipeline instantly.

Click **"Try demo"** on the upload screen — no ThakaaMed or Claude calls are made.

---

## Setup

### Prerequisites

- Node.js 18+
- A modern browser (Chrome or Edge recommended for best TTS voice quality)

### 1. Clone and install

```bash
git clone https://github.com/your-org/dentalmentor-ai
cd dentalmentor-ai
npm install
```

### 2. Configure environment variables

Create a `.env.local` file at the project root:

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# ThakaaMed
THAKAAMED_API_KEY=YOUR_32_CHAR_HEX_KEY
THAKAAMED_FACILITY_CODE=YOUR_FACILITY_CODE
THAKAAMED_BASE_URL=https://aiv4.thakaamed.com/api/v2.3/en/analyze/radiography/
```

> Never commit `.env.local` to Git. It is already in `.gitignore`.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key — get one at console.anthropic.com |
| `THAKAAMED_API_KEY` | Yes | 32-character hex key from your hackathon credentials table |
| `THAKAAMED_FACILITY_CODE` | Yes | Required on every ThakaaMed call — missing this returns a 400 |
| `THAKAAMED_BASE_URL` | Yes | Base URL for the v2.3 endpoint (language segment is `/en/`) |

---

## Project structure

```
src/
  app/
    page.tsx                  # Main page — layout and state machine
    api/
      analyze/route.ts        # ThakaaMed proxy (POST submit + GET poll)
      mentor/route.ts         # Claude tool-use session → script array
  components/
    UploadZone.tsx            # Drag-and-drop X-ray upload with cache check
    RadiographCanvas.tsx      # Konva.js canvas: zoom, highlight, annotate
    MentorPanel.tsx           # Script player, language selector, controls
    FindingsList.tsx          # Sidebar: all findings sorted by confidence
  lib/
    thakaamed.ts              # API client: submit, poll, analyzeWithCache
    spatialContext.ts         # ThakaaMed JSON → LLM-ready spatial map
    scriptPlayer.ts           # Sequential [speak, canvas] event executor
    canvasOps.ts              # zoomToTooth, highlightRegion, resetView, annotate
    cache.ts                  # SHA-256 file hash → localStorage JSON cache
    sampleData.ts             # Hardcoded spatial context for demo mode
    sampleScript.ts           # Hardcoded ScriptEvent[] for demo mode
  types/
    thakaamed.ts              # ThakaaMed v2.3 response types
    script.ts                 # ScriptEvent union type
```

---

## How the architecture works

```
Upload X-ray
    ↓
SHA-256 hash → check localStorage cache
    ↓ (cache miss)
ThakaaMed API: POST image → poll until is_done: true
    ↓
spatialContext builder: tooth_id → { bbox, polygon, findings }
    ↓
Claude API: spatial context injected into system prompt + 4 custom tools
    ↓
Parse response into ordered ScriptEvent[] array: [speak, canvas, speak, canvas, ...]
    ↓
Script player: await each event sequentially
    ├── speak → Web Speech API (utterance.onend resolves)
    └── canvas → Konva.js tween (onFinish resolves)
```

The key design decision is **collect first, play second**: the full Claude response is parsed into a script array before playback begins. This gives perfect audio/visual sync without fighting streaming timing.

---

## Saving your ThakaaMed token quota

Each analysis costs 1 token from your 1,000-token pool. The cache layer prevents re-analysis of the same image.

Recommended token budget for a 48-hour hackathon:

| Phase | Tokens |
|---|---|
| Day 1 exploration — learn the JSON structure | ~50 |
| Day 1–2 development — use cached JSONs aggressively | ~200 |
| Final demo on real images | ~100–200 |
| Reserve for the unexpected | ~500 |

**Practical tips:**
- Use demo mode for all UI and animation work — zero tokens consumed
- Download 10–15 reference JSON files on day 1, commit them to `/data/samples/`, and point the app at them during development
- Only call the live API when testing with a genuinely new image type

---

## Multilingual support

The mentor session can run in three languages. Select before starting — the choice cannot be changed mid-session.

| Language | TTS locale | ThakaaMed URL segment |
|---|---|---|
| English | `en-US` | `/en/` |
| French | `fr-FR` | `/fr/` |
| Arabic | `ar-MA` | `/ar/` |

The ThakaaMed API supports multilingual responses via the URL segment — the AI detection is identical across languages, only the text labels change. A single POST (consuming 1 token) can be retrieved in multiple languages via separate GET requests.

---

## Browser compatibility and TTS notes

The voice narration uses the **Web Speech API** — available in all modern browsers with no extra dependency or cost.

| Browser | Quality | Notes |
|---|---|---|
| Chrome (desktop) | ★★★★★ | Best voice selection, most reliable |
| Edge (desktop) | ★★★★★ | Excellent, uses system neural voices |
| Firefox | ★★★☆☆ | Works, voice quality varies by OS |
| Safari | ★★★★☆ | Requires a user gesture before first speech |
| Chrome (mobile) | ★★★☆☆ | Works; fewer voices available |

**If you want higher-quality voices** (for a polished demo), swap the `speakText` function in `lib/scriptPlayer.ts` for an ElevenLabs or OpenAI TTS call. The interface is identical — both return a Promise resolving when audio ends.

---

## Canvas highlight colors

| Color | Clinical meaning |
|---|---|
| 🔴 Red | Active pathology — caries, abscess, infection |
| 🟡 Yellow | Watch zone — borderline finding, monitor |
| 🟢 Green | Healthy tooth confirmed |
| 🔵 Blue | Restoration, implant, or prosthesis |

Opacity is set to 35% by default so the underlying radiograph remains visible beneath the highlight.

---

## Playback controls

| Control | Action |
|---|---|
| Start session | Fetches Claude script, begins playback |
| Pause / Resume | Cancels in-progress speech, freezes script iteration |
| Stop | Aborts session, resets canvas to full view, clears all overlays |
| Speed (0.7× / 1× / 1.3×) | Adjusts SpeechSynthesisUtterance rate — useful for replay |
| Language selector | English / French / Arabic — locked once session starts |

---

## API routes

### `POST /api/analyze`

Proxies the image upload to ThakaaMed. Accepts `multipart/form-data` with an `image` field.

Returns:
```json
{ "slug": "9941c5cf-6e4f-4f02-9425-..." }
```

### `GET /api/analyze?slug=...`

Polls ThakaaMed for results. Returns the full ThakaaMed JSON when `is_done: true`.

### `POST /api/mentor`

Body: `{ spatialContext, language }`

Calls Claude with the spatial context injected and 4 custom tools. Returns:
```json
{
  "script": [
    { "type": "speak", "text": "Let's start with the upper right quadrant..." },
    { "type": "canvas", "tool": "zoom_to_tooth", "input": { "tooth_id": "16" } },
    { "type": "canvas", "tool": "highlight_region", "input": { "tooth_id": "16", "color": "red", "opacity": 0.35 } },
    ...
  ]
}
```

---

## Common errors

| Error | Likely cause | Fix |
|---|---|---|
| `400 Bad Request — Facility key required` | `THAKAAMED_FACILITY_CODE` missing | Check `.env.local`, restart dev server |
| `404 / invalid api_key` | Typo in key | Exact copy-paste, watch for trailing spaces |
| Canvas highlights in wrong position | Coordinate transform bug | Check `origWidth`/`origHeight` are the source image dimensions, not display size |
| No voice on Safari | First speech blocked without gesture | The Start Session button click counts as the gesture — should work automatically |
| `speechSynthesis` voices array empty | Voices not loaded yet | The app waits for `speechSynthesis.onvoiceschanged` before enabling the start button |
| Claude returns no tool calls | Prompt issue or all teeth missing | Check spatialContext is not empty before calling `/api/mentor` |

---

## Evaluation criteria alignment (MedConnect Hackathon)

| Criterion | How this project addresses it |
|---|---|
| Real impact (30%) | Teaches dental students to read X-rays — a documented skill gap in dental education |
| Technical quality (25%) | Clean tool-use architecture, coordinate transforms, async script player, cache layer |
| Creativity (20%) | Synchronized zoom + highlight + voice is novel — no existing tool does this |
| Polish and UX (15%) | Dark canvas theme, smooth Konva tweens, clear playback controls |
| Presentation (10%) | Demo mode works without any API keys — perfect for a live judge demo |

---

## Roadmap (post-hackathon)

- [ ] ElevenLabs / OpenAI TTS for higher-quality multilingual voices
- [ ] Student annotation mode — draw on the canvas, compare with AI
- [ ] Session recording — export the narrated session as an MP4
- [ ] Quiz mode — AI asks questions, student clicks the answer on the canvas
- [ ] Batch mode — process a library of anonymised X-rays for self-study
- [ ] Commercial ThakaaMed licence integration

---

## Medical disclaimer

The ThakaaMed AI models used here are diagnostic-aid tools designed for use by qualified dentists. No prototype built during this hackathon should be used directly on patients without validation by a qualified dentist.

All user interfaces targeting the general public must include:

> ⚠️ This tool is a demonstration prototype. It does not replace a consultation with a qualified dentist.

Do not store any patient image without written consent. Anonymise everything you present publicly.

---

## License

MIT — see `LICENSE` for details.

---

Built for the **MedConnect Hackathon** · Powered by [ThakaaMed](https://thakaamed.com) · [Anthropic Claude](https://anthropic.com) · [Konva.js](https://konvajs.org)