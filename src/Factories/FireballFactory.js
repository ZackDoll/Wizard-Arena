import * as THREE from 'three';
import * as C from '../Components.js';

const FIREBALL_SPEED = 15;
const FIREBALL_RADIUS = 0.3;
const FIREBALL_LIFETIME = 1;

export function setFireballComponents(data) {
    // unpack data object for convenience
    const { entity, assets, position, direction } = data;

    // add necessary components
    entity.addComponent(new C.PositionComponent(position));
    const vel = direction.normalize().multiplyScalar(FIREBALL_SPEED);
    entity.addComponent(new C.VelocityComponent(vel));
    entity.addComponent(new C.CollisionComponent(new THREE.Vector3(FIREBALL_RADIUS, FIREBALL_RADIUS, FIREBALL_RADIUS)));
    entity.addComponent(new C.HealthComponent(1));
    entity.addComponent(new C.LifespanComponent(FIREBALL_LIFETIME));
    entity.addComponent(new C.CombustibleComponent());

    // define default geometry
    let geometry = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);

    // use the preloaded geometry if available
    if (assets.geometries['fireball']) {
        geometry = assets.geometries['fireball'];
        const scale = FIREBALL_RADIUS / geometry.boundingSphere.radius ?? 1;
        geometry.scale(scale, scale, scale);
    }

    // define default texture/material
    let texture = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 });

    // use the preloaded texture if available
    if (assets.textures['fireball']) {
        texture = assets.textures['fireball'];
    }

    // create the mesh and orient it so the model's +Z axis points along the travel direction.
    // if the model appears sideways, swap the MODEL_FORWARD axis (try +Y or +X).
    const mesh = new THREE.Mesh(geometry, texture);
    const MODEL_FORWARD = new THREE.Vector3(0, 0, -1);
    mesh.quaternion.setFromUnitVectors(MODEL_FORWARD, direction.clone().normalize());
    entity.addComponent(new C.MeshComponent(mesh));

    return entity;
}
