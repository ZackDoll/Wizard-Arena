import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as C from '../Components.js';

const ZOMBIE_HEALTH = 100;

// Target height in world units — the model is auto-scaled to this regardless of export units
const ZOMBIE_TARGET_HEIGHT = 1.5;

export function setZombieComponents(data) {
    const { entity, assets, position, direction } = data;

    const halfHeight = ZOMBIE_TARGET_HEIGHT / 2;

    entity.addComponent(new C.PositionComponent(position));
    entity.addComponent(new C.VelocityComponent(new THREE.Vector3()));
    // Collision box matched to actual model size, centered at entity position
    entity.addComponent(new C.CollisionComponent(new THREE.Vector3(0.5, halfHeight, 0.5)));
    entity.addComponent(new C.HealthComponent(ZOMBIE_HEALTH));

    const gltfScene = assets.getGeometry('zombie');
    const clips     = assets.getAnimations('zombie');

    // wrapper is what sRender moves — its origin is the entity center (mid-height)
    const wrapper = new THREE.Group();

    if (gltfScene) {
        const inner = SkeletonUtils.clone(gltfScene);

        // Auto-scale inner to ZOMBIE_TARGET_HEIGHT
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        const modelHeight = box.max.y - box.min.y;
        if (modelHeight > 0) inner.scale.setScalar(ZOMBIE_TARGET_HEIGHT / modelHeight);

        // Shift inner down so feet sit at y = -halfHeight relative to wrapper.
        // When wrapper.position.y = halfHeight (spawn), feet land exactly on y=0.
        inner.position.y = -halfHeight;

        inner.traverse(child => {
            if (child.isMesh) {
                child.castShadow    = true;
                child.receiveShadow = true;
            }
        });

        wrapper.add(inner);

        if (clips?.length) {
            const walkClip = THREE.AnimationUtils.subclip(clips[0], 'walk', 25, 27, 1);
            const mixer = new THREE.AnimationMixer(inner);
            mixer.clipAction(walkClip).play();
            entity.addComponent(new C.AnimationComponent(mixer));
        }
    } else {
        // Fallback: purple box centered on wrapper origin
        const geo = new THREE.BoxGeometry(1, ZOMBIE_TARGET_HEIGHT, 1);
        const fallback = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6a0dad }));
        wrapper.add(fallback);
    }

    // Orient wrapper to face the given direction (or toward the origin)
    const MODEL_FORWARD = new THREE.Vector3(0, 0, -1);
    const facing = direction
        ? direction.clone().normalize()
        : new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), position).setY(0).normalize();
    if (facing.lengthSq() > 0) wrapper.quaternion.setFromUnitVectors(MODEL_FORWARD, facing);

    entity.addComponent(new C.MeshComponent(wrapper, true, true));
    return entity;
}
