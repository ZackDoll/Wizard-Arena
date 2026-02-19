import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'; //unneeded?
import { getOBB, projectOBB, obbAxes, satOBB } from './utils.js';

const GRAVITY    = 20;  // units/sec²
const JUMP_FORCE = 13;   // units/sec

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
            'KeyA': false,
            'KeyS': false,
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

            const posComp = e.getComponent('PositionComponent');
            const pos = posComp.position;
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

                //XZ movement
                const move = new THREE.Vector3()
                    .addScaledVector(forward, fwd)
                    .addScaledVector(right, side);

                if (move.lengthSq() > 0) move.normalize();
                pos.addScaledVector(move, this.inputVel * delta);

                //can jump when grounded and space is pressed
                if (this.keys['Space'] && posComp.isOnGround) {
                    vel.y = JUMP_FORCE;
                }
            } else {
                pos.addScaledVector(vel, delta);
            }
        }
    }
}


export class CollisionSystem extends System {
    constructor() {
        super();
    }

    update(em, delta) {
        const entities = em.getWithComponentName('CollisionComponent', 'PositionComponent');

        //TODO: Replace with spatial grid
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const a = entities[i];
                const b = entities[j];

                const obbA = getOBB(a);
                const obbB = getOBB(b);

                const mtv = satOBB(obbA, obbB);
                if (!mtv) continue;

                const aDynamic = !!a.getComponent('VelocityComponent');
                const bDynamic = !!b.getComponent('VelocityComponent');

                // Y is dominant when the MTV is more vertical than horizontal
                const yDominant = Math.abs(mtv.y) > Math.abs(mtv.x) && Math.abs(mtv.y) > Math.abs(mtv.z);

                if (aDynamic && bDynamic) {
                    const posA = a.getComponent('PositionComponent').position;
                    const posB = b.getComponent('PositionComponent').position;
                    if (yDominant) {
                        // Y collision: only move the entity on top
                        if (mtv.y > 0) {
                            posA.y += mtv.y;
                            a.getComponent('VelocityComponent').velocity.y = 0;
                            a.getComponent('PositionComponent').isOnGround = true;
                        } else {
                            posB.y -= mtv.y;
                            b.getComponent('VelocityComponent').velocity.y = 0;
                            b.getComponent('PositionComponent').isOnGround = true;
                        }
                    } else {
                        // XZ collision: split push between both
                        posA.x += mtv.x * 0.5;  posA.z += mtv.z * 0.5;
                        posB.x -= mtv.x * 0.5;  posB.z -= mtv.z * 0.5;
                    }
                } else if (aDynamic) {
                    const posA = a.getComponent('PositionComponent').position;
                    posA.add(mtv);
                    if (mtv.y > 0) { // A landed on top of B
                        a.getComponent('VelocityComponent').velocity.y = 0;
                        a.getComponent('PositionComponent').isOnGround = true;
                    }
                } else if (bDynamic) {
                    const posB = b.getComponent('PositionComponent').position;
                    posB.sub(mtv);
                    if (mtv.y < 0) { // B landed on top of A
                        b.getComponent('VelocityComponent').velocity.y = 0;
                        b.getComponent('PositionComponent').isOnGround = true;
                    }
                }
            }
        }
    }
}

export class GravitySystem extends System {
    constructor() {
        super();
    }

    update(em, delta) {
        for (const e of em.getWithComponentName('PositionComponent', 'VelocityComponent', 'GravityComponent')) {
            const posComp = e.getComponent('PositionComponent');
            const vel = e.getComponent('VelocityComponent').velocity;

            posComp.isOnGround = false; // reset each frame; CollisionSystem sets true if grounded

            // apply gravity
            vel.y -= GRAVITY * delta;

            // apply vertical velocity to position
            posComp.position.y += vel.y * delta;
        }
    }
}




