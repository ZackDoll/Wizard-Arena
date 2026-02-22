import * as THREE from 'three';
import { Assets } from './Assets.js';
import { Action } from './Action.js';
import { ScenePlay } from './ScenePlay.js';

/**
 * Top-level game loop controller.
 *
 * Responsibilities:
 * - Creates and owns the Three.js WebGLRenderer.
 * - Manages the active scene and delegates per-frame update/render calls to it.
 * - Translates raw DOM input events into Action objects and forwards them to the scene.
 * - Loads shared assets via the Assets manager.
 */
export class GameEngine {
    /**
     * @param {HTMLElement} canvasElement - DOM element to attach the renderer canvas to.
     */
    constructor(canvasElement) {
        this.currentScene = null;
        this.isRunning    = true;
        this.timer        = new THREE.Timer();
        this.timer.connect(document);

        // Renderer must be created before anything that touches domElement.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        canvasElement.appendChild(this.renderer.domElement);

        // Capture pointer on canvas click; Escape releases it automatically.
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });

        this.setUpUserInputListeners();

        // load assets from assets.json
        this.assets = new Assets();
        this.assets.loadAssets();

        // start with the play scene, which will create the player and spawn enemies
        this.changeScene(new ScenePlay(this));
    }

    /**
     * Replaces the current scene with the given one and calls its init() method.
     * @param {import('./Scene.js').Scene} scene - The new scene to activate.
     */
    changeScene(scene) {
        this.currentScene = scene;
        this.currentScene.init();
    }

    /**
     * Updates the renderer and camera aspect ratio when the browser window is resized.
     */
    onWindowResize() {
        const cam = this.currentScene?.camera;
        if (cam) {
            cam.aspect = window.innerWidth / window.innerHeight;
            cam.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Starts the game loop. Calls animate() which schedules itself via requestAnimationFrame.
     */
    run() {
        this.animate();
    }

    /**
     * Stops the game loop on the next frame.
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Core game loop — called every frame via requestAnimationFrame.
     * Computes delta time, then delegates update and render to the current scene.
     */
    animate = (timestamp) => {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);
        this.timer.update(timestamp);
        const delta = this.timer.getDelta();
        if (this.currentScene) {
            this.currentScene.update(delta);
            this.renderer.render(this.currentScene.scene, this.currentScene.camera);
        }
    }

    /**
     * Registers DOM event listeners for keyboard and mouse input.
     * Translates each event into an Action and dispatches it to the current scene.
     */
    setUpUserInputListeners() {
        // Translate raw keyboard/mouse events into Action objects and dispatch
        // them to the current scene's doAction method.
        document.addEventListener('keydown', (e) => {
            const actionName = this.currentScene?.actionMap[e.code];
            if (actionName) this.currentScene.doAction(new Action(actionName, 'start'));
        });
        document.addEventListener('keyup', (e) => {
            const actionName = this.currentScene?.actionMap[e.code];
            if (actionName) this.currentScene.doAction(new Action(actionName, 'stop'));
        });
        document.addEventListener('mousedown', (e) => {
            const key = `Mouse${e.button}`;
            const actionName = this.currentScene?.actionMap[key];
            if (actionName) this.currentScene.doAction(new Action(actionName, 'start'));
        });
        document.addEventListener('mouseup', (e) => {
            const key = `Mouse${e.button}`;
            const actionName = this.currentScene?.actionMap[key];
            if (actionName) this.currentScene.doAction(new Action(actionName, 'stop'));
        });
        window.addEventListener('resize', () => this.onWindowResize());
    }
}
