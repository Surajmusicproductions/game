import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
    FPSMeter,
    SkyDome,
    SunLight,
    GroundChunk,
    ProceduralTree,
    ProceduralBush,
    SmallRock,
    InstancedGrass,
    AdaptiveQuality
} from './graphics-fixed.js';

class ForestRunnerGame {
    constructor() {
        // Game State and player/world setup
        this.gameRunning = false;
        this.score = 0;
        this.highScore = localStorage.getItem('forestRunnerHighScore') || 0;
        this.difficultyLevel = 0;
        this.isInvincible = false;
        this.invincibilityEndTime = 0;
        this.collisionSkipCount = 0;
        this.slowTimeActive = false;
        this.slowTimeEndTime = 0;

        this.player = { speed: 28.0, hitbox: new THREE.Box3() };
        this.isJumping = false;
        this.isCrouching = false;
        this.jumpVelocity = 0;
        this.controls = { moveLeft: false, moveRight: false };
        this.worldChunks = new Map();
        this.obstacleDensity = 1.0;
        this.START_SPEED = 28.0;
        this.ACCELERATION = 0.1;
        this.LATERAL_SPEED = 22.0;
        this.JUMP_FORCE = 15;
        this.GRAVITY = -50;
        this.NORMAL_HEIGHT = 5;
        this.CROUCH_HEIGHT = 2.5;
        this.CHUNK_SIZE = 50;
        this.RENDER_DISTANCE = 3;
        this.tempHitbox = new THREE.Box3();

        this.setupEngine();
        this.setupScene();
        this.setupUI();
        this.startGameLoop();
    }

