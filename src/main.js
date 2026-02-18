import * as THREE from 'three';
import { createCore, handleResize } from './core/setup.js';
import { addGround, addLights } from './world/ground.js';
import { createPlayerControls } from './input/playerControls.js';

const { scene, camera, renderer } = createCore();
addLights(scene);
addGround(scene);

const { update } = createPlayerControls(camera);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    update(delta);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    handleResize(camera, renderer);
});

animate();