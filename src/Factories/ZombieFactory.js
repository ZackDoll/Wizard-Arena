import * as THREE from 'three';
import {
    PositionComponent,
    VelocityComponent,
    CollisionComponent,
    HealthComponent,
    MeshComponent,
} from '../Components.js';

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
export function zombieComponents(entity, spawnLocation) {

    entity.addComponent(new PositionComponent(spawnLocation));

    entity.addComponent(new VelocityComponent(new THREE.Vector3()));

    entity.addComponent(new CollisionComponent());

    entity.addComponent(new HealthComponent(ZOMBIE_HEALTH));

    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a0dad });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(spawnLocation);
    entity.addComponent(new MeshComponent(mesh));

    return entity;
}
