import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { X, Info, RotateCcw, Sun } from 'lucide-react';

export default function ModelViewer({ model, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [modelColor, setModelColor] = useState('#9ca3af'); // State to control dynamic model color
  const [lightIntensity, setLightIntensity] = useState(1.0); // State to control lighting intensity
  
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const currentMeshRef = useRef(null);

  // References for dynamic light updating
  const ambientLightRef = useRef(null);
  const dirLight1Ref = useRef(null);
  const dirLight2Ref = useRef(null);

  const presets = [
    { name: 'Cinza', value: '#9ca3af' },
    { name: 'Vermelho', value: '#ef4444' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#10b981' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Amarelo', value: '#facc15' },
    { name: 'Preto', value: '#1e293b' },
    { name: 'Branco', value: '#f8fafc' },
    { name: 'Dourado', value: '#d97706' },
  ];

  // Helper to get extension
  const isStl = model.filename.toLowerCase().endsWith('.stl');
  const fileUrl = model.filepath; // Relative path handled by Vite Proxy

  // 3D Scene Initialization and Model Loading Effect
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Clean light grey (slate-100)
    sceneRef.current = scene;

    // 2. Initialize Camera
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // 3. Initialize Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Initialize Controls (Standard OrbitControls with rotation enabled)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 1.5; // Avoid going below ground too much
    controlsRef.current = controls;

    // 5. Add Grid and Lights
    const gridHelper = new THREE.GridHelper(200, 50, 0x4f46e5, 0xcbd5e1);
    gridHelper.position.y = -0.01; // Slightly below origin to avoid z-fighting
    scene.add(gridHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8 * lightIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2 * lightIntensity);
    dirLight1.position.set(100, 120, 50);
    dirLight1.castShadow = true;
    scene.add(dirLight1);
    dirLight1Ref.current = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0xa5b4fc, 1.2 * lightIntensity); // Subtle bluish light
    dirLight2.position.set(-100, -50, -50);
    scene.add(dirLight2);
    dirLight2Ref.current = dirLight2;

    // 6. Loader setup
    const manager = new THREE.LoadingManager();
    manager.onStart = () => {
      setLoading(true);
      setProgress(0);
    };
    manager.onLoad = () => {
      setLoading(false);
    };

    const handleModelLoaded = (loadedObject) => {
      currentMeshRef.current = loadedObject;

      // Rotate model so that Z-axis (up in CAD/3D printing) aligns with Y-axis (up in Three.js)
      loadedObject.rotateX(-Math.PI / 2);

      scene.add(loadedObject);

      // Compute bounding box to center camera and scale correctly
      const box = new THREE.Box3().setFromObject(loadedObject);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Center model
      loadedObject.position.x += (loadedObject.position.x - center.x);
      // Sit model on the grid
      loadedObject.position.y += (loadedObject.position.y - box.min.y);
      loadedObject.position.z += (loadedObject.position.z - center.z);

      // Adjust camera distance based on model size
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.8; // Add zoom margin

      camera.position.set(cameraZ * 0.8, cameraZ * 0.8, cameraZ * 0.8);
      controls.target.set(0, maxDim / 3, 0);
      controls.update();
      setLoading(false);
    };

    if (isStl) {
      const loader = new STLLoader(manager);
      loader.load(
        fileUrl,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(modelColor), // Initialize with current color state
            roughness: 0.4,
            metalness: 0.4,
            flatShading: false,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          const group = new THREE.Group();
          group.add(mesh);
          handleModelLoaded(group);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('Error loading STL:', err);
          setError('Falha ao processar o arquivo STL. Certifique-se de que o arquivo não está corrompido.');
          setLoading(false);
        }
      );
    } else {
      // 3MF Loading
      const loader = new ThreeMFLoader(manager);
      loader.load(
        fileUrl,
        (group) => {
          group.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Standardize to selected color for uniform visualization
              child.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(modelColor), // Initialize with current color state
                roughness: 0.4,
                metalness: 0.4,
                side: THREE.DoubleSide
              });
            }
          });
          handleModelLoaded(group);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('Error loading 3MF:', err);
          setError('Falha ao processar o arquivo 3MF. Verifique a compatibilidade ou se o arquivo está corrompido.');
          setLoading(false);
        }
      );
    }

    // 7. Animation Loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
      // Dispose geometry/materials
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      });
    };
  }, [fileUrl, isStl]);

  // Effect to update color in memory when user changes color state
  useEffect(() => {
    if (!currentMeshRef.current) return;
    
    currentMeshRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        const materialArray = Array.isArray(child.material) ? child.material : [child.material];
        materialArray.forEach((mat) => {
          mat.color.set(modelColor);
        });
      }
    });
  }, [modelColor]);

  // Effect to update light intensity dynamically in memory
  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 1.8 * lightIntensity;
    }
    if (dirLight1Ref.current) {
      dirLight1Ref.current.intensity = 1.2 * lightIntensity;
    }
    if (dirLight2Ref.current) {
      dirLight2Ref.current.intensity = 1.2 * lightIntensity;
    }
  }, [lightIntensity]);

  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current || !currentMeshRef.current) return;
    
    const box = new THREE.Box3().setFromObject(currentMeshRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
    
    cameraRef.current.position.set(cameraZ * 0.8, cameraZ * 0.8, cameraZ * 0.8);
    controlsRef.current.target.set(0, maxDim / 3, 0);
    controlsRef.current.update();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <div className="header-title-section">
            <h3 className="viewer-title">{model.name}</h3>
            <p className="header-subtitle" style={{ fontSize: '0.8rem' }}>
              Pasta: {model.folder} • {isStl ? 'Formato STL' : 'Formato 3MF'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-close" onClick={resetView} title="Resetar Câmera">
              <RotateCcw size={16} />
            </button>
            <button className="btn-close" onClick={onClose} title="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="viewer-canvas-container" ref={containerRef}>
          {/* Controls Panel (Filament color + Lighting) */}
          {!loading && !error && (
            <div className="viewer-color-panel" onClick={(e) => e.stopPropagation()}>
              <h4 className="color-panel-title">Cor do Filamento</h4>
              <div className="color-presets" style={{ marginBottom: '0.75rem' }}>
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    className={`color-preset-btn ${modelColor === preset.value ? 'active' : ''}`}
                    style={{ backgroundColor: preset.value }}
                    onClick={() => setModelColor(preset.value)}
                    title={preset.name}
                  />
                ))}
                <div className="color-picker-wrapper" title="Cor personalizada">
                  <input
                    type="color"
                    value={modelColor}
                    onChange={(e) => setModelColor(e.target.value)}
                    className="color-picker-input"
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <h4 className="color-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Sun size={12} />
                  <span>Brilho ({Math.round(lightIntensity * 100)}%)</span>
                </h4>
                <div className="lighting-control">
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={lightIntensity}
                    onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
                    className="lighting-slider"
                  />
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="viewer-loading">
              <div className="spinner"></div>
              <p className="loading-text">Carregando Modelo 3D... {progress > 0 ? `${progress}%` : ''}</p>
            </div>
          )}

          {error && (
            <div className="viewer-loading" style={{ padding: '2rem' }}>
              <div className="error-alert">
                <Info size={20} />
                <span>{error}</span>
              </div>
              <button className="btn-cancel" style={{ marginTop: '1rem' }} onClick={onClose}>
                Voltar à plataforma
              </button>
            </div>
          )}

          <div className="viewer-controls-hint">
            <Info size={12} />
            <span>Botão Esquerdo: Rotacionar | Botão Direito: Mover | Roda do Mouse: Zoom</span>
          </div>
        </div>
      </div>
    </div>
  );
}
