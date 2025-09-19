@echo off
setlocal
REM Wrapper to run the PowerShell pipeline from Command Prompt (cmd.exe)
REM Passes all arguments through to run_all.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_all.ps1" %*
endlocal


