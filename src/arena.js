import * as THREE from 'three';

const WALL_SEGMENTS = 16;
const ARENA_RADIUS = 22;     // distance from center to middle of wall
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 1.2;
// Arc length per segment + small overlap to close gaps between angled boxes
const SEGMENT_WIDTH = (2 * Math.PI * ARENA_RADIUS) / WALL_SEGMENTS + 0.3;

const STONE_COLOR = 0x8c7a5c; // weathered sandstone
const SAND_COLOR  = 0xfddea5; // arena floor

export function createArena(scene) {
    //floor
    const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS - WALL_THICKNESS / 2, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: SAND_COLOR });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // perimeter pillars
    const wallMat = new THREE.MeshStandardMaterial({ color: STONE_COLOR });
    const pillars = [];

    for (let i = 0; i < WALL_SEGMENTS; i++) {
        const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
        const geo = new THREE.BoxGeometry(SEGMENT_WIDTH, WALL_HEIGHT, WALL_THICKNESS);
        const mesh = new THREE.Mesh(geo, wallMat);

        mesh.position.set(
            Math.cos(angle) * ARENA_RADIUS,
            WALL_HEIGHT / 2,
            Math.sin(angle) * ARENA_RADIUS
        );
        mesh.rotation.y = -angle; // rotate each segment to face the center
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        scene.add(mesh);
        pillars.push(mesh);
    }
    
    //

    return { floor, pillars };
}
