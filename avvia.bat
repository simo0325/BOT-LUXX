@echo off
title Luxx Club Bot
echo ==============================================
echo        AVVIO BOT DISCORD LUXX CLUB
echo ==============================================
:loop
node index.js
echo.
echo [!] Il bot e' stato riavviato. Ripartenza automatica in corso...
timeout /t 2 /nobreak >nul
goto loop
