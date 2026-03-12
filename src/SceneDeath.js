import * as THREE from 'three';
import { Scene } from './Scene.js';
import { ScenePlay } from './ScenePlay.js';
import { SceneMenu } from './SceneMenu.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EntityManager } from './EntityManager.js';
import * as C from './Components.js';

// Colors
const COLOR_SELECTED   = 0x00ffaa;
const COLOR_UNSELECTED = 0x556677;

export class SceneDeath extends Scene {

    /**
     * @param {import('./GameEngine.js').GameEngine} gameEngine
     * @param {number} score - The player's final score to display.
     */
    constructor(gameEngine, score = 0) {
        super(gameEngine);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.entityManager = new EntityManager();

        this.score = score;

        // Render state
        this.addedMeshes = new Set();
        this.addedLights = new Set();

        // Menu state
        this.selectedOption = 0;
        this.menuOptions = [];   // [{entity, mesh, material}]
        this.elapsedTime = 0;
        this.titleMesh = null;
        this.titleMaterial = null;
    }

    init() {
        this.camera.position.set(0, 1.5, 5);

        this.registerAction('KeyW',      'up');
        this.registerAction('ArrowUp',   'up');
        this.registerAction('KeyS',      'down');
        this.registerAction('ArrowDown', 'down');
        this.registerAction('Enter',     'enter');
        this.registerAction('Space',     'enter');

        // Dark red background
        this.scene.background = new THREE.Color(0x0d0000);

        // Dim ambient
        const ambient = new THREE.AmbientLight(0x220000, 1.5);
        this.scene.add(ambient);

        // Deep red key light from above
        const keyLight = new THREE.SpotLight(0xff2200, 5, 20, Math.PI / 5, 0.4, 1);
        keyLight.position.set(0, 6, 4);
        keyLight.target.position.set(0, 0, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.bias = -0.002;
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);

        // Accent rim light from behind
        const rimLight = new THREE.SpotLight(0x660000, 3, 16, Math.PI / 6, 0.5, 1);
        rimLight.position.set(0, 3, -3);
        rimLight.target.position.set(0, 1, 2);
        this.scene.add(rimLight);
        this.scene.add(rimLight.target);

        // Ground plane to receive shadows
        const groundGeo = new THREE.PlaneGeometry(30, 30);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0000, roughness: 0.9, metalness: 0.1 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Back wall
        const brickNormal = this.gameEngine.assets.getNormalMap('brick');
        if (brickNormal) {
            brickNormal.wrapS = brickNormal.wrapT = THREE.RepeatWrapping;
        }
        const wallGeo = new THREE.PlaneGeometry(this.width(), this.height());
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x550000,
            normalMap: brickNormal ?? null,
            normalScale: new THREE.Vector2(1.5, 1.5),
            roughness: 0.9,
        });
        if (brickNormal) wallMat.normalMap.repeat.set(128, 128);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(0, 0, -5);
        wall.receiveShadow = true;
        this.scene.add(wall);

        // Store for animation
        this.keyLight = keyLight;
        this.rimLight = rimLight;

        const font = this.gameEngine.assets.fonts['menu-title'] || this.gameEngine.assets.fonts['default'];
        const regularFont = this.gameEngine.assets.fonts['menu-regular'] || this.gameEngine.assets.fonts['default'];

        this._createTitle(font);
        this._createScoreText(regularFont);
        this._createMenuButton('Replay', regularFont, 0.2, 0);
        this._createMenuButton('Menu',   regularFont, -0.8, 1);

        this._updateHighlight();
    }

    _createTitle(font) {
        const entity = this.entityManager.addEntity('deathTitle');
        const geo = new TextGeometry('You Died', {
            font,
            size: 0.8,
            depth: 0.25,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5,
        });
        geo.center();
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8,
            metalness: 0.5,
            roughness: 0.4,
        });
        this.titleMaterial = material;
        const mesh = new THREE.Mesh(geo, material);
        this.titleMesh = mesh;
        entity.addComponent(new C.MeshComponent(mesh, true, false));
        entity.addComponent(new C.PositionComponent(new THREE.Vector3(0, 2.8, 0)));
    }

    _createScoreText(font) {
        const entity = this.entityManager.addEntity('deathScore');
        const geo = new TextGeometry(`Score: ${this.score}`, {
            font,
            size: 0.4,
            depth: 0.08,
            curveSegments: 10,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.005,
            bevelOffset: 0,
            bevelSegments: 2,
        });
        geo.center();
        const material = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3,
            metalness: 0.3,
            roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geo, material);
        entity.addComponent(new C.MeshComponent(mesh, true, false));
        entity.addComponent(new C.PositionComponent(new THREE.Vector3(0, 1.6, 0)));
    }

    _createMenuButton(text, font, yPos, optionIndex) {
        const entity = this.entityManager.addEntity('deathButton');
        const geo = new TextGeometry(text, {
            font,
            size: 0.35,
            depth: 0.1,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.01,
            bevelOffset: 0,
            bevelSegments: 3,
        });
        geo.center();
        const material = new THREE.MeshStandardMaterial({
            color: COLOR_UNSELECTED,
            metalness: 0.3,
            roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geo, material);
        entity.addComponent(new C.MeshComponent(mesh, true, false));
        entity.addComponent(new C.PositionComponent(new THREE.Vector3(0, yPos, 0)));
        this.menuOptions[optionIndex] = { entity, mesh, material };
    }

    _updateHighlight() {
        for (let i = 0; i < this.menuOptions.length; i++) {
            const opt = this.menuOptions[i];
            if (i === this.selectedOption) {
                opt.material.color.setHex(COLOR_SELECTED);
                opt.material.emissive.setHex(COLOR_SELECTED);
                opt.material.emissiveIntensity = 0.3;
                opt.mesh.scale.setScalar(1.15);
            } else {
                opt.material.color.setHex(COLOR_UNSELECTED);
                opt.material.emissive.setHex(0x000000);
                opt.material.emissiveIntensity = 0;
                opt.mesh.scale.setScalar(1.0);
            }
        }
    }

    update(delta) {
        this.elapsedTime += delta;
        this.sMovement(delta);
        this.sRender(delta);
        this.entityManager.update();
    }

    sMovement(delta) {
        const t = this.elapsedTime;

        if (this.titleMesh) {
            this.titleMesh.rotation.y = Math.sin(t * 0.4) * 0.08;
            this.titleMesh.position.y = 2.8 + Math.sin(t * 0.7) * 0.08;
        }

        if (this.titleMaterial) {
            this.titleMaterial.emissiveIntensity = 0.6 + Math.sin(t * 2.0) * 0.4;
        }

        if (this.keyLight) {
            this.keyLight.position.x = Math.sin(t * 0.3) * 2;
        }

        if (this.rimLight) {
            this.rimLight.position.x = Math.cos(t * 0.25) * 1.5;
        }

        const sel = this.menuOptions[this.selectedOption];
        if (sel) {
            const pulse = 1.15 + Math.sin(t * 3) * 0.05;
            sel.mesh.scale.setScalar(pulse);
        }
    }

    sRender(delta) {
        for (const entity of this.entityManager.getWithComponentName('MeshComponent')) {
            const meshComp = entity.getComponent('MeshComponent');
            if (!meshComp.mesh) continue;

            if (!this.addedMeshes.has(meshComp.mesh)) {
                this.scene.add(meshComp.mesh);
                this.addedMeshes.add(meshComp.mesh);
                meshComp.mesh.castShadow    = meshComp.castShadow;
                meshComp.mesh.receiveShadow = meshComp.receiveShadow;
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) meshComp.mesh.position.copy(position);
        }

        for (const entity of this.entityManager.getWithComponentName('LightComponent')) {
            const lightComp = entity.getComponent('LightComponent');

            if (!this.addedLights.has(lightComp.light)) {
                this.scene.add(lightComp.light);
                this.addedLights.add(lightComp.light);
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) lightComp.light.position.copy(position);
        }
    }

    sDoAction(action) {
        if (action.type !== 'start') return;

        if (action.name === 'down') {
            this.selectedOption = (this.selectedOption + 1) % this.menuOptions.length;
            this._updateHighlight();
        }
        if (action.name === 'up') {
            this.selectedOption = (this.selectedOption - 1 + this.menuOptions.length) % this.menuOptions.length;
            this._updateHighlight();
        }
        if (action.name === 'enter') {
            if (this.selectedOption === 0) {
                this.gameEngine.changeScene(new ScenePlay(this.gameEngine));
            } else {
                this.gameEngine.changeScene(new SceneMenu(this.gameEngine));
            }
        }
    }
}
