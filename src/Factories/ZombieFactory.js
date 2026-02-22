import * as THREE from 'three';
import * as C from '../Components.js';

const ZOMBIE_HEALTH = 100;
const ZOMBIE_SPEED = 1.5;

/**
 * Attaches all components needed for a zombie enemy to the given entity.
 *
 * Components added:
 * - PositionComponent  — world position at spawnLocation
 * - VelocityComponent  — zero initial velocity
 * - CollisionComponent — default axis-aligned OBB (1×2×1)
 * - HealthComponent    — ZOMBIE_HEALTH hit points
 * - MeshComponent      — purple box mesh representing the zombie
 *
 * @param {import('../Entity.js').Entity} entity       - Pre-created entity from EntityManager.
 * @param {THREE.Vector3}                 spawnLocation - World position to spawn at.
 * @returns {import('../Entity.js').Entity} The entity with all components attached.
 */
export function setZombieComponents(data) {
    const { entity, assets, position, direction } = data;

    entity.addComponent(new C.PositionComponent(position));
    entity.addComponent(new C.VelocityComponent(new THREE.Vector3()));
    entity.addComponent(new C.CollisionComponent());
    entity.addComponent(new C.HealthComponent(ZOMBIE_HEALTH));

    let geometry = new THREE.BoxGeometry(1, 2, 1);
    if (assets.geometries['zombie']) {
        geometry = assets.geometries['zombie'];
    }
    
    let texture = new THREE.MeshStandardMaterial({ color: 0x6a0dad });
    if (assets.textures['zombie']) {
        texture = new THREE.MeshStandardMaterial({ map: assets.textures['zombie'] });
    } 

    const mesh = new THREE.Mesh(geometry, texture);
    const MODEL_FORWARD = new THREE.Vector3(0, 0, -1);
    const facing = direction
        ? direction.clone().normalize()
        : new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), position).setY(0).normalize();
    mesh.quaternion.setFromUnitVectors(MODEL_FORWARD, facing);
    entity.addComponent(new C.MeshComponent(mesh));
    return entity;
}
