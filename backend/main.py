import os
import time
import uuid
import math
import hashlib

# Force all model/embedding/temp caches onto D: drive (never touch C: drive)
if os.name == "nt" and os.path.exists("D:\\"):
    _cache_root = "D:\\second-brain-web-cache"
    os.makedirs(f"{_cache_root}\\temp", exist_ok=True)
    os.makedirs(f"{_cache_root}\\huggingface", exist_ok=True)
    os.makedirs(f"{_cache_root}\\chroma", exist_ok=True)
    os.makedirs(f"{_cache_root}\\userprofile\\.cache", exist_ok=True)
    os.environ["TEMP"] = f"{_cache_root}\\temp"
    os.environ["TMP"] = f"{_cache_root}\\temp"
    os.environ["HF_HOME"] = f"{_cache_root}\\huggingface"
    os.environ["CHROMA_CACHE_DIR"] = f"{_cache_root}\\chroma"
    os.environ["USERPROFILE"] = f"{_cache_root}\\userprofile"
    os.environ["HOME"] = f"{_cache_root}\\userprofile"

import PyPDF2
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from groq import Groq
import uvicorn

# Load .env file manually if present so python-dotenv is optional
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

app = FastAPI(title="Second Brain RAG API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB (Persistent local storage)
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="second_brain_docs")

# Warm up the ONNX MiniLM-L6-v2 embedding model in RAM at startup so every user query runs in <50ms
try:
    if collection.count() > 0:
        collection.query(query_texts=["warmup"], n_results=1)
except Exception:
    pass


def get_groq_client() -> Groq:
    # Re-read .env on each call so pasting GROQ_API_KEY works immediately without server restart
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    val = v.strip().strip('"').strip("'")
                    if val:
                        os.environ[k.strip()] = val
    return Groq(api_key=os.environ.get("GROQ_API_KEY", ""))


class ChatRequest(BaseModel):
    message: str


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "Second Brain RAG API is running.",
        "documents_indexed": collection.count(),
    }


