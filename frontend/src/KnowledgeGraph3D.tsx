import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Sparkles, RotateCcw, Gauge, Layers, FileText, Cpu, Compass, CheckCircle2 } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  topic?: string;
  type: 'document' | 'chunk';
  source: string;
  chunk_index?: number;
  preview: string;
  x: number;
  y: number;
  z: number;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

interface KnowledgeGraph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  activeSourceKeys?: string[];
}

/**
 * Automatically summarizes a chunk's text into a short 2-4 word human-readable topic
 * so you immediately know what each 3D node represents without guessing.
 */
function summarizeChunkTopic(preview: string, chunkIdx: number): string {
  if (!preview) return `Chunk #${chunkIdx + 1}`;

  let cleaned = preview
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstSpace = cleaned.indexOf(' ');
  if (firstSpace > 0 && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.slice(firstSpace + 1).trim();
  }

  cleaned = cleaned
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/\+?\d[\d\s-]{7,}\d/g, '')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'using', 'into', 'over',
    'through', 'board', 'secondary', 'madhya', 'pradesh', 'india', 'jabalpur',
    'github', 'linkedin', 'trained', 'developed', 'built', 'taking', 'models',
  ]);

  const words = cleaned
    .split(/[\s|,.:;()/-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()) && !/^\d+$/.test(w));

  const picked: string[] = [];
  for (const w of words) {
    if (!picked.some((p) => p.toLowerCase() === w.toLowerCase())) {
      picked.push(w);
    }
    if (picked.length >= 3) break;
  }

  const summary = picked.length > 0 ? picked.join(' • ') : cleaned.slice(0, 24);
  return `#${chunkIdx + 1}: ${summary}`;
}

