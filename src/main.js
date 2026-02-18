import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { checkAllCollisions, checkCollision } from './collisionDetector.js';

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

// --- 3. Ground Plane ---
const groundSize = 100;
const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Lay flat
ground.receiveShadow = true;
scene.add(ground);

// --- 4. First Person Controls ---
const controls = new PointerLockControls(camera, document.body);

// Click to start/lock mouse
document.addEventListener('click', () => {
    controls.lock();
});

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Random Box Object for Testing ---
const testBox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0000ff })
);
testBox.position.set(5, 0.5, 5);
testBox.castShadow = false;
scene.add(testBox);

// --- All Collidable Objects ---
const collidableObjects = [cameraCollisionBox, testBox, /* Add more objects here as needed */ ];

// --- 5. Animation Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        const delta = clock.getDelta(); // Time between frames
        const oldPosition = camera.position.clone(); // Store old position for collision response

        // Reset velocity
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Calculate direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Apply movement
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        cameraCollisionBox.position.x = camera.position.x;
        cameraCollisionBox.position.z = camera.position.z;

        // Test player collision with all collidable objects
        let inCollision = false;
        if (checkAllCollisions(cameraCollisionBox, collidableObjects)) {
            console.log('Collision Detected!');
            inCollision = true;
        }

        // Revert movement to prevent passing through objects if in collision
        if (inCollision) {
            camera.position.copy(oldPosition);
            cameraCollisionBox.position.copy(camera.position);
        }
        if (checkCollision(cameraCollisionBox, ground)) {
            camera.position.y = ground.position.y + 1.7; // Keep the player above the ground
            cameraCollisionBox.position.y = camera.position.y / 2;
        }

    }

    renderer.render(scene, camera);
}

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();