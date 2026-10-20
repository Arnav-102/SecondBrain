# Second Brain — Offline RAG & 3D Knowledge Graph 🧠

[![1-Click Local Demo Launcher](https://img.shields.io/badge/%E2%96%B6%EF%B8%8F_1--Click_Launch-start__demo.bat-8a2be2?style=for-the-badge)](./start_demo.bat)
[![Open Local Web UI](https://img.shields.io/badge/%F0%9F%8C%90_Local_Web_UI-localhost%3A5173-4169e1?style=for-the-badge)](http://localhost:5173/)
[![FastAPI Swagger Docs](https://img.shields.io/badge/%E2%9A%A1_FastAPI_Swagger-127.0.0.1%3A8000%2Fdocs-10b981?style=for-the-badge)](http://127.0.0.1:8000/docs)

A full-stack **Retrieval-Augmented Generation (RAG)** knowledge assistant with an interactive **Three.js 3D Knowledge Graph**. It chunks `.pdf`, `.md`, and `.txt` documents locally, indexes 384-dimensional dense embeddings in **ChromaDB** (`all-MiniLM-L6-v2`) with **sub-150ms vector retrieval**, and visualizes semantic relationships across **5,000+ vector nodes at 60 FPS** using `THREE.InstancedMesh` Level-of-Detail (LOD) rendering.

---

## ⚡ 1-Click Live Interview Demo

To launch both the FastAPI backend (`:8000`) and the React + Three.js frontend (`:5173`) and open the browser automatically:

1. Double-click **[`start_demo.bat`](./start_demo.bat)** in the project root *(or run `.\start_demo.bat` in PowerShell/CMD)*.
2. Inside the web UI (`http://localhost:5173/`), click the **`Fresh Demo`** button in the top-right header anytime to reset the chat history and re-center the 3D Knowledge Graph for a clean live walkthrough.

---

## 🚀 Architecture & Engineering Highlights

- **Interactive 3D Knowledge Graph (`Three.js` + `React 19`):**
  - Visualizes parent **Document Hubs** and extracted **ChromaDB Vector Chunks** in 3D space with animated synaptic data pulses and auto-extracted topic badges.
  - **5,000+ Node LOD Stress Test (`60 FPS`):** Uses `THREE.InstancedMesh` and low-poly icosahedron Level-of-Detail (LOD) geometry to render 5,000+ 3D objects in a **single WebGL draw call** while maintaining a locked 60 FPS.
- **Sub-150ms Local Vector Retrieval (`ChromaDB` + `FastAPI`):**
  - Pre-warms the `all-MiniLM-L6-v2` ONNX embedding model in RAM at startup so HNSW cosine-similarity lookups execute in **`15–45 ms`**.
  - Supports `.pdf`, `.md` (Markdown), and `.txt` ingestion with real-time chunk telemetry and clickable `🎯` source citations that highlight the exact cited chunks in the 3D graph.
- **Hybrid AI Synthesis (`Groq LLM API` + Offline Fallback):**
  - Synthesizes structured Markdown answers with inline chunk citations, and gracefully falls back to **100% Offline Vector Search Mode** if no API key is configured.

---

## 💻 Manual Terminal Setup (2 Terminals)

### 1. Start the FastAPI + ChromaDB Backend (`Port 8000`)
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*(Optional: Add `GROQ_API_KEY=gsk_...` inside `backend/.env` for live LLM synthesis.)*

### 2. Start the React + Three.js Frontend (`Port 5173`)
```powershell
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```
