@echo off
TITLE GrowLouder Notion Server
echo ==========================================
echo Starting GrowLouder Notion Servers...
echo ==========================================

:: Open webapp in Chrome
echo Opening Google Chrome...
start chrome http://localhost:3000

:: Run servers concurrently
:: --kill-others ensures if one crashes, the other is stopped too
:: Closing this window will terminate all servers running inside it
npx concurrently --kill-others -n "Next.js,Collab" -c "cyan,magenta" "npm run dev" "npm run collab"

pause
