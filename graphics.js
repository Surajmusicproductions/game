// graphics.js
// Main graphics skeleton for forest runner
// Uses module import of Three.js from CDN for quick testing.
// For production/APK bundle these files locally instead.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';

////////////////////////////////////////////////////////////////////////////////
// Helper: simple FPS counter (very small)
////////////////////////////////////////////////////////////////////////////////
export class FPSMeter {
  constructor(elemId='fps') {
    this.el = document.getElementById(elemId);
    this._t = performance.now();
    this._frames = 0;
  }
  frame() {
    this._frames++;
    const now = performance.now();
    if (now - this._t >= 500) {
      const fps = Math.round((this._frames * 1000) / (now - this._t));
      if (this.el) this.el.innerText = fps;
      this._frames = 0;
      this._t = now;
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Graphics classes skeleton
////////////////////////////////////////////////////////////////////////////////

// 1) SkyDome — creates a simple colored sky or gradient dome
export class SkyDome {
  constructor({radius=800, colorTop=0xFFF8E7, colorBottom=0x87CEEB} = {}) {
    this.radius = radius;
    this.colorTop = colorTop;
    this.colorBottom = colorBottom;
    this.mesh = null;
    this.create();
  }
  create() {
    const geo = new THREE.SphereGeometry(this.radius, 24, 16);
    // A simple color is used, but a custom shader could create a gradient.
    const mat = new THREE.MeshBasicMaterial({ color: this.colorTop, side: THREE.BackSide, fog: false });
    this.mesh = new THREE.Mesh(geo, mat);
  }
  addTo(scene) { scene.add(this.mesh); }
  update() {} // no-op (could animate sun color)
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

 // 2) SunLight — directional sun + simple shadow setup
export class SunLight {
  constructor({color=0xFFE4B5, intensity=1.8, position=new THREE.Vector3(-150, 80, 100)} = {}) {
    this.light = new THREE.DirectionalLight(color, intensity);
    this.light.position.copy(position);
    this.light.castShadow = true;
    // basic shadow params (tweak per-device)
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 500;
    this.light.shadow.camera.left = -100;
    this.light.shadow.camera.right = 100;
    this.light.shadow.camera.top = 100;
    this.light.shadow.camera.bottom = -100;
  }
  addTo(scene) { scene.add(this.light, this.light.target); }
  update(){}
  dispose(){ /* nothing special */ }
}

 // 3) GroundChunk — flat ground plane, supports lightmap placeholder
export class GroundChunk {
  constructor({size=50, material=null} = {}) {
    this.size = size;
    this.group = new THREE.Group();
    this.material = material || new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness:0.9 });
    this.create();
  }
  create() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.size, this.size, 1, 1), this.material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }
  addTo(scene) { scene.add(this.group); }
  update() {}
  setPosition(x,y,z) { this.group.position.set(x,y,z); }
  dispose() { this.group.traverse((o)=>{ if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); } }); }
}

 // 4) ProceduralTree — stylized low-poly tree created in code
export class ProceduralTree {
  constructor({x=0,z=0,isComplex=false} = {}) {
    this.group = new THREE.Group();
    this.params = {x,z,isComplex};
    this.materials = this.getMaterials();
    this.create();
    this.group.position.set(x,0,z);
  }

  getMaterials() {
    const type = Math.random();
    if (type < 0.6) return { trunk: new THREE.MeshStandardMaterial({ color: 0x8B4513 }), leaves: new THREE.MeshStandardMaterial({ color: 0x228B22 }) };
    if (type < 0.85) return { trunk: new THREE.MeshStandardMaterial({ color: 0x6e472d }), leaves: new THREE.MeshStandardMaterial({ color: 0xCD5C5C }) };
    return { trunk: new THREE.MeshStandardMaterial({ color: 0xF5F5DC }), leaves: new THREE.MeshStandardMaterial({ color: 0x9ACD32 }) };
  }

  create(){
    const h = 10 + Math.random()*8;
    const trunkRadius = (this.params.isComplex ? 1.5 : 1) * (Math.random() * 0.3 + 0.4);
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, h, 6);
    const trunk = new THREE.Mesh(trunkGeo, this.materials.trunk);
    trunk.castShadow = true; trunk.receiveShadow = true;
    trunk.position.y = h/2;
    trunk.userData = { isObstacle: true, hitbox: new THREE.Box3().setFromObject(trunk) };
    this.group.add(trunk);

    const leafGeo = new THREE.IcosahedronGeometry(Math.random() * 2 + (this.params.isComplex ? 4 : 3), 0);
    const leaves = new THREE.Mesh(leafGeo, this.materials.leaves);
    leaves.position.y = h;
    leaves.castShadow = true;
    this.group.add(leaves);