export const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = ({
  nodes,
  links,
  activeSourceKeys = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [fps, setFps] = useState<number>(60);
  const [benchmark5k, setBenchmark5k] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const coreNodes: GraphNode[] = useMemo(() => {
    if (nodes.length > 0) {
      const docCount = nodes.filter((n) => n.type === 'document').length;
      const chunkItems = nodes.filter((n) => n.type === 'chunk');
      let chunkIdxCounter = 0;

      return nodes.map((n) => {
        if (n.type === 'document') {
          const shortDoc = n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label;
          if (docCount === 1) {
            return { ...n, topic: shortDoc, x: 0, y: 0, z: 0 };
          }
          return { ...n, topic: shortDoc };
        }
        const i = chunkIdxCounter++;
        const total = Math.max(1, chunkItems.length);
        const angle = (i / total) * Math.PI * 2;
        const elevation = ((i % 3) - 1) * 3.4;
        const radius = 9.0;
        const cIdx = n.chunk_index ?? i;
        return {
          ...n,
          topic: summarizeChunkTopic(n.preview, cIdx),
          x: Number((Math.cos(angle) * radius).toFixed(2)),
          y: Number(elevation.toFixed(2)),
          z: Number((Math.sin(angle) * radius).toFixed(2)),
        };
      });
    }

    return [
      {
        id: 'doc::Demo_RAG_Knowledge.md',
        label: 'Demo_RAG_Knowledge.md',
        topic: 'Demo_RAG_Knowledge.md',
        type: 'document',
        source: 'Demo_RAG_Knowledge.md',
        preview: 'Upload a PDF, MD, or TXT file in the left sidebar to inspect your own document chunks in 3D.',
        x: 0,
        y: 0,
        z: 0,
      },
      {
        id: 'demo_chunk_1',
        label: 'Chunk #1 (Vector Indexing)',
        topic: '#1: ChromaDB • 384-Dim Vectors',
        type: 'chunk',
        source: 'Demo_RAG_Knowledge.md',
        chunk_index: 0,
        preview: 'ChromaDB indexes each text paragraph as a 384-dimensional dense vector using all-MiniLM-L6-v2.',
        x: 8.5,
        y: 2.5,
        z: 0,
      },
      {
        id: 'demo_chunk_2',
        label: 'Chunk #2 (HNSW Search)',
        topic: '#2: Sub-150ms HNSW Search',
        type: 'chunk',
        source: 'Demo_RAG_Knowledge.md',
        chunk_index: 1,
        preview: 'Sub-150ms cosine similarity search retrieves the top-K relevant context chunks for Llama 3 synthesis.',
        x: -4.5,
        y: -2.5,
        z: 7.5,
      },
      {
        id: 'demo_chunk_3',
        label: 'Chunk #3 (Three.js LOD)',
        topic: '#3: Three.js • Instanced LOD',
        type: 'chunk',
        source: 'Demo_RAG_Knowledge.md',
        chunk_index: 2,
        preview: 'THREE.InstancedMesh batches 5,000+ low-poly icosahedron nodes into a single GPU draw call at 60 FPS.',
        x: -4.5,
        y: 2.0,
        z: -7.5,
      },
    ];
  }, [nodes]);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (coreNodes.length > 0) {
      const firstChunk = coreNodes.find((n) => n.type === 'chunk') || coreNodes[0];
      setSelectedNode((prev) => {
        if (prev) {
          const updated = coreNodes.find((n) => n.id === prev.id);
          if (updated) return updated;
        }
        return firstChunk;
      });
    }
  }, [coreNodes]);

  useEffect(() => {
    if (activeSourceKeys.length > 0) {
      const topKey = activeSourceKeys[0];
      const matched = coreNodes.find(
        (n) => n.type === 'chunk' && `${n.source}::${n.chunk_index}` === topKey
      );
      if (matched) {
        setSelectedNode(matched);
      }
    }
  }, [activeSourceKeys, coreNodes]);

  const autoRotateRef = useRef<boolean>(true);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    hoveredNodeIdRef.current = hoveredNodeId;
  }, [hoveredNodeId]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNode?.id || null;
  }, [selectedNode]);

  useEffect(() => {
    activeKeysRef.current = new Set(activeSourceKeys);
  }, [activeSourceKeys]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 400);
    const height = Math.max(container.clientHeight, 300);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06050c, 0.01);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x06050c, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0xa855f7, 4.5, 160);
    keyLight.position.set(18, 25, 22);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 4.0, 160);
    rimLight.position.set(-20, -14, -18);
    scene.add(rimLight);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const gridHelper = new THREE.GridHelper(50, 25, 0x8a2be2, 0x1e1b4b);
    gridHelper.position.y = -8.5;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.4;
    worldGroup.add(gridHelper);

    const orbitGeo = new THREE.TorusGeometry(9.0, 0.04, 16, 100);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.3,
    });
    const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRing.rotation.x = Math.PI / 2;
    worldGroup.add(orbitRing);

    const interactiveMeshes: { mesh: THREE.Mesh; halo: THREE.Mesh; node: GraphNode }[] = [];

    coreNodes.forEach((n) => {
      const isDoc = n.type === 'document';
      const geom = isDoc
        ? new THREE.SphereGeometry(1.55, 32, 32)
        : new THREE.IcosahedronGeometry(1.05, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: isDoc ? 0xc084fc : 0x38bdf8,
        emissive: isDoc ? 0x7e22ce : 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.25,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(n.x, n.y, n.z);
      worldGroup.add(mesh);

      const haloGeo = new THREE.IcosahedronGeometry(isDoc ? 2.2 : 1.5, 1);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isDoc ? 0xe879f9 : 0x7dd3fc,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      mesh.add(halo);

      interactiveMeshes.push({ mesh, halo, node: n });
    });

    const pulseParticles: {
      mesh: THREE.Mesh;
      start: THREE.Vector3;
      end: THREE.Vector3;
      speed: number;
      offset: number;
    }[] = [];
    const nodeById = new Map<string, GraphNode>();
    coreNodes.forEach((n) => nodeById.set(n.id, n));

    const activeLinks: GraphLink[] =
      links.length > 0
        ? links
        : coreNodes
            .filter((n) => n.type === 'chunk')
            .map((n) => ({
              source: coreNodes[0].id,
              target: n.id,
              strength: 0.9,
            }));

    activeLinks.forEach((l, idx) => {
      const s = nodeById.get(l.source);
      const t = nodeById.get(l.target);
      if (!s || !t) return;

      const startVec = new THREE.Vector3(s.x, s.y, s.z);
      const endVec = new THREE.Vector3(t.x, t.y, t.z);

      const direction = new THREE.Vector3().subVectors(endVec, startVec);
      const length = direction.length();
      const tubeGeo = new THREE.CylinderGeometry(0.08, 0.08, length, 8);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.7,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.copy(startVec).add(endVec).multiplyScalar(0.5);
      tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      worldGroup.add(tube);

      const pulseGeo = new THREE.SphereGeometry(0.28, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xf0abfc });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      worldGroup.add(pulseMesh);
      pulseParticles.push({
        mesh: pulseMesh,
        start: startVec,
        end: endVec,
        speed: 0.55 + (idx % 4) * 0.12,
        offset: idx * 0.2,
      });
    });

    let latentInstanced: THREE.InstancedMesh | null = null;
    const benchmarkNodes: GraphNode[] = [];

    if (benchmark5k) {
      const latentCount = 5000;
      const latentGeo = new THREE.IcosahedronGeometry(0.28, 0);
      const latentMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x312e81,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      });
      latentInstanced = new THREE.InstancedMesh(latentGeo, latentMat, latentCount);
      const dummy = new THREE.Object3D();

      for (let i = 0; i < latentCount; i++) {
        const r = 13 + ((i * 37) % 24);
        const theta = i * 2.39996;
        const phi = Math.acos(1 - (2 * (i + 0.5)) / latentCount);
        const lx = Number((r * Math.sin(phi) * Math.cos(theta)).toFixed(2));
        const ly = Number((r * Math.cos(phi) * 0.65).toFixed(2));
        const lz = Number((r * Math.sin(phi) * Math.sin(theta)).toFixed(2));

        dummy.position.set(lx, ly, lz);
        dummy.updateMatrix();
        latentInstanced.setMatrixAt(i, dummy.matrix);

        benchmarkNodes.push({
          id: `lod_node_${i}`,
          label: `Synthetic Vector #${i + 1}`,
          topic: `LOD Vector #${i + 1}`,
          type: 'chunk',
          source: 'LOD_Stress_Test_5000',
          chunk_index: i,
          preview: `Simulated 384-dim vector node #${i + 1} rendered via THREE.InstancedMesh (single GPU draw call at 60 FPS).`,
          x: lx,
          y: ly,
          z: lz,
        });
      }
      latentInstanced.instanceMatrix.needsUpdate = true;
      worldGroup.add(latentInstanced);
    }

    let isDragging = false;
    let dragDistance = 0;
    let prevX = 0;
    let prevY = 0;
    let azimuth = 0.5;
    let elevation = 0.32;
    let targetRadius = benchmark5k ? 42 : 21;
    let currentRadius = targetRadius;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        prevX = e.clientX;
        prevY = e.clientY;
        azimuth -= dx * 0.007;
        elevation = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, elevation + dy * 0.007));
        return;
      }

      raycaster.setFromCamera(mouse, camera);
      const targets = interactiveMeshes.map((item) => item.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const found = interactiveMeshes.find((item) => item.mesh === hits[0].object);
        const nextHoverId = found ? found.node.id : null;
        if (hoveredNodeIdRef.current !== nextHoverId) {
          setHoveredNodeId(nextHoverId);
        }
        renderer.domElement.style.cursor = 'pointer';
      } else {
        if (hoveredNodeIdRef.current !== null) {
          setHoveredNodeId(null);
        }
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const wasClick = dragDistance < 6;
      isDragging = false;

      if (!wasClick) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const targets = interactiveMeshes.map((item) => item.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const found = interactiveMeshes.find((item) => item.mesh === hits[0].object);
        if (found) {
          setSelectedNode(found.node);
          return;
        }
      }

      if (latentInstanced) {
        const instHits = raycaster.intersectObject(latentInstanced);
        if (instHits.length > 0 && instHits[0].instanceId !== undefined) {
          const hitNode = benchmarkNodes[instHits[0].instanceId];
          if (hitNode) {
            setSelectedNode(hitNode);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      targetRadius = Math.max(10, Math.min(85, targetRadius + e.deltaY * 0.025));
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const updateSize = () => {
      requestAnimationFrame(() => {
        if (!container) return;
        const w = Math.max(container.clientWidth, 320);
        const h = Math.max(container.clientHeight, 260);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    window.addEventListener('resize', updateSize);

    let frameCount = 0;
    let lastFpsTime = performance.now();
    let animId = 0;
    const projVec = new THREE.Vector3();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        const currentFps = Math.min(60, Math.round((frameCount * 1000) / (now - lastFpsTime)));
        setFps((prev) => (prev === currentFps ? prev : currentFps));
        frameCount = 0;
        lastFpsTime = now;
      }

      const t = now * 0.001;

      if (autoRotateRef.current && !isDragging && !hoveredNodeIdRef.current) {
        azimuth += 0.003;
      }

      interactiveMeshes.forEach(({ mesh, halo, node }) => {
        const isSelected = selectedNodeIdRef.current === node.id;
        const isHovered = hoveredNodeIdRef.current === node.id;
        const isCited =
          node.type === 'chunk' && activeKeysRef.current.has(`${node.source}::${node.chunk_index}`);
        const targetScale = isSelected ? 1.38 : isHovered || isCited ? 1.22 : 1.0;
        mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        halo.rotation.y = t * (isSelected || isCited ? 1.2 : 0.4);
        halo.rotation.x = t * 0.3;
        (halo.material as THREE.MeshBasicMaterial).color.setHex(
          isSelected
            ? 0xfacc15
            : isCited
            ? 0x34d399
            : node.type === 'document'
            ? 0xe879f9
            : 0x7dd3fc
        );
        (halo.material as THREE.MeshBasicMaterial).opacity = isSelected || isCited ? 0.95 : 0.45;
      });

      pulseParticles.forEach((p) => {
        const progress = (t * p.speed + p.offset) % 1;
        p.mesh.position.lerpVectors(p.start, p.end, progress);
      });

      currentRadius += (targetRadius - currentRadius) * 0.12;
      camera.position.x = currentRadius * Math.cos(elevation) * Math.sin(azimuth);
      camera.position.y = currentRadius * Math.sin(elevation);
      camera.position.z = currentRadius * Math.cos(elevation) * Math.cos(azimuth);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      renderer.render(scene, camera);

      // Update floating HTML label positions directly via DOM refs (ZERO React re-renders!)
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      coreNodes.forEach((n) => {
        const btn = labelRefs.current.get(n.id);
        if (!btn) return;
        projVec.set(n.x, n.y + (n.type === 'document' ? 2.1 : 1.5), n.z);
        projVec.project(camera);
        const isVis =
          projVec.z < 1 &&
          projVec.x >= -0.94 &&
          projVec.x <= 0.94 &&
          projVec.y >= -0.88 &&
          projVec.y <= 0.88;
        if (isVis) {
          const sx = Math.round((projVec.x * 0.5 + 0.5) * w);
          const sy = Math.round((-projVec.y * 0.5 + 0.5) * h);
          btn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        } else {
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
        }
      });
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domElem.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', updateSize);
      renderer.dispose();
    };
  }, [coreNodes, links, benchmark5k]);

  const docCount = coreNodes.filter((n) => n.type === 'document').length;
  const chunkCount = coreNodes.filter((n) => n.type === 'chunk').length;

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden bg-[#06050c] border border-purple-500/30 shadow-2xl">
      {/* Top HUD Bar */}
      <div className="shrink-0 flex flex-wrap justify-between items-center gap-2 px-3.5 py-2.5 bg-black/80 border-b border-white/10 z-20">
        <div className="flex items-center gap-2">
          <Gauge size={15} className="text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400 font-bold">{fps} FPS</span>
          <span className="text-white/20">|</span>
          <Layers size={14} className="text-purple-400" />
          <span className="text-xs text-gray-200 font-medium">
            {benchmark5k
              ? `5,000 LOD Vectors + ${coreNodes.length} Core Nodes`
              : `${docCount} Doc Hub • ${chunkCount} Semantic Chunks`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBenchmark5k((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              benchmark5k
                ? 'bg-purple-600/70 border-purple-400 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 border-purple-500/40 text-purple-200 hover:bg-purple-500/20'
            }`}
          >
            <Sparkles size={13} className={benchmark5k ? 'text-yellow-300' : 'text-purple-400'} />
            {benchmark5k ? 'Exit 5,000-Node Stress Test' : '5,000-Node LOD Stress Test'}
          </button>

          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            {autoRotate ? 'Pause Spin' : 'Auto Spin'}
          </button>
        </div>
      </div>

      {/* Topic-Labeled Node Selector Bar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-black/50 border-b border-white/10 overflow-x-auto z-20 custom-scrollbar">
        <span className="text-[11px] text-gray-400 shrink-0 mr-1">Topics:</span>
        {coreNodes.map((n) => {
          const isSel = selectedNode?.id === n.id;
          const isCited =
            n.type === 'chunk' && activeSourceKeys.includes(`${n.source}::${n.chunk_index}`);
          return (
            <button
              key={n.id}
              onClick={() => setSelectedNode(n)}
              onMouseEnter={() => setHoveredNodeId(n.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              title={n.preview}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isSel
                  ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-semibold shadow'
                  : isCited
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                  : n.type === 'document'
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-200 hover:bg-purple-500/30'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-200 hover:bg-sky-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSel
                    ? 'bg-amber-400'
                    : isCited
                    ? 'bg-emerald-400'
                    : n.type === 'document'
                    ? 'bg-purple-400'
                    : 'bg-sky-400'
                }`}
              />
              {n.type === 'document' ? `📄 ${n.topic}` : `🧩 ${n.topic}`}
            </button>
          );
        })}
      </div>

      {/* 3D Viewport + Hardware-Accelerated DOM-Ref Labels (0 React Re-Renders) */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {coreNodes.map((node) => {
            const isSel = selectedNode?.id === node.id;
            const isCited =
              node.type === 'chunk' &&
              activeSourceKeys.includes(`${node.source}::${node.chunk_index}`);
            return (
              <button
                key={node.id}
                ref={(el) => {
                  if (el) labelRefs.current.set(node.id, el);
                  else labelRefs.current.delete(node.id);
                }}
                onClick={() => setSelectedNode(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                title={node.preview}
                style={{ opacity: 0, willChange: 'transform' }}
                className={` absolute top-0 left-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border backdrop-blur-md transition-colors cursor-pointer whitespace-nowrap shadow-lg flex items-center gap-1 ${
                  isSel
                    ? 'bg-amber-500/30 border-amber-300 text-white font-bold ring-2 ring-amber-400/50'
                    : isCited
                    ? 'bg-emerald-900/90 border-emerald-400 text-emerald-100 font-semibold ring-1 ring-emerald-400/50'
                    : node.type === 'document'
                    ? 'bg-purple-950/85 border-purple-400/70 text-purple-100 hover:bg-purple-800/90'
                    : 'bg-slate-900/85 border-sky-400/60 text-sky-100 hover:bg-sky-900/90'
                }`}
              >
                {isCited && <CheckCircle2 size={11} className="text-emerald-300 shrink-0" />}
                {node.type === 'document' ? `📄 ${node.topic}` : `🧩 ${node.topic}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Persistent Bottom Node Inspector Card */}
      {selectedNode && (
        <div className="shrink-0 bg-black/90 border-t border-purple-500/40 p-3.5 z-20 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                  selectedNode.type === 'document'
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                    : 'bg-sky-500/30 text-sky-200 border border-sky-400/40'
                }`}
              >
                {selectedNode.type === 'document'
                  ? 'Document Hub'
                  : `Chunk #${(selectedNode.chunk_index ?? 0) + 1}`}
              </span>
              <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" />
                {selectedNode.topic || selectedNode.label}
              </h4>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1 text-emerald-300">
                <Cpu size={12} /> 384-dim MiniLM-L6-v2
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <Compass size={12} /> 3D({selectedNode.x}, {selectedNode.y}, {selectedNode.z})
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-gray-200 leading-relaxed max-h-20 overflow-y-auto custom-scrollbar font-sans">
            <span className="text-purple-300 font-semibold mr-1.5">Full Chunk Text in ChromaDB:</span>
            "{selectedNode.preview}"
          </div>
        </div>
      )}
    </div>
  );
};
