import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Central asset registry for the game.
 *
 * Supports loading textures (→ MeshStandardMaterial), STL geometry, and GLTF/GLB models.
 * Assets are stored in named maps and retrieved with getter methods.
 * Call loadFromFile() to bulk-load assets from a manifest, or use addMaterial()/addGeometry()
 * directly for one-off loads.
 */
export class Assets {
    constructor() {
        this.textureMap = {};
        this.geometryMap = {};
        this.fontMap = {};
        this.animationMap = {};
        this.soundMap = {};
        this.textureLoader = new THREE.TextureLoader();
        this.stlLoader = new STLLoader();
        this.gltfLoader = new GLTFLoader();
    }

    /**
     * Reads a manifest file and loads every asset described in it.
     * Each non-empty, non-comment line must follow the format:
     *   ASSET_TYPE  ASSET_NAME  ASSET_FILE_PATH
     * Supported types: MATERIAL, GEOMETRY.
     * @param {string} filePath - URL or path to the manifest file.
     * @returns {Promise<void>} Resolves when all assets have finished loading.
     */
    async loadFromFile(filePath) {
        console.log(`Assets: loading from manifest "${filePath}"`);
        const text = await fetch(filePath).then(res => res.text());
        console.log(`Assets: loaded manifest "${filePath}" with content:\n${text}`);
        const promises = [];
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [type, name, assetPath] = trimmed.split(/\s+/);
            switch (type?.toUpperCase()) {
                case 'MATERIAL': promises.push(this.addMaterial(name, assetPath)); break;
                case 'GEOMETRY': promises.push(this.addGeometry(name, assetPath)); break;
                default: console.warn(`Assets: unknown type "${type}" on line: ${trimmed}`);
            }
        }
        return Promise.all(promises);
    }

    /**
     * Loads a texture from the given path and stores a MeshStandardMaterial under name.
     * @param {string} name - Key to store the material under.
     * @param {string} path - URL or path to the image file.
     * @returns {Promise<void>} Resolves when the texture has loaded.
     */
    addMaterial(name, path) {
        return new Promise((resolve) => {
            const texture = this.textureLoader.load(path, resolve, undefined,
                (err) => console.error(`Assets: failed to load texture "${path}"`, err));
            this.textureMap[name] = new THREE.MeshStandardMaterial({ map: texture });
        });
    }

    /**
     * Loads a 3D geometry asset from the given path and stores it under name.
     * Supports .stl (BufferGeometry) and .glb/.gltf (THREE.Group scene graph).
     * For GLTF files with animations, the clips are also stored in animationMap.
     * @param {string} name - Key to store the geometry/scene under.
     * @param {string} path - URL or path to the model file.
     * @returns {Promise<THREE.BufferGeometry|THREE.Group|null>} Resolves with the loaded asset.
     */
    addGeometry(name, path) {
        const ext = path.split('.').pop().toLowerCase();

        if (ext === 'stl') {
            return new Promise((resolve, reject) => {
                this.stlLoader.load(path, (geometry) => {
                    geometry.computeVertexNormals();
                    geometry.center();
                    this.geometryMap[name] = geometry;
                    resolve(geometry);
                    console.log(`Assets: loaded STL geometry "${name}" from "${path}"`);
                }, undefined, (err) => {
                    console.error(`Assets: failed to load STL "${path}"`, err);
                    reject(err);
                });
            });
        }

        if (ext === 'glb' || ext === 'gltf') {
            return new Promise((resolve, reject) => {
                this.gltfLoader.load(path, (gltf) => {
                    this.geometryMap[name] = gltf.scene;
                    if (gltf.animations?.length) this.animationMap[name] = gltf.animations;
                    resolve(gltf.scene);
                    console.log(`Assets: loaded GLTF model "${name}" from "${path}"`);
                }, undefined, (err) => {
                    console.error(`Assets: failed to load GLTF "${path}"`, err);
                    reject(err);
                });
            });
        }

        console.warn(`Assets: unsupported geometry format ".${ext}" for "${path}"`);
        return Promise.resolve(null);
    }

    /**
     * Returns the MeshStandardMaterial stored under name, or null if not found.
     * @param {string} name
     * @returns {THREE.MeshStandardMaterial|null}
     */
    getMaterial(name) { return this.textureMap[name] ?? null; }

    /**
     * Returns the geometry or scene object stored under name, or null if not found.
     * @param {string} name
     * @returns {THREE.BufferGeometry|THREE.Group|null}
     */
    getGeometry(name) { return this.geometryMap[name] ?? null; }

    /**
     * Returns the animation clips stored for the given name, or null if none exist.
     * @param {string} name
     * @returns {THREE.AnimationClip[]|null}
     */
    getAnimations(name) { return this.animationMap[name] ?? null; }
}
