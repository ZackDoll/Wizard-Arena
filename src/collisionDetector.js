import * as THREE from 'three';

// Checks collision between 2 objects.
function checkCollision(object1, object2) {
    const box1 = new THREE.Box3().setFromObject(object1);
    const box2 = new THREE.Box3().setFromObject(object2);
    return box1.intersectsBox(box2);
}

// Checks if the object is in collision with at least one object in the array.
function checkAllCollisions(object, objects) {
    for (let i = 0; i < objects.length; i++) {
        if (object !== objects[i] && checkCollision(object, objects[i])) {
            return true;
        }
    }
    return false;
}

export { checkAllCollisions, checkCollision };