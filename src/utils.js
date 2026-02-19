import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

export function getOBB(entity) {
    const pos = entity.getComponent('PositionComponent').position;
    const col = entity.getComponent('CollisionComponent');
    const mat3 = new THREE.Matrix3().setFromMatrix4(
        new THREE.Matrix4().makeRotationFromQuaternion(col.rotation)
    );
    return new OBB(pos.clone(), col.half.clone(), mat3);
}

// Returns the 3 local axes of an OBB from its Matrix3 rotation (column-major)
export function obbAxes(obb) {
    const e = obb.rotation.elements;
    return [
        new THREE.Vector3(e[0], e[1], e[2]), // local X
        new THREE.Vector3(e[3], e[4], e[5]), // local Y
        new THREE.Vector3(e[6], e[7], e[8]), // local Z
    ];
}

// Projects an OBB onto an axis, returns { min, max }
export function projectOBB(obb, axis) {
    const axes = obbAxes(obb);
    const r = obb.halfSize.x * Math.abs(axis.dot(axes[0]))
            + obb.halfSize.y * Math.abs(axis.dot(axes[1]))
            + obb.halfSize.z * Math.abs(axis.dot(axes[2]));
    const c = obb.center.dot(axis);
    return { min: c - r, max: c + r };
}

// SAT on 6 axes (3 from each OBB). Returns MTV vector or null if no collision.
export function satOBB(obbA, obbB) {
    const axes = [...obbAxes(obbA), ...obbAxes(obbB)];
    let minOverlap = Infinity;
    let mtvAxis = null;

    for (const axis of axes) {
        if (axis.lengthSq() < 1e-10) continue;
        const pA = projectOBB(obbA, axis);
        const pB = projectOBB(obbB, axis);
        const overlap = Math.min(pA.max, pB.max) - Math.max(pA.min, pB.min);
        if (overlap <= 0) return null; // separating axis found — no collision
        if (overlap < minOverlap) {
            minOverlap = overlap;
            mtvAxis = axis.clone().normalize();
        }
    }

    if (!mtvAxis) return null;

    // Ensure MTV points from B toward A
    if (new THREE.Vector3().subVectors(obbA.center, obbB.center).dot(mtvAxis) < 0) {
        mtvAxis.negate();
    }
    return mtvAxis.multiplyScalar(minOverlap);
}