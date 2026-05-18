# TeachMe AI — CLAUDE.md

Project guide for Claude Code sessions.

## Project Overview

TeachMe AI is a live, interactive AI classroom where the user plays the role of a teacher.
Ten animated CSS student avatars listen, react, raise hands, think, and speak back using
Google Gemini (audio → text + reply) and the browser's Web Speech API (text → voice).

## Tech Stack

- **Runtime**: Node.js ≥ 18 (no framework, plain `http` module)
- **AI**: Google Gemini (`gemini-2.5-flash-lite` with fallback to `gemini-2.5-flash`)
- **Frontend**: Vanilla JS ES modules, CSS animations, Web Speech API
- **Config**: `dotenv` for environment variables
- **Port**: 8060

## Development Commands

```bash
npm install        # install dependencies (dotenv only)
npm start          # start server → http://localhost:8060
```

## File Structure

```
server.js                 # Node HTTP server + Gemini proxy API
public/
  index.html              # Single-page classroom UI
  css/styles.css          # All styling + CSS animations
  js/
    config.js             # Student definitions, mood weights, voice profiles
    students.js           # DOM rendering, student state, weighted selection
    audio.js              # VoiceTurnRecorder (VAD, WAV encoding)
    app.js                # Main orchestrator, Gemini calls, speech synthesis
.env                      # Real secrets — never commit (in .gitignore)
.env.example              # Placeholder only: GEMINI_API_KEY=your_gemini_api_key_here
CLAUDE.md                 # This file
```

## Environment Variables

The server reads `process.env.GEMINI_API_KEY` via dotenv.
The user creates their own `.env` file manually.

## Architecture Notes

- The server acts as a secure proxy: the Gemini key never reaches the browser.
- Audio is captured by `VoiceTurnRecorder` → encoded as WAV → base64 → `/api/turn`.
- `/api/turn` sends audio + prompt to Gemini and returns `{transcript, student, mood, reply, action}`.
- Students have `weight` (how likely to be picked) and `voicePitch`/`voiceRate` (voice variation).
- Round-robin fairness: students spoken to least often get a bonus weight.
- History (last 8 exchanges) is sent with each turn for context-aware replies.
- The prompt explicitly instructs Gemini to reply based on what the teacher just said.

---

## MUST / ALWAYS / NEVER Rules

### MUST
- MUST read `GEMINI_API_KEY` only from `process.env` (via dotenv). Never from a file.
- MUST keep the Gemini key server-side only. Never expose it in frontend code.
- MUST preserve the existing file structure unless a change is clearly necessary.
- MUST test that the server starts without errors before finishing any session.

### ALWAYS
- ALWAYS use `escapeHtml()` before inserting user-derived text into the DOM.
- ALWAYS sanitize and length-limit all values returned by Gemini before use.
- ALWAYS keep `.env` and `gemini_key.txt` in `.gitignore`.
- ALWAYS send `studentProfiles` (name + mood) with each `/api/turn` request so Gemini picks appropriate personalities.

### NEVER
- NEVER hardcode, print, log, or commit any real API key.
- NEVER create a real `.env` file — only `.env.example` with a placeholder.
- NEVER make students ask generic questions unrelated to what the teacher just said.
- NEVER delete working features without replacing them with something better.
- NEVER break the VAD (voice activity detection) in `audio.js` — it is carefully tuned.
- NEVER add npm packages beyond what is strictly necessary (keep the app zero-dependency on the frontend).

---

## Design Rules

- Dark space theme for the app shell (`#060b1a` base).
- Classroom scene uses a light-wall / wood-floor palette for realism.
- Glass morphism cards (`.glass`) for overlays inside the classroom.
- All text must be legible — minimum contrast ratios enforced via color choices.
- Laptop-first layout: everything must fit in `100vh` with no scrolling.
- Animations must be subtle and purposeful — no gratuitous motion.
- Responsive breakpoints: 1200px (hide sidebar), 900px (hide goals card), 740px height (compact panel).

## Interaction Rules

- Students must reply based on the teacher's exact words — never generic filler.
- Weighted selection: eager/curious students respond more often.
- Round-robin: all students participate over time.
- Each student has a unique voice pitch and rate for the Web Speech API.
- When a student is thinking: show thinking dots + hand up + aura glow.
- When a student is speaking: show open mouth animation + listening aura on other students.
- Non-speaking students show a subtle reactive arm raise while one student is chosen.
