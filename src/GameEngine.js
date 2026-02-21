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
     * @param {string}      [assetPath=''] - Optional path to an asset manifest file.
     */
    constructor(canvasElement, assetPath = "") {
        this.currentScene = null;
        this.isRunning    = true;
        this.clock        = new THREE.Clock();

        // Renderer must be created before anything that touches domElement.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        canvasElement.appendChild(this.renderer.domElement);

        // Capture pointer on canvas click; Escape releases it automatically.
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });

        window.addEventListener('resize', () => this.onWindowResize());

        this.setUpUserInput();

        // Load shared assets (optional — pass assetPath to use a manifest file).
        this.assets = new Assets();
        if (assetPath) this.assets.loadFromFile(assetPath);

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
    animate = () => {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();
        if (this.currentScene) {
            this.currentScene.update(delta);
            this.renderer.render(this.currentScene.scene, this.currentScene.camera);
        }
    }

    /**
     * Registers DOM event listeners for keyboard and mouse input.
     * Translates each event into an Action and dispatches it to the current scene.
     */
    setUpUserInput() {
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
    }
}
