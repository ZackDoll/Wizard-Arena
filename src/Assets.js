import * as THREE from 'three';
import assetsFile from './assets.json' assert { type: 'json' };
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

        // maps for loaded assets, keyed by name
        this.textures = {};
        this.geometries = {};

        // for future use
        this.fonts = {}; 
        this.animations = {};
        this.sounds = {};

        // loaders are created once and reused for multiple assets
        this.textureLoader = new THREE.TextureLoader();
        this.stlLoader = new STLLoader();
        this.gltfLoader = new GLTFLoader();
    }

    /**
     * Loads every asset described in assets.json and stores them in the appropriate maps.
     * The manifest file must be a JSON array of objects with the following properties:
     * - type: ASSET_TYPE (e.g. "MATERIAL", "GEOMETRY")
     * - name: ASSET_NAME (key to store the loaded asset under)
     * - path: ASSET_FILE_PATH (URL or path to the asset file)
     * @returns {Promise<void>} Resolves when all assets have finished loading.
     */
    async loadAssets() {
        for (const asset of assetsFile) {
            const { name, geometryPath, materialPath } = asset;

            if (materialPath) {
                await this.addMaterial(name, materialPath);
            }

            if (geometryPath) {
                await this.addGeometry(name, geometryPath);
            }
        }
    }


    /**
     * Loads a texture from the given path and stores a MeshStandardMaterial under name.
     * @param {string} name - Key to store the material under.
     * @param {string} path - URL or path to the image file.
     * @returns {Promise<void>} Resolves when the texture has loaded.
     */
    addMaterial(name, material) {
        return new Promise((resolve) => {
            const texture = this.textureLoader.load(material, resolve, undefined,
                (err) => console.error(`Assets: failed to load texture "${material}"`, err));
            this.textures[name] = new THREE.MeshStandardMaterial({ map: texture });
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
    addGeometry(name, geometryPath) {

        const ext = geometryPath.split('.').pop().toLowerCase();
        if (ext === 'stl') {
            return new Promise((resolve, reject) => {
                this.stlLoader.load(geometryPath, (geometry) => {
                    geometry.computeVertexNormals();
                    geometry.center();
                    geometry.computeBoundingSphere();
                    this.geometries[name] = geometry;
                    resolve(geometry);
                    console.log(`Assets: loaded STL geometry "${name}" from "${geometryPath}"`);
                }, undefined, (err) => {
                    console.error(`Assets: failed to load STL "${geometryPath}"`, err);
                    reject(err);
                });
            });
        }

        if (ext === 'glb' || ext === 'gltf') {
            return new Promise((resolve, reject) => {
                this.gltfLoader.load(geometryPath, (gltf) => {
                    this.geometries[name] = gltf.scene;
                    if (gltf.animations?.length) this.animations[name] = gltf.animations;
                    resolve(gltf.scene);
                    console.log(`Assets: loaded GLTF model "${name}" from "${geometryPath}"`);
                }, undefined, (err) => {
                    console.error(`Assets: failed to load GLTF "${geometryPath}"`, err);
                    reject(err);
                });
            });
        }

        console.warn(`Assets: unsupported geometry format ".${ext}" for "${geometryPath}"`);
        return Promise.resolve(null);
    }

    /**
     * Returns the MeshStandardMaterial stored under name, or null if not found.
     * @param {string} name
     * @returns {THREE.MeshStandardMaterial|null}
     */
    getMaterial(name) { return this.textures[name] ?? null; }

    /**
     * Returns the geometry or scene object stored under name, or null if not found.
     * @param {string} name
     * @returns {THREE.BufferGeometry|THREE.Group|null}
     */
    getGeometry(name) { return this.geometries[name] ?? null; }

    /**
     * Returns the animation clips stored for the given name, or null if none exist.
     * @param {string} name
     * @returns {THREE.AnimationClip[]|null}
     */
    getAnimations(name) { return this.animations[name] ?? null; }
}
