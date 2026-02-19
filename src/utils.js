import * as THREE from 'three';

export function getHitbox(entity) {
    const pos  = entity.getComponent('PositionComponent').position;
    const half = entity.getComponent('CollisionComponent').half;
    return new THREE.Box3(
        new THREE.Vector3(pos.x - half.x, pos.y - half.y, pos.z - half.z),
        new THREE.Vector3(pos.x + half.x, pos.y + half.y, pos.z + half.z)
    );
}