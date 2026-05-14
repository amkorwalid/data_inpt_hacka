# DentalMentor AI

DentalMentor AI is a Next.js web app for interactive dental radiograph teaching.  
It combines image analysis results with an active voice/text mentor conversation, synchronized canvas zoom/highlight actions, and animated live transcription.

## Features

- Upload radiographs (panoramic, bitewing, periapical) for analysis
- Interactive dashboard with:
  - Tooth-level and region highlights
  - Canvas zoom and annotation playback
  - Findings navigation panel
- Active mentor conversation with:
  - Voice recording (browser microphone) or typed message
  - OpenAI Whisper transcription for recorded audio
  - Anthropic Sonnet scripted narrative + canvas actions
  - gpt-4o-mini-tts audio playback for mentor narration
  - Animated live transcription display
- Local browser caching of repeated image analysis uploads
- Local browser transcript-only conversation history (compact storage)
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
  Used for conversation-driven mentor script generation and canvas tool sequencing.

### Required for voice conversation (Whisper + TTS)

- `OPENAI_API_KEY`  
  Required for:
  - Whisper transcription (`whisper-1`)
  - Mentor speech synthesis (`gpt-4o-mini-tts`)

## Scripts

- `npm run dev` - Start local dev server
- `npm run lint` - Run ESLint
- `npm run build` - Build production bundle
- `npm run start` - Start production server

## API Routes

- `POST /api/analyze` - Submit a radiograph file for analysis
- `GET /api/analyze?slug=...&language=...` - Poll analysis status/result
- `POST /api/mentor` - Generate mentor script from spatial context
- `POST /api/conversation` - Accept typed/recorded user input, transcribe audio, generate scripted response, and return narration audio

## Notes

- Demo mode uses bundled sample radiograph data and runs without ThakaaMed keys.
- Active conversation uses sequential script playback to animate text and synchronize canvas actions.
- This project is a demonstration prototype and does not replace professional dental consultation.