    setupEngine() {
        this.scene = new THREE.Scene();
        const eveningColor = 0xFFA07A;
        this.scene.fog = new THREE.Fog(eveningColor, 75, 250);
        this.scene.background = new THREE.Color(eveningColor);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, this.NORMAL_HEIGHT, -10);
        this.camera.lookAt(0, this.NORMAL_HEIGHT, 0);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Post-processing
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 0.1);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
        this.post = { bloomPass };
        this.clock = new THREE.Clock();
        this.fps = new FPSMeter();
        this.adaptiveQuality = new AdaptiveQuality({ renderer: this.renderer, post: this.post, scene: this.scene });
    }

    setupScene() {
        const sky = new SkyDome({ colorTop: this.scene.background });
        sky.addTo(this.scene);
        const sun = new SunLight();
        sun.addTo(this.scene);
        this.scene.add(new THREE.AmbientLight(0xFFF8E7, 0.8));
        this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.9, metalness: 0.1 });
    }

    setupUI() {
        this.ui = {
            overlay: document.getElementById('ui-overlay'),
            title: document.getElementById('ui-title'),
            instructions: document.getElementById('ui-instructions'),
            startButton: document.getElementById('start-button'),
            gameUI: document.getElementById('game-ui'),
            score: document.getElementById('score'),
            highScore: document.getElementById('high-score'),
            collisionPerk: document.getElementById('collision-perk'),
            slowPerk: document.getElementById('slow-perk')
        };
        this.highScoreUI = this.ui.highScore;
        this.highScoreUI.innerText = `High Score: ${this.highScore}`;
        this.ui.startButton.addEventListener('click', () => {
            this.gameRunning = true;
            this.ui.overlay.classList.add('hidden');
            this.ui.gameUI.style.display = 'block';
            this.resetGame();
        });
        this.setupControls();
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'a' || e.key === 'ArrowLeft') this.controls.moveLeft = true;
            if (e.key === 'd' || e.key === 'ArrowRight') this.controls.moveRight = true;
            if (e.code === 'Space' && !this.isJumping && !this.isCrouching) {
                this.isJumping = true;
                this.jumpVelocity = this.JUMP_FORCE;
            }
            if (e.key === 'Shift' && !this.isJumping) {
                this.isCrouching = true;
                this.camera.position.y = this.CROUCH_HEIGHT;
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'a' || e.key === 'ArrowLeft') this.controls.moveLeft = false;
            if (e.key === 'd' || e.key === 'ArrowRight') this.controls.moveRight = false;
            if (e.key === 'Shift') {
                this.isCrouching = false;
                if (!this.isJumping) this.camera.position.y = this.NORMAL_HEIGHT;
            }
        });
        // Mobile controls
        const bindTouchEvent = (el, action, start, end) => {
            el.addEventListener('touchstart', e => { e.preventDefault(); this.controls[action] = start; if(action === 'jump' && !this.isJumping && !this.isCrouching){this.isJumping = true; this.jumpVelocity = this.JUMP_FORCE;} if(action === 'crouch' && !this.isJumping){this.isCrouching = true; this.camera.position.y = this.CROUCH_HEIGHT;}}, { passive: false });
            el.addEventListener('touchend', e => { e.preventDefault(); this.controls[action] = end; if(action === 'crouch'){this.isCrouching = false; if(!this.isJumping) this.camera.position.y = this.NORMAL_HEIGHT;} }, { passive: false });
        };
        bindTouchEvent(document.getElementById('left-btn'), 'moveLeft', true, false);
        bindTouchEvent(document.getElementById('right-btn'), 'moveRight', true, false);
        bindTouchEvent(document.getElementById('jump-btn'), 'jump', true, false);
        bindTouchEvent(document.getElementById('crouch-btn'), 'crouch', true, false);
    }

    resetGame() {
        this.camera.position.set(0, this.NORMAL_HEIGHT, -10);
        this.player.speed = this.START_SPEED;
        this.obstacleDensity = 1.0;
        this.isJumping = false;
        this.isCrouching = false;
        this.jumpVelocity = 0;
        this.collisionSkipCount = 0;
        this.slowTimeActive = false;
        this.isInvincible = false;
        this.score = 0;
        this.difficultyLevel = 0;
        this.updatePerkUI();
        this.worldChunks.forEach(chunk => {
            if(chunk.userData && chunk.userData.animated){
                chunk.userData.animated.forEach(obj => obj.dispose && obj.dispose());
            }
            this.scene.remove(chunk);
        });
        this.worldChunks.clear();
    }

    gameOver() {
        this.gameRunning = false;
        this.ui.title.innerText = "Game Over";
        this.ui.instructions.innerHTML = `You ran ${this.score} meters!<br>High Score: ${this.highScore}`;
        this.ui.startButton.innerText = "RUN AGAIN";
        this.ui.overlay.classList.remove('hidden');
        this.ui.gameUI.style.display = 'none';
    }

    updatePerkUI() {
        this.ui.collisionPerk.classList.toggle('active', this.collisionSkipCount > 0);
        this.ui.collisionPerk.innerText = this.collisionSkipCount > 0 ? `${this.collisionSkipCount}x` : '3x';
        this.ui.slowPerk.classList.toggle('active', this.slowTimeActive);
    }

    createJumpingObstacle(x, z) {
        const log = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 4, 6).rotateZ(Math.PI / 2),
            this.groundMaterial
        );
        log.castShadow = true;
        log.userData = {
            isObstacle: true,
            requiresJump: true,
            hitbox: new THREE.Box3().setFromObject(log)
        };
        log.position.set(x, 0.5, z);
        return log;
    }

    createPerk(type, x, z) {
        let geo, mat;
        if (type === 'collision') {
            geo = new THREE.OctahedronGeometry(1);
            mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
        } else {
            geo = new THREE.TorusGeometry(0.8, 0.3, 8, 12);
            mat = new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x4444ff, emissiveIntensity: 0.5 });
        }
        const perk = new THREE.Mesh(geo, mat);
        perk.userData = {
            isPerk: true,
            perkType: type,
            hitbox: new THREE.Box3().setFromObject(perk)
        };
        perk.position.set(x, 1.5, z);
        return perk;
    }

    createWorldChunk(chunkX, chunkZ) {
        const chunkId = `${chunkX},${chunkZ}`;
        if (this.worldChunks.has(chunkId)) return;
        const ground = new GroundChunk({size: this.CHUNK_SIZE, material: this.groundMaterial });
        const chunkGroup = ground.group;
        chunkGroup.userData = { obstacles: [], perks: [], animated: [] };
        // Add obstacles and foliage
        const obstacleCount = 1 + Math.floor(this.difficultyLevel / 2);
        for(let i = 0; i < obstacleCount; i++) {
            const x = Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2;
            const z = Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2;
            const pattern = Math.random();
            if (this.difficultyLevel < 2 || pattern > 0.8) {
                const tree = new ProceduralTree({ isComplex: this.difficultyLevel > 3 && Math.random() > 0.5 });
                chunkGroup.add(tree.group);
                tree.group.position.set(x, 0, z);
                chunkGroup.userData.obstacles.push(...tree.group.children.filter(c => c.userData && c.userData.isObstacle));
                chunkGroup.userData.animated.push(tree);
            } else {
                if (pattern < 0.4) { // Corridor
                    const tree1 = new ProceduralTree({}); chunkGroup.add(tree1.group); tree1.group.position.set(x-4,0,z);
                    const tree2 = new ProceduralTree({}); chunkGroup.add(tree2.group); tree2.group.position.set(x+4,0,z);
                    chunkGroup.userData.obstacles.push(tree1.group.children[0], tree2.group.children[0]);
                    chunkGroup.userData.animated.push(tree1, tree2);
                } else { // Forced jump
                    const log = this.createJumpingObstacle(x, z);
                    chunkGroup.add(log);
                    chunkGroup.userData.obstacles.push(log);
                }
            }
        }
        // Add perks
        if (Math.random() < 0.1) {
            const perk = this.createPerk(Math.random() > 0.5 ? 'collision' : 'slow', Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2, Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2);
            chunkGroup.add(perk);
            chunkGroup.userData.perks.push(perk);
        }
        // Add details
        const detailCount = Math.floor((Math.random() * 4 + 4) * this.obstacleDensity);
        for (let i = 0; i < detailCount; i++) {
            const foliage = Math.random() > 0.4 ? new ProceduralBush() : new SmallRock();
            const posX = Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2;
            const posZ = Math.random() * this.CHUNK_SIZE - this.CHUNK_SIZE / 2;
            foliage.mesh.position.set(posX, foliage.mesh.position.y, posZ);
            chunkGroup.add(foliage.mesh);
            chunkGroup.userData.animated.push(foliage);
        }
        // Add grass
        const grass = new InstancedGrass({count: 150, radius: this.CHUNK_SIZE / 2, parentGroup: chunkGroup});
        chunkGroup.userData.animated.push(grass);
        chunkGroup.position.set(chunkX * this.CHUNK_SIZE, 0, chunkZ * this.CHUNK_SIZE);
        this.scene.add(chunkGroup);
        this.worldChunks.set(chunkId, chunkGroup);
    }

    update(delta, time) {
        if (!this.gameRunning) return;
        // Update score and difficulty
        this.score = Math.floor(this.camera.position.z);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('forestRunnerHighScore', this.highScore);
        }
        this.ui.score.innerText = `Score: ${this.score}`;
        this.ui.highScore.innerText = `High Score: ${this.highScore}`;
        this.difficultyLevel = Math.floor(this.score / 400);
        // Manage invincibility and power-ups
        if (this.isInvincible && time > this.invincibilityEndTime) {
            this.isInvincible = false;
        }
        let speedMultiplier = 1.0;
        if (this.slowTimeActive && time < this.slowTimeEndTime) {
            speedMultiplier = 0.5;
        } else if (this.slowTimeActive) {
            this.slowTimeActive = false;
            this.updatePerkUI();
        }
        // Update player position
        this.camera.position.z += this.player.speed * delta * speedMultiplier;
        if (this.isJumping) {
            this.camera.position.y += this.jumpVelocity * delta;
            this.jumpVelocity += this.GRAVITY * delta;
            if (this.camera.position.y <= this.NORMAL_HEIGHT) {
                this.camera.position.y = this.NORMAL_HEIGHT;
                this.isJumping = false;
            }
        }
        const lateralVelocity = (this.controls.moveRight ? 1 : 0) - (this.controls.moveLeft ? 1 : 0);
        this.camera.position.x += lateralVelocity * this.LATERAL_SPEED * delta * speedMultiplier;
        this.camera.position.x = Math.max(-20, Math.min(20, this.camera.position.x));
        // Update world chunks
        const camChunkX = Math.round(this.camera.position.x / this.CHUNK_SIZE);
        const camChunkZ = Math.round(this.camera.position.z / this.CHUNK_SIZE);
        for (let z = -this.RENDER_DISTANCE; z <= this.RENDER_DISTANCE; z++) {
            for (let x = -this.RENDER_DISTANCE; x <= this.RENDER_DISTANCE; x++) {
                this.createWorldChunk(camChunkX + x, camChunkZ + z);
            }
        }
        this.worldChunks.forEach((chunk, chunkId) => {
            const [cx, cz] = chunkId.split(',').map(Number);
            if (Math.abs(cx - camChunkX) > this.RENDER_DISTANCE + 1 || Math.abs(cz - camChunkZ) > this.RENDER_DISTANCE + 1) {
                if(chunk.userData && chunk.userData.animated){
                    chunk.userData.animated.forEach(obj => obj.dispose && obj.dispose());
                }
                this.scene.remove(chunk);
                this.worldChunks.delete(chunkId);
            } else {
                if(chunk.userData && chunk.userData.animated){
                    chunk.userData.animated.forEach(obj => obj.update && obj.update(delta, time));
                }
            }
        });
        // Collision detection
        const hitboxHeight = this.isCrouching ? this.NORMAL_HEIGHT * 0.5 : this.NORMAL_HEIGHT * 0.8;
        this.player.hitbox.setFromCenterAndSize(
            new THREE.Vector3(this.camera.position.x, this.camera.position.y - this.NORMAL_HEIGHT + hitboxHeight / 2, this.camera.position.z),
            new THREE.Vector3(1.5, hitboxHeight, 1.5)
        );
        this.checkCollisions(camChunkX, camChunkZ, time);
        this.player.speed += this.ACCELERATION * delta * speedMultiplier;
        this.obstacleDensity = 1.0 + (this.score / 5000);
    }

    checkCollisions(camChunkX, camChunkZ, time) {
        if (this.isInvincible) return;
        let collisionDetected = false;
        for (let z = -1; z <= 1 && !collisionDetected; z++) {
            for (let x = -1; x <= 1 && !collisionDetected; x++) {
                const chunk = this.worldChunks.get(`${camChunkX + x},${camChunkZ + z}`);
                if (chunk) {
                    for(const obstacle of chunk.userData.obstacles){
                        obstacle.updateWorldMatrix(true, false);
                        this.tempHitbox.copy(obstacle.userData.hitbox).applyMatrix4(obstacle.matrixWorld);
                        if (this.player.hitbox.intersectsBox(this.tempHitbox)) {
                            if ((obstacle.userData.requiresJump && !this.isJumping) || (!obstacle.userData.requiresJump)) {
                                collisionDetected = true; break;
                            }
                        }
                    }
                    for (const perk of [...chunk.userData.perks]) {
                        perk.updateWorldMatrix(true, false);
                        this.tempHitbox.copy(perk.userData.hitbox).applyMatrix4(perk.matrixWorld);
                        if(this.player.hitbox.intersectsBox(this.tempHitbox)){
                            if(perk.userData.perkType === 'collision') this.collisionSkipCount = 3;
                            else { this.slowTimeActive = true; this.slowTimeEndTime = time + 5; }
                            chunk.remove(perk);
                            chunk.userData.perks = chunk.userData.perks.filter(p => p !== perk);
                            this.updatePerkUI();
                        }
                    }
                }
            }
        }
        if(collisionDetected) {
            if (this.collisionSkipCount > 0) {
                this.collisionSkipCount--;
                this.updatePerkUI();
                this.isInvincible = true;
                this.invincibilityEndTime = time + 0.5;
            } else {
                this.gameOver();
            }
        }
    }

    startGameLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            const delta = this.clock.getDelta();
            const time = this.clock.getElapsedTime();
            this.update(delta, time);
            this.composer.render();
            this.fps.frame();
            this.adaptiveQuality.update();
        };
        animate();
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
        window.addEventListener('DOMContentLoaded', () => {
            new ForestRunnerGame();
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new ForestRunnerGame();
});
