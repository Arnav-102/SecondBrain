# Second Brain — Offline RAG & 3D Knowledge Graph 🧠

[![Launch 24/7 Live Web App](https://img.shields.io/badge/%F0%9F%9A%80_Launch_Live_Web_App-arnav--102.github.io%2FSecondBrain-8a2be2?style=for-the-badge)](https://arnav-102.github.io/SecondBrain/)
[![Open Local Dev UI](https://img.shields.io/badge/%F0%9F%92%BB_Local_Dev_UI-localhost%3A5173-4169e1?style=for-the-badge)](http://localhost:5173/)
[![FastAPI Swagger Docs](https://img.shields.io/badge/%E2%9A%A1_FastAPI_Swagger-127.0.0.1%3A8000%2Fdocs-10b981?style=for-the-badge)](http://127.0.0.1:8000/docs)

A full-stack **Retrieval-Augmented Generation (RAG)** knowledge assistant with an interactive **Three.js 3D Knowledge Graph**. It chunks `.pdf`, `.md`, and `.txt` documents locally, indexes 384-dimensional dense embeddings in **ChromaDB** (`all-MiniLM-L6-v2`) with **sub-150ms vector retrieval**, and visualizes semantic relationships across **5,000+ vector nodes at 60 FPS** using `THREE.InstancedMesh` Level-of-Detail (LOD) rendering.

---

## 🌐 Instant Live Demo (Zero Setup Required)

Click **[🚀 Launch Live Web App (`https://arnav-102.github.io/SecondBrain/`)](https://arnav-102.github.io/SecondBrain/)** above to run the interactive 3D Knowledge Graph and RAG Assistant directly in your browser 24/7—even when your local server is turned off!

- **If your local FastAPI backend (`127.0.0.1:8000`) is running:** It connects to your local **ChromaDB + Groq LLM** pipeline.
- **If opened from GitHub Pages on any laptop/phone (serverless):** It automatically uses its built-in **Browser-Native Vector Search & Pre-Indexed Portfolio Knowledge Base**, so you can orbit the 3D graph, run the **5,000-Node LOD Stress Test at 60 FPS**, upload files, and query the RAG chat anywhere!

---

## 💻 Local Full-Stack Launch (`start_demo.bat`)

To launch both the local FastAPI backend (`:8000`) and React + Three.js frontend (`:5173`) on your Windows PC:

1. Double-click **`start_demo.bat`** in your local `D:\second-brain-web` folder *(or run `.\start_demo.bat` in PowerShell)*.
2. Inside the web UI, click the **`🔄 Fresh Demo`** button in the top-right header anytime to reset the chat history and re-center the 3D Knowledge Graph.

---

## 🚀 Architecture & Engineering Highlights

- **Interactive 3D Knowledge Graph (`Three.js` + `React 19`):**
  - Visualizes parent **Document Hubs** and extracted **ChromaDB Vector Chunks** in 3D space with animated synaptic data pulses and auto-extracted topic badges.
  - **5,000+ Node LOD Stress Test (`60 FPS`):** Uses `THREE.InstancedMesh` and low-poly icosahedron Level-of-Detail (LOD) geometry to render 5,000+ 3D objects in a **single WebGL draw call** while maintaining a locked 60 FPS.
- **Sub-150ms Local Vector Retrieval (`ChromaDB` + `FastAPI`):**
  - Pre-warms the `all-MiniLM-L6-v2` ONNX embedding model in RAM at startup so HNSW cosine-similarity lookups execute in **`15–45 ms`**.
  - Supports `.pdf`, `.md` (Markdown), and `.txt` ingestion with real-time chunk telemetry and clickable `🎯` source citations that highlight the exact cited chunks in the 3D graph.
