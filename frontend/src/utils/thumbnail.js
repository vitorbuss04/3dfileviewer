import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

export const generateThumbnailForModel = (model) => {
  return new Promise((resolve, reject) => {
    // 1. Setup offscreen WebGL renderer
    const width = 400;
    const height = 300;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space for modern bright render
    } catch (err) {
      return reject(new Error('WebGL não suportado pelo navegador para gerar thumbnails.'));
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 3.6); // Brighter ambient
    scene.add(ambientLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.4); // Softened key light
    dirLight1.position.set(80, 100, 80);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xa5b4fc, 2.4); // Stronger fill light
    dirLight2.position.set(-80, -50, -80);
    scene.add(dirLight2);

    const isStl = model.filename.toLowerCase().endsWith('.stl');
    const fileUrl = model.filepath;

    const manager = new THREE.LoadingManager();

    const handleModelLoaded = async (loadedObject) => {
      // Rotate Z-up to Y-up
      loadedObject.rotateX(-Math.PI / 2);
      scene.add(loadedObject);

      // Compute bounding box
      const box = new THREE.Box3().setFromObject(loadedObject);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Center model exactly around (0,0,0)
      loadedObject.position.sub(center);

      // Adjust camera
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      camera.position.set(cameraZ * 0.8, cameraZ * 0.8, cameraZ * 0.8);
      camera.lookAt(0, 0, 0); // Look exactly at the center of the model

      // Render frame
      renderer.render(scene, camera);

      // Get image base64
      try {
        const dataUrl = renderer.domElement.toDataURL('image/png');

        // Clean up memory
        renderer.dispose();
        scene.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
          else object.material.dispose();
        });

        // Post thumbnail to server
        const response = await fetch(`/api/models/${model.id}/thumbnail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: dataUrl }),
        });

        if (!response.ok) {
          throw new Error('Erro ao salvar a visualização gerada.');
        }

        const resData = await response.json();
        resolve({
          ...model,
          imagepath: resData.imagepath,
        });
      } catch (err) {
        reject(err);
      }
    };

    if (isStl) {
      const loader = new STLLoader(manager);
      loader.load(fileUrl, (geometry) => {
        const material = new THREE.MeshStandardMaterial({
          color: 0x9ca3af, // Slate Gray
          roughness: 0.4,
          metalness: 0.4,
          flatShading: false,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        handleModelLoaded(group);
      }, undefined, reject);
    } else {
      const loader = new ThreeMFLoader(manager);
      loader.load(fileUrl, (group) => {
        group.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x9ca3af,
              roughness: 0.4,
              metalness: 0.4,
              side: THREE.DoubleSide
            });
          }
        });
        handleModelLoaded(group);
      }, undefined, reject);
    }
  });
};
