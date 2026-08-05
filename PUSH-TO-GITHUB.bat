@echo off
setlocal enabledelayedexpansion
title RxDx - publish to GitHub
cd /d "%~dp0"
set LOG=%~dp0push-log.txt

call :run > "%LOG%" 2>&1
type "%LOG%"
echo.
echo   (a copy of everything above is in push-log.txt)
echo.
pause
exit /b

:run
echo ============================================================
echo   RxDx  -  publishing to github.com/m7mdalshehri68/rxdx
echo   %DATE% %TIME%
echo ============================================================
echo.

echo --- looking for git ---
where git
git --version
if errorlevel 1 (
  echo.
  echo   RESULT: git is not installed.
  echo   Install from https://git-scm.com/download/win with all defaults,
  echo   then run this file again.
  exit /b 1
)
echo.

echo --- [1/6] repository ---
if not exist ".git" (
  git init
  git branch -M main
) else (
  echo already initialised
)
echo.

echo --- [2/6] remote ---
git remote remove origin 2>nul
git remote add origin https://github.com/m7mdalshehri68/rxdx.git
git remote -v
echo.

echo --- [3/6] fetching what is already on GitHub ---
git fetch origin main
if errorlevel 1 (
  echo.
  echo   RESULT: could not reach GitHub, or sign-in was not completed.
  echo   If a GitHub sign-in window opened, approve it and run this again.
  exit /b 1
)
git reset --soft origin/main
echo.

echo --- [4/6] staging ---
git add -A
git status --short
echo.

echo --- [5/6] commit ---
git -c user.name="Mohammed Alshehri" -c user.email="m7md.alshehri68@gmail.com" commit -m "RxDx web build: split reference tables, coder review queue, measured accuracy suite"
echo.

echo --- [6/6] push ---
git push origin HEAD:main
if errorlevel 1 (
  echo.
  echo   RESULT: the push failed. See the message above.
  exit /b 1
)

echo.
echo ============================================================
echo   RESULT: SUCCESS
echo   Repository: https://github.com/m7mdalshehri68/rxdx
echo   Next: Settings ^> Pages ^> Deploy from a branch ^> main / root
echo   Link:  https://m7mdalshehri68.github.io/rxdx/
echo ============================================================
exit /b 0
