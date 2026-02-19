import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class System {
    constructor() {
        this.name = this.constructor.name;
    }
}

export class InputSystem extends System {
    // manages keyboard state and accumulated mouse delta each frame.
    // mouse.dx/dy are reset to 0 at the start of each update so consumers
    // always see only the movement that happened since the last frame.
    constructor() {
        super();
        this.keys = {
            'KeyW': false,
            'KeyS': false,
            'KeyA': false,
            'KeyD': false
        };
        // accumulated mouse movement since last frame
        this.mouse = { dx: 0, dy: 0, buttons: 0, locked: false };

        document.addEventListener('keydown',   e => this.keys[e.code] = true);
        document.addEventListener('keyup',     e => this.keys[e.code] = false);
        // movementX/Y give raw delta regardless of cursor position
        document.addEventListener('mousemove', e => {
            this.mouse.dx += e.movementX;
            this.mouse.dy += e.movementY;
        });
        document.addEventListener('mousedown', e => this.mouse.buttons |=  (1 << e.button));
        document.addEventListener('mouseup',   e => this.mouse.buttons &= ~(1 << e.button));
        document.addEventListener('pointerlockchange', () => {
            this.mouse.locked = !!document.pointerLockElement;
        });
    }

    update(em, delta) {
        // deltas are reset by whichever system consumes them (e.g. CameraControlSystem)
    }
}

export class RenderSystem extends System { // TODO
    constructor(scene) {
        super();
        // keeps track of current scene and meshes added to the scene
        this.scene = scene;
        this.addedMeshes = new Set();
    }

    update(em, delta) {

        // updates the position and rotation components of entities meshes according to their position/rotation components

        for (const entity of em.getWithComponentName('MeshComponent')) {
            const position = entity.getComponent('PositionComponent').position;
            const rotation = entity.getComponent('RotationComponent');
            const meshComp = entity.getComponent('MeshComponent');

            if (!meshComp.mesh) continue;

            // add mesh to scene if not already there
            if (!this.addedMeshes.has(meshComp.mesh)) {
                this.scene.add(meshComp.mesh);
                this.addedMeshes.add(meshComp.mesh);
            }

            // update mesh position
            if (position != null) {
                meshComp.mesh.position.copy(position);
            }

            // update mesh rotation
            if (rotation != null) {
                meshComp.mesh.rotation.set(rotation.yaw, rotation.pitch, rotation.roll);
            }
        }
    }
}

export class CameraControlSystem {
    // rotate camera according to IJKL input
    // move to wizard position
  constructor(camera, inputSystem) {
    this.camera = camera;
    this.inputSystem = inputSystem;
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 30;
    this.rotSpeed = Math.PI / 2; // radians per second
  }

  update(em, delta) {
    const keys = this.inputSystem.keys;

    // IJKL keys rotate the camera
    // if (keys['KeyI']) this.pitch += this.rotSpeed * delta;
    // if (keys['KeyK']) this.pitch -= this.rotSpeed * delta;
    // if (keys['KeyJ']) this.yaw   += this.rotSpeed * delta;
    // if (keys['KeyL']) this.yaw   -= this.rotSpeed * delta;

    const sensitivity = 0.002;
    if (this.inputSystem.mouse.locked) {
        this.yaw   -= this.inputSystem.mouse.dx * sensitivity;
        this.pitch -= this.inputSystem.mouse.dy * sensitivity;
    }
    // consume deltas so they don't carry over to the next frame
    this.inputSystem.mouse.dx = 0;
    this.inputSystem.mouse.dy = 0;


    // prevent from flipping camera upside down
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    // prevents gimbal lock
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // get wizard pos and sync camera to it
    const wizPos = em.getWithID(0).getComponent('PositionComponent');
    this.camera.position.copy(wizPos.position);
    
  }
}

export class MovementSystem extends System {
    // moves entities with PositionComponent + VelocityComponent each frame.
    // for player-controlled entities (those with InputComponent), velocity is
    // derived from WASD input and oriented relative to the camera's facing direction.
    constructor(inputSystem, camera) {
        super();
        this.keys     = inputSystem.keys; // shared reference — stays in sync with InputSystem
        this.camera   = camera;           // used to orient movement relative to camera yaw
        this.inputVel = 10;               // movement speed (units/second)
    }

    update(em, delta) {
        for (const e of em.getWithComponentName('PositionComponent', 'VelocityComponent')) {

            const pos = e.getComponent('PositionComponent').position;
            const vel = e.getComponent('VelocityComponent').velocity;

            if (e.getComponent('InputComponent')) {
                // -1, 0, or 1 based on which keys are held
                const fwd  = Number(!!this.keys['KeyW']) - Number(!!this.keys['KeyS']);
                const side = Number(!!this.keys['KeyD']) - Number(!!this.keys['KeyA']);

                // project camera's forward/right onto the XZ plane so vertical
                // pitch doesn't affect horizontal movement speed
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                forward.y = 0;
                forward.normalize();

                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                right.y = 0;
                right.normalize();

                // combine forward/strafe into a single direction, then normalize
                // so diagonal movement isn't faster than cardinal movement
                vel.set(0, 0, 0)
                   .addScaledVector(forward, fwd)
                   .addScaledVector(right, side);

                if (vel.lengthSq() > 0) vel.normalize();
            }

            pos.addScaledVector(vel, this.inputVel * delta);
        }
    }
}

export class CollisionSystem extends System { // TODO
    constructor(camera, floor, collidableObjects) {
        super();
        this.camera            = camera;
        this.floor             = floor;
        this.collidableObjects = collidableObjects;
        this._grid             = new SpatialGrid({ cellSize: 4 });
        this._boxCache         = new Map();
    }

    update(em, delta) {
        const cam   = this.camera;
        const cache = this._boxCache;

        for (const e of em.getWithComponentName('TransformComponent', 'ShapeComponent', 'CollisionComponent')) {
            const t           = e.getComponent('TransformComponent');
            const collisionBox = e.getComponent('ShapeComponent').mesh;

            // Sync collision box to camera
            collisionBox.position.copy(cam.position);
            collisionBox.updateMatrixWorld(true);

            // Build spatial grid
            cache.clear();
            for (const obj of this.collidableObjects) {
                cache.set(obj, new THREE.Box3().setFromObject(obj));
            }
            this._grid.clear();
            for (const obj of this.collidableObjects) {
                this._grid.insert(obj, cache.get(obj));
            }

            const old        = t.prevPosition;
            const dx         = cam.position.x - old.x;
            const dy         = cam.position.y - old.y;
            const dz         = cam.position.z - old.z;
            const playerBox  = cache.get(collisionBox);
            const candidates = this._grid.query(playerBox);

            const boxCollides = (box) => {
                for (const c of candidates) {
                    if (c !== collisionBox && box.intersectsBox(cache.get(c))) return true;
                }
                return false;
            };

            const xCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(0,   -dy, -dz)));
            const yCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(-dx,  0,  -dz)));
            const zCollides = boxCollides(playerBox.clone().translate(new THREE.Vector3(-dx, -dy,  0)));

            if (xCollides) cam.position.x = old.x;
            if (yCollides) {
                t.velocity.y = 0;
                cam.position.y = old.y;
                t.isOnGround = true;
            }
            if (zCollides) cam.position.z = old.z;

            // Ground clamp
            const groundY = this.floor.position.y + 1.7;
            if (cam.position.y <= groundY) {
                cam.position.y = groundY;
                t.velocity.y = 0;
                t.isOnGround = true;
            }

            // Final sync
            collisionBox.position.copy(cam.position);
            t.position.copy(cam.position);
        }
    }
}



