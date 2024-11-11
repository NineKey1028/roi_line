@echo off
REM 切換到腳本所在目錄
cd /d %~dp0

REM 執行 git pull
echo Pulling latest changes from Git...
git pull

REM 使用預設瀏覽器打開 index.html
echo Opening index.html...
start index.html
