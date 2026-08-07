@echo off
call npm run rebuild:electron
call npx tsc -p tsconfig.electron.json
call npx concurrently --kill-others --success first "npx vite" "npx wait-on http://localhost:5173 && npx playwright test e2e-tests/export.spec.js --config=playwright.config.js --workers=1"
