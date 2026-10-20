@echo off
title Second Brain RAG + 3D Knowledge Graph Launcher
echo ========================================================
echo   Starting Second Brain (FastAPI + ChromaDB + Three.js)
echo ========================================================

REM Route all temp and model caches strictly to D: drive
set TEMP=D:\second-brain-web-cache\temp
set TMP=D:\second-brain-web-cache\temp
set HF_HOME=D:\second-brain-web-cache\huggingface
set CHROMA_CACHE_DIR=D:\second-brain-web-cache\chroma
set npm_config_cache=D:\second-brain-web-cache\npm

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "SecondBrain Backend (Port 8000)" cmd /k "cd /d D:\second-brain-web\backend && .\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting React + Three.js Frontend on http://localhost:5173 ...
start "SecondBrain Frontend (Port 5173)" cmd /k "cd /d D:\second-brain-web\frontend && npm run dev -- --host 0.0.0.0 --port 5173"

echo [3/3] Waiting 4 seconds for servers to initialize, then opening browser...
timeout /t 4 /nobreak >nul
start http://localhost:5173/

echo.
echo Done! Second Brain is live at http://localhost:5173/