@app.get("/documents")
def list_documents():
    """Return distinct uploaded documents and their chunk counts from ChromaDB."""
    try:
        data = collection.get(include=["metadatas", "documents"])
        metadatas = data.get("metadatas") or []
        documents = data.get("documents") or []
        doc_map: dict[str, dict] = {}
        for meta, doc_text in zip(metadatas, documents):
            if not meta:
                continue
            src = meta.get("source", "Unknown")
            if src not in doc_map:
                doc_map[src] = {"name": src, "chunks": 0, "chars": 0}
            doc_map[src]["chunks"] += 1
            doc_map[src]["chars"] += len(doc_text or "")
        result = []
        for src, info in doc_map.items():
            kb = max(0.1, round(info["chars"] / 1024, 1))
            result.append({
                "name": src,
                "chunks": info["chunks"],
                "size": f"{kb} KB ({info['chunks']} chunks)",
            })
        return {"documents": result, "total_chunks": len(metadatas)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    allowed_exts = (".pdf", ".txt", ".md")
    if not file.filename or not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(
            status_code=400,
            detail="Only PDF, TXT, and Markdown (.md) files are supported.",
        )

    temp_path = f"temp_{uuid.uuid4().hex[:8]}_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        if file.filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(temp_path)
        else:
            with open(temp_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        chunks = chunk_text(text)
        if not chunks:
            return {"status": "error", "message": "No readable text found in document."}

        # Remove older chunks of the same filename before re-indexing
        try:
            collection.delete(where={"source": file.filename})
        except Exception:
            pass

        ids = [f"{file.filename}_{i}_{uuid.uuid4().hex[:8]}" for i in range(len(chunks))]
        metadatas = [{"source": file.filename, "chunk_index": i} for i in range(len(chunks))]

        t0 = time.perf_counter()
        collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids,
        )
        embed_ms = round((time.perf_counter() - t0) * 1000, 1)

        return {
            "status": "success",
            "filename": file.filename,
            "chunks_processed": len(chunks),
            "embed_latency_ms": embed_ms,
        }

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    try:
        collection.delete(where={"source": filename})
        return {"status": "success", "message": f"Deleted {filename} from knowledge base"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
def get_knowledge_graph():
    """Return 3D coordinates and links for indexed documents and chunks in ChromaDB."""
    try:
        data = collection.get(include=["metadatas", "documents"])
        ids = data.get("ids") or []
        metadatas = data.get("metadatas") or []
        documents = data.get("documents") or []

        nodes = []
        links = []
        doc_hubs: dict[str, str] = {}

        # Group by source document
        sources = sorted(list({m.get("source", "Unknown") for m in metadatas if m}))
        num_sources = max(1, len(sources))

        for s_idx, src in enumerate(sources):
            angle = (2 * math.pi * s_idx) / num_sources
            radius = 18.0 if num_sources > 1 else 0.0
            hx = radius * math.cos(angle)
            hz = radius * math.sin(angle)
            hy = ((s_idx % 3) - 1) * 6.0 if num_sources > 1 else 0.0
            hub_id = f"doc::{src}"
            doc_hubs[src] = hub_id
            nodes.append({
                "id": hub_id,
                "label": src,
                "type": "document",
                "source": src,
                "preview": f"Source Document: {src}",
                "x": round(hx, 2),
                "y": round(hy, 2),
                "z": round(hz, 2),
            })

        # Connect document hubs to each other in a ring
        if len(sources) > 1:
            for i in range(len(sources)):
                links.append({
                    "source": doc_hubs[sources[i]],
                    "target": doc_hubs[sources[(i + 1) % len(sources)]],
                    "strength": 0.4,
                })

        # Add chunk nodes clustered around their parent document hub
        for idx, (cid, meta, doc_text) in enumerate(zip(ids, metadatas, documents)):
            if not meta:
                continue
            src = meta.get("source", "Unknown")
            c_idx = meta.get("chunk_index", idx)
            hub_id = doc_hubs.get(src)

            # Deterministic 3D offset from hash of content
            h = int(hashlib.md5(cid.encode("utf-8")).hexdigest()[:8], 16)
            theta = (h % 360) * (math.pi / 180.0)
            phi = ((h >> 8) % 180) * (math.pi / 180.0)
            r = 4.0 + ((h >> 16) % 70) / 10.0

            parent = next((n for n in nodes if n["id"] == hub_id), {"x": 0, "y": 0, "z": 0})
            cx = parent["x"] + r * math.sin(phi) * math.cos(theta)
            cy = parent["y"] + r * math.cos(phi)
            cz = parent["z"] + r * math.sin(phi) * math.sin(theta)

            snippet = (doc_text or "").strip().replace("\n", " ")[:180]
            nodes.append({
                "id": cid,
                "label": f"{src} #{c_idx + 1}",
                "type": "chunk",
                "source": src,
                "chunk_index": c_idx,
                "preview": snippet,
                "x": round(cx, 2),
                "y": round(cy, 2),
                "z": round(cz, 2),
            })

            if hub_id:
                links.append({
                    "source": hub_id,
                    "target": cid,
                    "strength": 0.8,
                })

        return {"nodes": nodes, "links": links, "total_chunks": len(ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat_with_brain(request: ChatRequest):
    # 1. Measure vector retrieval latency (<150ms target)
    t_start = time.perf_counter()
    total_docs = collection.count()
    sources_out = []
    context_parts = []

    if total_docs > 0:
        n_res = min(4, total_docs)
        results = collection.query(
            query_texts=[request.message],
            n_results=n_res,
            include=["documents", "metadatas", "distances"],
        )
        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        dists = (results.get("distances") or [[]])[0]

        for doc_text, meta, dist in zip(docs, metas, dists):
            src_name = (meta or {}).get("source", "Document")
            c_idx = (meta or {}).get("chunk_index", 0)
            similarity = max(0, min(99, round((1 / (1 + max(0.0, float(dist)))) * 100)))
            context_parts.append(f"[Source: {src_name}, Chunk #{c_idx + 1}]\n{doc_text}")
            sources_out.append({
                "source": src_name,
                "chunk_index": c_idx,
                "similarity": similarity,
                "snippet": (doc_text or "").strip().replace("\n", " ")[:260],
            })

    retrieval_ms = round((time.perf_counter() - t_start) * 1000, 1)
    context = "\n\n".join(context_parts)

    groq_client = get_groq_client()
    if not groq_client.api_key:
        if sources_out:
            bullets = "\n\n".join(
                f"- **Chunk #{s['chunk_index'] + 1}** (`{s['similarity']}%` semantic match from `{s['source']}`):\n  > {s['snippet']}..."
                for s in sources_out[:3]
            )
            return {
                "reply": (
                    f"**[Offline ChromaDB Vector Search — `{retrieval_ms} ms`]**\n\n"
                    f"Here are the top matching passages retrieved from your knowledge base "
                    f"*(add `GROQ_API_KEY` in `backend/.env` to enable Llama 3 AI summarization)*:\n\n"
                    f"{bullets}"
                ),
                "retrieval_latency_ms": retrieval_ms,
                "sources": sources_out,
            }
        return {
            "reply": "No documents uploaded yet, and `GROQ_API_KEY` is not set. Upload a PDF/MD/TXT document in the sidebar to test semantic vector search!",
            "retrieval_latency_ms": retrieval_ms,
            "sources": [],
        }

    system_prompt = (
        "You are 'Second Brain', an intelligent RAG knowledge assistant built by Arnav Sinha. "
        "Use the retrieved context chunks below to answer the user's question accurately and concisely. "
        "Cite the source document name when referencing facts from the context. "
        "If the context does not contain the answer, state clearly what is and isn't in the uploaded knowledge base.\n\n"
        f"Retrieved Context:\n{context if context else 'No documents uploaded yet.'}"
    )

    models_to_try = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "llama-3.3-70b-versatile",
    ]
    last_err = None
    for model_id in models_to_try:
        try:
            completion = groq_client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.message},
                ],
                temperature=0.3,
                max_tokens=1024,
            )
            reply = completion.choices[0].message.content
            return {
                "reply": reply,
                "retrieval_latency_ms": retrieval_ms,
                "model": model_id,
                "sources": sources_out,
            }
        except Exception as e:
            last_err = str(e)
            continue

    return {
        "reply": f"Error calling Groq API: {last_err}",
        "retrieval_latency_ms": retrieval_ms,
        "sources": sources_out,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
