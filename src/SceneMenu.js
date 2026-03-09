import * as THREE from 'three';
import { Scene } from './Scene.js';
import { ScenePlay } from './ScenePlay.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EntityManager } from './EntityManager.js';
import * as C from "./Components.js"

// Menu states
const STATE_MAIN = 0;
const STATE_CONTROLS = 1;

// Colors
const COLOR_SELECTED   = 0x00ffaa;
const COLOR_UNSELECTED = 0x556677;

export class SceneMenu extends Scene {

    constructor(gameEngine) {
        super(gameEngine);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.entityManager = new EntityManager();

        // Render state
        this.addedMeshes = new Set();
        this.addedLights = new Set();

        // Menu state
        this.menuState = STATE_MAIN;
        this.selectedOption = 0;
        this.menuOptions = [];       // [{entity, mesh, material}]
        this.controlsEntities = [];  // entities shown in controls view
        this.elapsedTime = 0;
        this.titleMesh = null;
    }

    init() {
        this.camera.position.set(0, 1.5, 5);

        // Register actions
        this.registerAction('KeyW',      'up');
        this.registerAction('ArrowUp',   'up');
        this.registerAction('KeyS',      'down');
        this.registerAction('ArrowDown', 'down');
        this.registerAction('Enter',     'enter');
        this.registerAction('Space',     'enter');
        this.registerAction('Escape',    'back');
        this.registerAction('Backspace', 'back');

        // Dark background
        this.scene.background = new THREE.Color(0x000000);

        // Dim ambient so shadows are visible
        const ambient = new THREE.AmbientLight(0x111122, 1.5);
        this.scene.add(ambient);

        // Key spotlight from above — casts shadows from the text onto the ground
        const keyLight = new THREE.SpotLight(0x6688cc, 4, 20, Math.PI / 5, 0.4, 1);
        keyLight.position.set(0, 6, 4);
        keyLight.target.position.set(0, 0, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.bias = -0.002;
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);

        // Accent rim light from behind — adds depth
        const rimLight = new THREE.SpotLight(0x4422aa, 3, 16, Math.PI / 6, 0.5, 1);
        rimLight.position.set(0, 3, -3);
        rimLight.target.position.set(0, 1, 2);
        rimLight.castShadow = true;
        rimLight.shadow.mapSize.set(512, 512);
        this.scene.add(rimLight);
        this.scene.add(rimLight.target);

        // Subtle front fill for readability
        const fillLight = new THREE.PointLight(0x334466, 0.8, 12);
        fillLight.position.set(0, 1, 5);
        this.scene.add(fillLight);

        // Store animated lights
        this.keyLight = keyLight;
        this.rimLight = rimLight;

        // Ground plane to receive shadows
        const groundGeo = new THREE.PlaneGeometry(30, 30);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a18,
            roughness: 0.9,
            metalness: 0.1,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Orange brick wall behind the text
        const brickNormal = this.gameEngine.assets.getNormalMap('brick');
        if (brickNormal) {
            brickNormal.wrapS = brickNormal.wrapT = THREE.RepeatWrapping;
        }
        const wallGeo = new THREE.PlaneGeometry(this.width(), this.height());
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xcc6633,
            normalMap: brickNormal ?? null,
            normalScale: new THREE.Vector2(1.5, 1.5),
            roughness: 0.9,
        });
        if (brickNormal) wallMat.normalMap.repeat.set(128, 128);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(0, 0, -5);
        wall.receiveShadow = true;
        this.scene.add(wall);

        const font = this.gameEngine.assets.fonts['menu-title'] || this.gameEngine.assets.fonts['default'];
        const regularFont = this.gameEngine.assets.fonts['menu-regular'] || this.gameEngine.assets.fonts['default'];

        // --- Title ---
        this._createTitle(font);

        // --- Menu buttons ---
        this._createMenuButton('Play Game',     regularFont, 0.5, 0);
        this._createMenuButton('Show Controls', regularFont, -0.5, 1);

        // Update highlight immediately
        this._updateHighlight();
    }

    _createTitle(font) {
        const entity = this.entityManager.addEntity("menuTitle");
        const geo = new TextGeometry('Wizard Arena', {
            font,
            size: 0.7,
            depth: 0.2,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5
        });
        geo.center();
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.6,
            metalness: 0.7,
            roughness: 0.3,
        });
        this.titleMaterial = material;
        const mesh = new THREE.Mesh(geo, material);
        this.titleMesh = mesh;
        entity.addComponent(new C.MeshComponent(mesh, true, false));
        entity.addComponent(new C.PositionComponent(new THREE.Vector3(0, 2.8, 0)));
    }

    _createMenuButton(text, font, yPos, optionIndex) {
        const entity = this.entityManager.addEntity("menuButton");
        const geo = new TextGeometry(text, {
            font,
            size: 0.35,
            depth: 0.1,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.01,
            bevelOffset: 0,
            bevelSegments: 3
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

    _createControlsView() {
        const font = this.gameEngine.assets.fonts['menu-regular'] || this.gameEngine.assets.fonts['default'];

        const controls = [
            { text: 'Controls',        size: 0.45, y: 2.8 },
            { text: 'W A S D  -  Move',       size: 0.25, y: 1.6 },
            { text: 'Mouse  -  Look Around',  size: 0.25, y: 0.9 },
            { text: 'Click  -  Attack',        size: 0.25, y: 0.2 },
            { text: 'Space  -  Jump',          size: 0.25, y: -0.5 },
            { text: 'P  -  Pause',             size: 0.25, y: -1.2 },
        ];

        for (const { text, size, y } of controls) {
            const entity = this.entityManager.addEntity("controlsText");
            const geo = new TextGeometry(text, {
                font,
                size,
                depth: 0.05,
                curveSegments: 8,
                bevelEnabled: true,
                bevelThickness: 0.01,
                bevelSize: 0.005,
                bevelOffset: 0,
                bevelSegments: 2
            });
            geo.center();
            const isHeader = y === 2.8;
            const material = new THREE.MeshStandardMaterial({
                color: isHeader ? 0x4466cc : 0x7788aa,
                emissive: isHeader ? 0x2244aa : 0x112233,
                emissiveIntensity: isHeader ? 0.4 : 0.15,
                metalness: 0.4,
                roughness: 0.5,
            });
            const mesh = new THREE.Mesh(geo, material);
            entity.addComponent(new C.MeshComponent(mesh, true, false));
            entity.addComponent(new C.PositionComponent(new THREE.Vector3(0, y, 0)));
            this.controlsEntities.push(entity);
        }

        // Back button
        const backEntity = this.entityManager.addEntity("controlsText");
        const backGeo = new TextGeometry('Back (Esc)', {
            font,
            size: 0.25,
            depth: 0.05,
            curveSegments: 8,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.005,
            bevelOffset: 0,
            bevelSegments: 2
        });
        backGeo.center();
        const backMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_SELECTED,
            emissive: 0x004422,
            emissiveIntensity: 0.3,
            metalness: 0.3,
            roughness: 0.6,
        });
        const backMesh = new THREE.Mesh(backGeo, backMaterial);
        backEntity.addComponent(new C.MeshComponent(backMesh, true, false));
        backEntity.addComponent(new C.PositionComponent(new THREE.Vector3(0, -2.2, 0)));
        this.controlsEntities.push(backEntity);
    }

    _destroyControlsView() {
        for (const entity of this.controlsEntities) {
            const meshComp = entity.getComponent('MeshComponent');
            if (meshComp?.mesh) {
                this.scene.remove(meshComp.mesh);
                this.addedMeshes.delete(meshComp.mesh);
            }
            entity.destroy();
        }
        this.controlsEntities = [];
    }

    _setMenuVisible(visible) {
        // Hide/show the main menu buttons and title
        for (const opt of this.menuOptions) {
            opt.mesh.visible = visible;
        }
        if (this.titleMesh) {
            this.titleMesh.visible = visible;
        }
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

        // floating animation on the title
        if (this.titleMesh) {
            this.titleMesh.rotation.y = Math.sin(t * 0.5) * 0.12;
            this.titleMesh.position.y = 2.8 + Math.sin(t * 0.8) * 0.1;
        }

        // Animate title glow
        if (this.titleMaterial) {
            this.titleMaterial.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.3;
        }

        // Sway the key light so shadows shift dynamically
        if (this.keyLight) {
            this.keyLight.position.x = Math.sin(t * 0.4) * 2;
            this.keyLight.position.z = 4 + Math.cos(t * 0.3) * 1;
        }

        // Sway rim light opposite direction
        if (this.rimLight) {
            this.rimLight.position.x = Math.cos(t * 0.35) * 1.5;
        }

        // pulse on selected button
        if (this.menuState === STATE_MAIN) {
            const sel = this.menuOptions[this.selectedOption];
            if (sel) {
                const pulse = 1.15 + Math.sin(t * 3) * 0.05;
                sel.mesh.scale.setScalar(pulse);
            }
        }
    }

    sRender(delta) {
        for (const entity of this.entityManager.getWithComponentName('MeshComponent')) {
            const meshComp = entity.getComponent('MeshComponent');
            if (!meshComp.mesh) continue;

            // add to scene on first appearance
            if (!this.addedMeshes.has(meshComp.mesh)) {
                this.scene.add(meshComp.mesh);
                this.addedMeshes.add(meshComp.mesh);
                meshComp.mesh.castShadow    = meshComp.castShadow;
                meshComp.mesh.receiveShadow = meshComp.receiveShadow;
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) meshComp.mesh.position.copy(position);

            const rotation = entity.getComponent('RotationComponent');
            if (rotation != null) meshComp.mesh.rotation.set(rotation.yaw, rotation.pitch, rotation.roll);
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

        if (this.menuState === STATE_CONTROLS) {
            // Any key in controls view goes back to main menu
            if (action.name === 'back' || action.name === 'enter') {
                this._destroyControlsView();
                this._setMenuVisible(true);
                this.menuState = STATE_MAIN;
            }
            return;
        }

        // Main menu actions
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
                // Play Game — switch to gameplay scene
                this.gameEngine.changeScene(new ScenePlay(this.gameEngine));
            } else if (this.selectedOption === 1) {
                // Show Controls
                this._setMenuVisible(false);
                this._createControlsView();
                this.menuState = STATE_CONTROLS;
            }
        }
    }
}
