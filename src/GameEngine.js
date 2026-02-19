import * as THREE from 'three'
import { EntityManager } from './EntityManager.js';

export class GameEngine {
    constructor(canvasElement){
        // setup scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        // setup camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.x = 0;
        this.camera.position.y = 2;
        this.camera.position.z = 0;
        
        // setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        canvasElement.appendChild(this.renderer.domElement);

        // game state
        this.systems = {};
        this.EM = new EntityManager();
        this.spawnQueue = [];
        this.destroyQueue = [];
        this.clock = new THREE.Clock();

        // setup window resize logic
        window.addEventListener('resize', () => this.onWindowResize());

        // click canvas to capture pointer; Escape releases it automatically
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });

        // setup lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        this.scene.add(sunLight);

    }
    
    addSystem(system) {
        this.systems[system.name] = system;
    }

    addEntity(type) {
        return this.EM.create(type);
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    quit() {

    }

    run() {
        this.animate();
    }
    
    update() {
        const delta = this.clock.getDelta();
        Object.values(this.systems).forEach(system => system.update(this.EM, delta));
        if (this.spawnQueue.length > 0 || this.destroyQueue.length > 0) {
            this.processQueues();
            this.spawnQueue.length = 0;
            this.destroyQueue.length = 0;
        }
    }

    processQueues() {
        for (const req of this.spawnQueue) {
            if (req.type === 'fireball') {
                this.EM.spawnFireball(req.origin, req.direction);
            }
        }

        for (const id of this.destroyQueue) {
            const entity = this.EM.getWithID(id);
            if (!entity) continue;
            const meshComp = entity.getComponent('MeshComponent');
            if (meshComp && meshComp.mesh) this.scene.remove(meshComp.mesh);
            this.EM.remove(id);
        }
    }

}