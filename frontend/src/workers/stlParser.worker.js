import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

self.onmessage = function (e) {
  const { arrayBuffer } = e.data;
  
  try {
    const loader = new STLLoader();
    const geometry = loader.parse(arrayBuffer);
    
    // Extract position and normal attributes
    const positionAttr = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    
    // Typed arrays representing the geometric data
    const positions = positionAttr ? positionAttr.array : null;
    const normals = normalAttr ? normalAttr.array : null;
    
    // Build transfer list for zero-copy memory transfer
    const transferables = [];
    if (positions) transferables.push(positions.buffer);
    if (normals) transferables.push(normals.buffer);
    
    self.postMessage({
      success: true,
      positions,
      normals
    }, transferables);
  } catch (err) {
    self.postMessage({
      success: false,
      error: err.message
    });
  }
};
