import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as C from './Components.js';

const ARENA_RADIUS   = 22;
const WALL_THICKNESS = 1.2;
const WALL_SEGMENTS  = 16;
const WALL_HEIGHT    = 5;
const SEGMENT_WIDTH  = (2 * Math.PI * ARENA_RADIUS) / WALL_SEGMENTS + 0.3;
const SAND_COLOR     = 0xfddea5;
const ARCH_COUNT     = 8;

export function loadWorld(engine) {
    const r = ARENA_RADIUS - WALL_THICKNESS / 2;

    //floor
    const floor = engine.addEntity('floorEntity');
    floor.addComponent(new C.PositionComponent(0, -5, 0));
    floor.addComponent(new C.MeshComponent(
        new THREE.Mesh(
            new THREE.CylinderGeometry(r, r, 10, 64),
            new THREE.MeshStandardMaterial({ color: SAND_COLOR })
        )
    ));
    floor.addComponent(new C.CollisionComponent(r, 5, r));

    //bounding walls (invisible, just for collisions)
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < WALL_SEGMENTS; i++) {
        const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
        const q = new THREE.Quaternion().setFromAxisAngle(yAxis, -angle - Math.PI / 2);

        const wallMesh = new THREE.Mesh(
            new THREE.BoxGeometry(SEGMENT_WIDTH, WALL_HEIGHT * 2, WALL_THICKNESS),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        wallMesh.quaternion.copy(q); // no RotationComponent, so RenderSystem won't override this

        const wall = engine.addEntity('arenaWallEntity');
        wall.addComponent(new C.PositionComponent(
            Math.cos(angle) * ARENA_RADIUS,
            WALL_HEIGHT,
            Math.sin(angle) * ARENA_RADIUS
        ));
        wall.addComponent(new C.CollisionComponent(
            SEGMENT_WIDTH / 2,   // half-width along tangent
            WALL_HEIGHT,         // half-height
            WALL_THICKNESS / 2,  // half-depth along radial
            q                    // rotation aligns local Z with the outward radial
        ));
        wall.addComponent(new C.MeshComponent(wallMesh));
    }

    //arches on outside
    const loader = new GLTFLoader();
    loader.load(
        '../models/arch.glb',
        (gltf) => {
            for (let i = 0; i < ARCH_COUNT; i++) {
                const angle = (i / ARCH_COUNT) * Math.PI * 2;
                const arch = gltf.scene.clone();
                arch.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                arch.rotation.y = -angle + Math.PI / 2;
                arch.scale.set(0.5, 0.5, 0.5);
                engine.scene.add(arch);
            }
        },
        undefined,
        (error) => console.error(error)
    );
}
