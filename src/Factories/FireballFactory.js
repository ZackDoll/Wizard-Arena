import * as THREE from 'three';
import {
    PositionComponent,
    VelocityComponent,
    CollisionComponent,
    HealthComponent,
    MeshComponent,
    LifespanComponent,
} from '../Components.js';

const FIREBALL_SPEED = 15;
const FIREBALL_RADIUS = 0.3;
const FIREBALL_LIFETIME = 1;

export function fireballComponents(entity, origin, direction) {

    entity.addComponent(new PositionComponent(origin));

    const vel = direction.normalize().multiplyScalar(FIREBALL_SPEED);
    entity.addComponent(new VelocityComponent(vel));

    // Sphere-like AABB — equal halves on all axes
    entity.addComponent(new CollisionComponent(new THREE.Vector3(FIREBALL_RADIUS, FIREBALL_RADIUS, FIREBALL_RADIUS)));

    entity.addComponent(new HealthComponent(1));

    entity.addComponent(new LifespanComponent(FIREBALL_LIFETIME));

    const geo = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    entity.addComponent(new MeshComponent(mesh));

    return entity;
}