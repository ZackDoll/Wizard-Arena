import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as C from '../Components.js';

const FIREBALL_SPEED = 15;
const FIREBALL_RADIUS = 0.3;
const FIREBALL_LIFETIME = 1;

export function setFireballComponents(data) {
    const { entity, assets, position, direction } = data;

    entity.addComponent(new C.PositionComponent(position));
    const vel = direction.normalize().multiplyScalar(FIREBALL_SPEED);
    entity.addComponent(new C.VelocityComponent(vel));
    entity.addComponent(new C.CollisionComponent(new THREE.Vector3(FIREBALL_RADIUS, FIREBALL_RADIUS, FIREBALL_RADIUS)));
    entity.addComponent(new C.HealthComponent(1));
    entity.addComponent(new C.LifespanComponent(FIREBALL_LIFETIME));
    entity.addComponent(new C.CombustibleComponent());

    // use the preloaded model if available, otherwise fall back to a simple sphere
    let geo = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);
    if (assets.geometryMap['fireball']) {
        geo = assets.geometryMap['fireball'];
        geo.computeVertexNormals();
        geo.center(); // move geometry so its bounding box center sits at origin
        geo.computeBoundingSphere();
        const scale = FIREBALL_RADIUS / geo.boundingSphere.radius;
        geo.scale(scale, scale, scale);
    }

    // use the preloaded texture if available, otherwise fall back to a simple emissive material
    let texture = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 });
    if (assets.textureMap['fireball']) {
        texture = assets.textureMap['fireball'];
    }

    // create the mesh and orient it so the model's +Z axis points along the travel direction.
    // If the model appears sideways, swap the MODEL_FORWARD axis (try +Y or +X).
    const mesh = new THREE.Mesh(geo, texture);
    mesh.position.copy(position);
    const MODEL_FORWARD = new THREE.Vector3(0, 0, -1);
    mesh.quaternion.setFromUnitVectors(MODEL_FORWARD, direction.clone().normalize());
    entity.addComponent(new C.MeshComponent(mesh));

    return entity;
}
