import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
    PositionComponent,
    VelocityComponent,
    CollisionComponent,
    HealthComponent,
    MeshComponent,
    LifespanComponent,
    CombustibleComponent,
} from '../Components.js';

const FIREBALL_SPEED = 15;
const FIREBALL_RADIUS = 0.3;
const FIREBALL_LIFETIME = 1;

const FIREBALL_MAT = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 });

let meteorGeometry = null;

export function preloadFireballModel() {
    const loader = new STLLoader();
    loader.load('/models/Meteor.stl', (geometry) => {
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const scale = FIREBALL_RADIUS / geometry.boundingSphere.radius;
        geometry.scale(scale, scale, scale);
        meteorGeometry = geometry;
    }, undefined, (err) => console.error('Failed to load Meteor.stl:', err));
}

export function fireballComponents(entity, origin, direction) {

    entity.addComponent(new PositionComponent(origin));

    const vel = direction.normalize().multiplyScalar(FIREBALL_SPEED);
    entity.addComponent(new VelocityComponent(vel));

    entity.addComponent(new CollisionComponent(new THREE.Vector3(FIREBALL_RADIUS, FIREBALL_RADIUS, FIREBALL_RADIUS)));

    entity.addComponent(new HealthComponent(1));
    entity.addComponent(new LifespanComponent(FIREBALL_LIFETIME));
    entity.addComponent(new CombustibleComponent());

    const geo = meteorGeometry ?? new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);
    const mesh = new THREE.Mesh(geo, FIREBALL_MAT);
    mesh.position.copy(origin);
    // Orient the mesh so the model's +Z axis points along the travel direction.
    // If the model appears sideways, swap the MODEL_FORWARD axis (try +Y or +X).
    const MODEL_FORWARD = new THREE.Vector3(0, 0, -1);
    mesh.quaternion.setFromUnitVectors(MODEL_FORWARD, direction.clone().normalize());
    entity.addComponent(new MeshComponent(mesh));

    return entity;
}
