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