     if (this.params.isComplex && Math.random() > 0.5) {
        const branchGeo = new THREE.CylinderGeometry(0.2, 0.3, 5, 5);
        const branch = new THREE.Mesh(branchGeo, this.materials.trunk);
        branch.position.set(trunkRadius, h * 0.6, 0);
        branch.rotation.z = Math.PI / 4;
        branch.castShadow = true;
        branch.userData = { isObstacle: true, hitbox: new THREE.Box3().setFromObject(branch) };
        this.group.add(branch);
    }
  }
  addTo(scene){ scene.add(this.group); }
  update(delta, time) {
    // Sway leaves by adjusting rotation
    this.group.children.slice(1).forEach((leaf,i)=>{
      leaf.rotation.y = Math.sin(time*0.8 + i*0.5)*0.08;
      leaf.rotation.x = Math.cos(time*0.6 + i*0.5)*0.05;
    });
  }
  dispose(){ this.group.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); } }); }
}

 // 5) ProceduralBush / SmallRock — cheap props
export class ProceduralBush {
  constructor({x=0,z=0}={}) {
    this.mesh = null;
    this.create();
    if(this.mesh) this.mesh.position.set(x,0,z);
  }
  create(){
    const size = 0.5 + Math.random()*1.5;
    const geo = new THREE.IcosahedronGeometry(size,0);
    const mat = new THREE.MeshStandardMaterial({ color:0x6B8E23 });
    this.mesh = new THREE.Mesh(geo,mat);
    this.mesh.castShadow = true;
    this.mesh.position.y = size / 2;
  }
  addTo(scene){ scene.add(this.mesh); }
  update(){}
  dispose(){ this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export class SmallRock {
  constructor({x=0,z=0}={}) {
    this.mesh = null; this.create();
    if(this.mesh) this.mesh.position.set(x,0,z);
  }
  create(){
    const size = 0.2 + Math.random()*0.5;
    const geo = new THREE.IcosahedronGeometry(size,0);
    const mat = new THREE.MeshStandardMaterial({ color:0x696969, roughness:0.8 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.position.y = size / 2;
  }
  addTo(scene){ scene.add(this.mesh); }
  update(){}
  dispose(){ this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

 // 6) InstancedGrass — demonstrates InstancedMesh usage
export class InstancedGrass {
  constructor({count=250, radius=12, parentGroup=null}={}) {
    this.count = count; this.radius = radius;
    this.mesh = null;
    this.create();
    if (parentGroup) {
        parentGroup.add(this.mesh);
    }
  }
  create(){
    const geo = new THREE.PlaneGeometry(0.18,0.8);
    geo.translate(0,0.4,0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f5d2b, side: THREE.DoubleSide, roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.castShadow = true;
    const dummy = new THREE.Object3D();
    for (let i=0;i<this.count;i++){
      const a = Math.random()*Math.PI*2;
      const r = Math.random()*this.radius;
      dummy.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
      dummy.rotation.y = Math.random()*Math.PI;
      const s = 0.7 + Math.random()*0.8;
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
  }
  addTo(scene){ scene.add(this.mesh); }
  update(delta, time){ /* could add per-instance wind in shader */ }
  dispose(){ this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

 // 7) AdaptiveQuality — monitors FPS and toggles features
export class AdaptiveQuality {
  constructor({renderer, post, scene}) {
    this.renderer = renderer;
    this.post = post;
    this.scene = scene;
    this.highQuality = true;
  }
  update() {
    const fps = parseInt(document.getElementById('fps')?.innerText||'60',10);
    if (fps < 35 && this.highQuality) {
      this.highQuality = false;
      this.applyLowQuality();
    } else if (fps > 50 && !this.highQuality) {
      this.highQuality = true;
      this.applyHighQuality();
    }
  }
  applyLowQuality(){
    console.log("Applying Low Quality Settings");
    this.renderer.shadowMap.enabled = false;
    this.post.bloomPass.enabled = false; // Disable bloom
    this.renderer.setPixelRatio(1); // Lower pixel ratio
    if(this.scene.fog) {
        this.scene.fog.far = 150;
    }
  }
  applyHighQuality(){
    console.log("Applying High Quality Settings");
    this.renderer.shadowMap.enabled = true;
    this.post.bloomPass.enabled = true; // Enable bloom
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    if(this.scene.fog) {
        this.scene.fog.far = 250;
    }
  }
}

// FIXED: Removed extra closing brace from the end of the file.
