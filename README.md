# Smart Note Taker

> A Chrome extension that takes notes from any video playing in your browser — on your terms.

Hit record, let it run, hit stop. Only what you chose to capture gets transcribed, summarised, and turned into clean structured notes. No fluff, no full-video dumps.

---

## How it works

```
Start recording → Audio captured from active Chrome tab
      ↓
Stop recording → Gladia transcribes only the captured segment  
      ↓
LLM summarisation → Raw transcript → layman-friendly rewrite
      ↓
(Optional) Related info fetch → context enriched automatically
      ↓
Structured personalised note saved locally via IndexedDB
```

---

## What makes this useful

- **You control the content** — start/stop mid-video to capture only what matters, skip the rest
- **Works on any video** — YouTube, Loom, course platforms, anything playing in Chrome
- **Personalised output** — LLM rewrites the transcript in plain language, not verbatim notes
- **Optional enrichment** — fetches related information to add context to your note automatically
- **Fully offline after generation** — notes persisted in IndexedDB, no backend, no account needed
- **20 hours free/month** — powered by Gladia's transcription API, free tier included

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension UI | React popup |
| Transcription | Gladia API |
| Summarisation | LLM API |
| Storage | IndexedDB (local, offline-first) |
| Platform | Chrome Extension (Manifest V3) |

---

## Getting Started

### Install locally

```bash
git clone https://github.com/TanishaKothari-45/smart-note-taker.git
cd smart-note-taker
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `build/` folder

### Environment variables

Create a `.env` file:
```env
REACT_APP_GLADIA_API_KEY=your_gladia_key
REACT_APP_LLM_API_KEY=your_llm_key
```

---

## License

MIT
