import * as THREE from 'three';
import { Scene } from './Scene.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EntityManager } from './EntityManager.js';
import * as C from "./Components.js"

export class SceneMenu extends Scene {

    constructor(gameEngine) {
        super(gameEngine);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        this.entityManager = new EntityManager();
        this.selectedEntity = null;
    }

    // populate screen with entities (menu items), and set selected entity to play
    init() {

        // menu title
        const menuTitle = this.entityManager.addEntity("MenuTitle");
        const titleGeo = new TextGeometry('Wizard Arena', {
            font: this.gameEngine.assets.fonts['menu-title'] || this.gameEngine.assets.fonts['default'],
            size: 0.5,
            depth: 0.2,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5
        });
        titleGeo.center();
        const titleMaterial = new THREE.MeshNormalMaterial();
        const titleMesh = new THREE.Mesh(titleGeo, titleMaterial);
        menuTitle.addComponent(new C.MeshComponent(titleMesh, true));
        menuTitle.addComponent(new C.PositionComponent(new THREE.Vector3(0, 3, 0)));

        this.scene.add(titleMesh);

        // play button
        const playButton = this.entityManager.addEntity("PlayButton");
        const playGeo = new TextGeometry('Play', {
            font: this.gameEngine.assets.fonts['menu-regular'] || this.gameEngine.assets.fonts['default'],
            size: 0.5,
            depth: 0.2,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5
        });
        playGeo.center();
        const playMaterial = new THREE.MeshNormalMaterial();
        const playMesh = new THREE.Mesh(playGeo, playMaterial);
        playButton.addComponent(new C.MeshComponent(playMesh, true));
        playButton.addComponent(new C.PositionComponent(new THREE.Vector3(0, 3, 0)));


        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);

    }

    update(delta) {
        this.sMovement(delta);
        this.sRender(delta);
    }

    sMovement
}