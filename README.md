# DentalMentor AI

DentalMentor AI is a Next.js web app for interactive dental radiograph teaching.  
It combines image analysis results with an audio mentor session, synchronized canvas zoom/highlight actions, and live transcription.

## Features

- Upload radiographs (panoramic, bitewing, periapical) for analysis
- Interactive dashboard with:
  - Tooth-level and region highlights
  - Canvas zoom and annotation playback
  - Findings navigation panel
- Audio mentor session with:
  - Language support: English, French, Arabic
  - Adjustable playback speed
  - Live transcription display
- Local browser caching of repeated image analysis uploads
- Offline demo mode (no external keys required)

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Konva / react-konva for canvas rendering

## Prerequisites

- Node.js 20+ recommended
- npm

## Getting Started

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a `.env.local` file in the project root and configure variables (see below).

3. Start development server:

   ```bash
   npm run dev
   ```

4. Open:

   - Landing page: `http://localhost:3000/`
   - Dashboard: `http://localhost:3000/dashboard`

## Environment Variables

### Required for live ThakaaMed analysis

- `THAKAAMED_BASE_URL`  
  Base endpoint used for submit/poll requests (language segment is normalized by the app).
- `THAKAAMED_API_KEY`
- `THAKAAMED_FACILITY_CODE`

### Optional for AI mentor script generation

- `ANTHROPIC_API_KEY`  
  If omitted, the app automatically uses a built-in rule-based fallback mentor script.

## Scripts

- `npm run dev` - Start local dev server
- `npm run lint` - Run ESLint
- `npm run build` - Build production bundle
- `npm run start` - Start production server

## API Routes

- `POST /api/analyze` - Submit a radiograph file for analysis
- `GET /api/analyze?slug=...&language=...` - Poll analysis status/result
- `POST /api/mentor` - Generate mentor script from spatial context

## Notes

- Demo mode uses bundled sample radiograph data and runs without ThakaaMed or Anthropic keys.
- Web speech playback relies on the browser SpeechSynthesis API.
- This project is a demonstration prototype and does not replace professional dental consultation.
