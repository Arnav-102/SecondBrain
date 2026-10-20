import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code,
  Upload,
  Send,
  BrainCircuit,
  FileText,
  Loader2,
  Bot,
  User,
  Trash2,
  Zap,
  Network,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KnowledgeGraph3D, type GraphNode, type GraphLink } from './KnowledgeGraph3D';

interface SourceCitation {
  source: string;
  chunk_index: number;
  similarity: number;
  snippet: string;
}

interface ChatMessage {
  id: number;
  role: 'bot' | 'user';
  text: string;
  latency_ms?: number;
  sources?: SourceCitation[];
}

interface DocItem {
  name: string;
  size: string;
  chunks?: number;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sb_messages');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            role: 'bot',
            text: 'Hello! I am your **Second Brain**. Upload `.pdf`, `.md`, or `.txt` documents in the sidebar, explore the **3D Knowledge Graph**, or ask me anything with sub-150ms semantic vector retrieval.',
          },
        ];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState<DocItem[]>(() => {
    const saved = localStorage.getItem('sb_files');
    return saved ? JSON.parse(saved) : [];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'split' | 'graph' | 'chat'>('split');
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [activeSourceKeys, setActiveSourceKeys] = useState<string[]>([]);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const scrollToBottom = () => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  const fetchBackendState = useCallback(async () => {
    try {
      const [docsRes, graphRes] = await Promise.all([
        fetch(`${apiUrl}/documents`),
        fetch(`${apiUrl}/graph`),
      ]);
      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        if (Array.isArray(docsJson.documents)) {
          setFiles(docsJson.documents);
        }
      }
      if (graphRes.ok) {
        const graphJson = await graphRes.json();
        setGraphData({
          nodes: graphJson.nodes || [],
          links: graphJson.links || [],
        });
      }
    } catch {
      // Backend offline or starting up; keep local state
    }
  }, [apiUrl]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchBackendState();
  }, [fetchBackendState]);

  useEffect(() => {
    localStorage.setItem('sb_messages', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sb_files', JSON.stringify(files));
  }, [files]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = { id: Date.now(), role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text }),
      });
      const data = await res.json();
      if (typeof data.retrieval_latency_ms === 'number') {
        setLastLatency(data.retrieval_latency_ms);
      }
      if (Array.isArray(data.sources) && data.sources.length > 0) {
        setActiveSourceKeys(
          data.sources.map((s: SourceCitation) => `${s.source}::${s.chunk_index}`)
        );
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: data.reply,
          latency_ms: data.retrieval_latency_ms,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'bot', text: 'Error connecting to backend API.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const res = await fetch(`${apiUrl}/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.name !== filename));
        fetchBackendState();
      }
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.embed_latency_ms === 'number') {
          setLastLatency(data.embed_latency_ms);
        }
        await fetchBackendState();
      }
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen relative overflow-hidden bg-brain-900 font-sans">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] opacity-40 bg-[radial-gradient(circle,_#8a2be2_0%,_transparent_70%)] z-0"></div>
      <div
        className="pointer-events-none absolute -bottom-[10%] -right-[10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[120px] opacity-40 bg-[radial-gradient(circle,_#4169e1_0%,_transparent_70%)] z-0"
      ></div>

      {/* Header */}
      <header className="shrink-0 glass-panel mx-5 mt-4 mb-3 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4 z-10 relative">
        <div className="flex items-center gap-3">
          <BrainCircuit size={32} className="text-[#8a2be2]" />
          <div>
            <h1 className="text-gradient text-2xl font-semibold tracking-tight">Second Brain</h1>
            <p className="text-xs text-gray-400">
              Offline ChromaDB Vector Store • Llama 3 RAG • Three.js 3D Knowledge Graph
            </p>
          </div>
        </div>

        {/* Center View Switcher */}
        <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'split'
                ? 'bg-gradient-to-r from-[#8a2be2] to-[#4169e1] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Network size={16} />
            3D Graph + Chat (Split)
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'graph'
                ? 'bg-gradient-to-r from-[#8a2be2] to-[#4169e1] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Network size={16} />
            3D Fullscreen
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-[#8a2be2] to-[#4169e1] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare size={16} />
            Chat Only
          </button>
        </div>

        <div className="flex items-center gap-3">
          {lastLatency !== null && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-mono">
              <Zap size={14} className="text-emerald-400" />
              {lastLatency} ms retrieval
            </div>
          )}

          <a
            href="https://github.com/Arnav-102/SecondBrain-RAG"
            target="_blank"
            rel="noreferrer"
            className="no-underline"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition-colors font-medium cursor-pointer"
            >
              <Code size={20} />
              View on GitHub
            </motion.button>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex gap-5 px-5 pb-4 z-10 relative overflow-hidden">
        {/* Left Sidebar: Knowledge Base */}
        <aside className="glass-panel w-72 h-full min-h-0 shrink-0 flex flex-col p-5">
          <div className="shrink-0 flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Knowledge Base</h2>
            <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-gray-300">
              {files.length} docs
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-2 custom-scrollbar">
            <AnimatePresence>
              {files.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-8 border border-dashed border-white/10 rounded-xl p-4">
                  Upload any <b>.pdf</b>, <b>.md</b>, or <b>.txt</b> file to chunk, embed into ChromaDB, and visualize in 3D.
                </div>
              ) : (
                files.map((f, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={f.name}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                  >
                    <FileText size={24} className="text-[#4169e1] shrink-0" />
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="text-sm text-white font-medium truncate">{f.name}</span>
                      <span className="text-xs text-gray-400">{f.size}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(f.name)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-lg hover:bg-red-400/20 cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.md"
            />
            <motion.label
              htmlFor="file-upload"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#8a2be2] to-[#4169e1] text-white p-3 rounded-xl cursor-pointer font-medium w-full shadow-lg hover:shadow-xl transition-shadow"
            >
              {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              {isUploading ? 'Embedding Chunks...' : 'Upload PDF / MD / TXT'}
            </motion.label>
          </div>
        </aside>

        {/* Right Area: 3D Knowledge Graph + RAG Chat (Split, Graph-Only, or Chat-Only) */}
        {(activeTab === 'split' || activeTab === 'graph') && (
          <section className="glass-panel flex-1 h-full min-h-0 flex flex-col p-3 relative overflow-hidden">
            <KnowledgeGraph3D
              nodes={graphData.nodes}
              links={graphData.links}
              activeSourceKeys={activeSourceKeys}
            />
          </section>
        )}

        {(activeTab === 'split' || activeTab === 'chat') && (
          <section className="glass-panel flex-1 h-full min-h-0 flex flex-col p-5 relative overflow-hidden">
            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pr-3 custom-scrollbar"
            >
              {messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-white/10' : 'bg-[#8a2be2]'
                    }`}
                  >
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div
                    className={`p-4 max-w-[85%] border ${
                      msg.role === 'user'
                        ? 'bg-white/5 border-white/5 rounded-2xl rounded-tr-none'
                        : 'bg-[#8a2be2]/10 border-[#8a2be2]/20 rounded-2xl rounded-tl-none'
                    }`}
                  >
                    <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 max-w-none text-[15px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>

                    {/* Retrieval Metadata & Citations Footer */}
                    {msg.role === 'bot' && (msg.latency_ms !== undefined || (msg.sources && msg.sources.length > 0)) && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {msg.latency_ms !== undefined && (
                            <span className="flex items-center gap-1 text-emerald-400 font-mono">
                              <Zap size={12} /> {msg.latency_ms} ms ChromaDB lookup
                            </span>
                          )}
                          {msg.sources && msg.sources.length > 0 && (
                            <span className="flex items-center gap-1 text-purple-300">
                              <BookOpen size={12} /> {msg.sources.length} context chunks cited
                            </span>
                          )}
                        </div>

                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {msg.sources.map((src, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setActiveSourceKeys([`${src.source}::${src.chunk_index}`])
                                }
                                title={`${src.snippet} (Click to highlight in 3D Graph)`}
                                className="text-[11px] bg-black/40 hover:bg-purple-500/30 border border-white/10 hover:border-purple-400/50 px-2.5 py-1 rounded-lg text-gray-200 transition-colors cursor-pointer"
                              >
                                🎯 {src.source} #chunk-{src.chunk_index + 1} ({src.similarity}%)
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#8a2be2]">
                    <Bot size={20} />
                  </div>
                  <div className="p-4 flex items-center gap-1.5">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                    />
                  </div>
                </motion.div>
              )}
              </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="shrink-0 mt-4 flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your uploaded documents..."
                className="flex-1 px-5 py-4 rounded-xl bg-black/20 border border-white/10 text-white font-sans text-base outline-none focus:border-[#8a2be2]/50 transition-colors"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isTyping}
                className={`px-6 rounded-xl bg-gradient-to-r from-[#8a2be2] to-[#4169e1] text-white flex items-center justify-center cursor-pointer ${
                  isTyping ? 'opacity-70' : 'opacity-100'
                } shadow-lg hover:shadow-xl transition-shadow`}
              >
                <Send size={20} />
              </motion.button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
