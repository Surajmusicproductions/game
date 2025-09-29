// --- NEW: TEXTURE LOADING ---
const textureLoader = new THREE.TextureLoader();
const buildingMaterials = [
    new THREE.MeshStandardMaterial({ map: textureLoader.load('built1.jpg') }),
    new THREE.MeshStandardMaterial({ map: textureLoader.load('built2.jpg') }),
    new THREE.MeshStandardMaterial({ map: textureLoader.load('built3.jpg') }),
    new THREE.MeshStandardMaterial({ map: textureLoader.load('built4.jpg') })
];
