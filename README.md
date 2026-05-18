# TeachMe AI — Clean Pro Classroom

This is the organized version of the project.

## Run on Windows

1. Install Node.js if you do not already have it.
2. Open this folder in VS Code.
3. Open VS Code terminal.
4. Run:

```powershell
npm install
node server.js
```

5. Open:

```text
http://localhost:8060
```

## Easier run

Double-click:

```text
RUN_ME.bat
```

## Gemini API key

Do not paste your Gemini key into HTML, CSS, or JavaScript.

Use:

```text
RESET_GEMINI_KEY.bat
```

The key is saved only locally in:

```text
.gemini_key
```

## Main files

```text
server.js                 backend + Gemini API
public/index.html          page structure
public/css/styles.css      professional classroom design
public/js/config.js        app settings and student data
public/js/students.js      animated student rendering
public/js/audio.js         microphone and voice-turn capture
public/js/app.js           main app behavior
```

## Notes

- The mic captures one full teacher sentence after you pause.
- Students blink, breathe, raise hands, and move their mouths while speaking.
- If Gemini shows a quota error, the microphone may still be working; Gemini is just refusing requests temporarily.