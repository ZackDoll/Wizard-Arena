import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { checkCollision } from './collisionDetector.js';
import { SpatialGrid } from './spatialGrid.js';
import { createArena } from './arena.js';

// --- 1. Core Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Position the camera at human eye-level (1.7 units up)
camera.position.y = 1.7;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows for realism
document.body.appendChild(renderer.domElement);

const cameraCollisionBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, camera.position.y, 0.5), // A box roughly the size of a person
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }) // Red wireframe for debugging
);
cameraCollisionBox.position.y = camera.position.y / 2;
cameraCollisionBox.visible = true;
// Uncomment line below to see the collision box
//scene.add(cameraCollisionBox);

// --- 2. Lighting ---
const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
scene.add(sunLight);


//controls
const controls = new PointerLockControls(camera, document.body);

//Click to start/lock mouse
document.addEventListener('click', () => {
    controls.lock();
});

// movement vars
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let jump = false;
let isOnGround = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': jump = true; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'Space': jump = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// collision test box
const testBox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0000ff })
);
testBox.position.set(5, 0.5, 5);
testBox.castShadow = false;
scene.add(testBox);

//all collidable objects (make into data structure and import here)
const collidableObjects = [cameraCollisionBox, testBox];

const { floor, pillars } = createArena(scene);
collidableObjects.push(...pillars);

const grid = new SpatialGrid({ cellSize: 4 });
const frameBoxCache = new Map();

//animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        const delta = clock.getDelta(); // Time between frames
        const oldPosition = camera.position.clone(); // Store old position for collision response

        // Reset velocity (no damping on Y — gravity handles it)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Calculate direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Apply movement
        if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;
        if (jump && isOnGround) {
            velocity.y = 13.0;
            isOnGround = false;
        }

        //strong grav when fall, weak when rise to make it feel like accelerating but idk how to do it properly
        const gravity = velocity.y < 0 ? 30.0 : 24.0;
        velocity.y -= gravity * delta;

        controls.moveRight(-velocity.x * delta);
        camera.position.y += velocity.y * delta;
        controls.moveForward(-velocity.z * delta);
        cameraCollisionBox.position.x = camera.position.x;
        cameraCollisionBox.position.y = camera.position.y;
        cameraCollisionBox.position.z = camera.position.z;

        cameraCollisionBox.updateMatrixWorld(true);

        //compute Box3 once per object and insert into spatial grid
        frameBoxCache.clear();
        for (const obj of collidableObjects) {
            frameBoxCache.set(obj, new THREE.Box3().setFromObject(obj));
        }
        grid.clear();
        for (const obj of collidableObjects) {
            grid.insert(obj, frameBoxCache.get(obj));
        }

        //diff between old and new pos
        const dx = camera.position.x - oldPosition.x;
        const dy = camera.position.y - oldPosition.y;
        const dz = camera.position.z - oldPosition.z;

        //candidates from spatial grid based on player's collision box
        const playerBox = frameBoxCache.get(cameraCollisionBox);
        const candidates = grid.query(playerBox);

        //check if it collides any candidates
        function boxCollides(testBox) {
            for (const candidate of candidates) {
                if (candidate !== cameraCollisionBox && testBox.intersectsBox(frameBoxCache.get(candidate))) {
                    return true;
                }
            }
            return false;
        }

        //each axis gets tested independently
        const xCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(0, -dy, -dz)));
        const yCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(-dx, 0, -dz)));
        const zCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(-dx, -dy, 0)));

        if (xCollides) {
            console.log("Collision");
            camera.position.x = oldPosition.x;
        }
        if (yCollides) {
            velocity.y = 0;
            camera.position.y = oldPosition.y;
            isOnGround = true;
        }
        if (zCollides) {
            console.log("Collision");
            camera.position.z = oldPosition.z;
        }
        cameraCollisionBox.position.x = camera.position.x;
        cameraCollisionBox.position.y = camera.position.y;
        cameraCollisionBox.position.z = camera.position.z;
        const groundY = floor.position.y + 1.7;
        if (camera.position.y <= groundY) {
            camera.position.y = groundY;
            velocity.y = 0;
            isOnGround = true;
        }

    }

    renderer.render(scene, camera);
}

//window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();