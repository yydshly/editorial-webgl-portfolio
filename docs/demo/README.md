# Demo recording

`editorial-webgl-demo.webm` is a short Desktop production-preview journey from
Hero through Books, captured locally at 1440 x 900 on 2026-07-27.

It demonstrates the DOM-first editorial sequence and shared WebGL experience;
it is not a claim that DEV-HOST-01, its timeline, or FIELD NOTES publications
are real. The project remains a fictional development experiment using
development imagery.

To reproduce the capture while the local production preview is running:

```powershell
$env:DEMO_BASE_URL='http://127.0.0.1:3020'
node scripts/capture-demo.mjs
```

The recording is intentionally separate from ignored automated-test evidence
under `artifacts/` so the repository contains one small, human-facing demo.
