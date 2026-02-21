import * as THREE from 'three';
import { Scene } from './Scene.js';
import { EntityManager } from './EntityManager.js';
import * as C from './Components.js';
import { getOBB, satOBB } from './utils.js';
import { preloadFireballModel, fireballComponents } from './Factories/FireballFactory.js';
import { zombieComponents } from './Factories/ZombieFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// config file for level data, not currently used but will be for loading different levels/worlds
const LEVEL_PATH = "";

// scenes hold all the game state and logic for a particular mode (e.g. main menu, gameplay, etc.)

/**
 * The main gameplay scene.
 *
 * Owns the Three.js scene graph, camera, entity manager, and all ECS systems.
 * Systems are implemented as methods (sCameraControl, sMovement, etc.) and called
 * each frame from update(). Input is read from this.input, which is populated by
 * _initInputListeners() and sDoAction().
 */
export class ScenePlay extends Scene {
    /**
     * @param {import('./GameEngine.js').GameEngine} gameEngine
     */
    constructor(gameEngine) {
        super(gameEngine);

        this.scene  = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.entityManager = new EntityManager();
        this.player = null;

        this.playerConfig = {
            x: 0, y: 2, z: 0,
            speed: 10,
            jumpStrength: 13,
            gravity: 20,
        };

        // Input state
        this.input = {
            keys:  { KeyW: false, KeyA: false, KeyS: false, KeyD: false, Space: false },
            mouse: { dx: 0, dy: 0, buttons: 0, locked: false },
        };

        // Camera control state
        this.camYaw   = 0;
        this.camPitch = 0;
        this.camRotSpeed = Math.PI / 2; // radians/sec for IJKL keys
        this.camLastFrameOverThreshold = false;

        // Render state
        this.addedMeshes = new Set();

        // Spawn state
        this.spawnCooldown = 0;
        this.toggleSpawn   = true;
    }

    /**
     * Called once by GameEngine.changeScene(). Registers action bindings, sets up raw
     * input listeners, and delegates world setup to loadLevel().
     * @param {string} [levelPath=LEVEL_PATH] - Path to a level file, or '' for the default scene.
     */
    init(levelPath = LEVEL_PATH) {

        // configure input actions and listeners
        this.registerAction('KeyW',   'moveForward');
        this.registerAction('KeyS',   'moveBackward');
        this.registerAction('KeyA',   'moveLeft');
        this.registerAction('KeyD',   'moveRight');
        this.registerAction('Space',  'jump');
        this.registerAction('Mouse0', 'attack');
        this.registerAction('KeyP',   'pause');

        this._initInputListeners();

        // set up lighting, entities, and world geometry
        this.loadLevel(levelPath);
    }

// ************************************************ INPUT LISTENER INIT ************************************************
    /**
     * Registers raw DOM event listeners that populate this.input each frame.
     * Mouse movement deltas are accumulated; the camera system drains them every frame.
     * Pointer lock state is tracked so mouse look is only applied when locked.
     */
    _initInputListeners() {
        document.addEventListener('keydown',   e => { this.input.keys[e.code] = true; });
        document.addEventListener('keyup',     e => { this.input.keys[e.code] = false; });
        document.addEventListener('mousemove', e => {
            this.input.mouse.dx += e.movementX;
            this.input.mouse.dy += e.movementY;
        });
        document.addEventListener('mousedown', e => { this.input.mouse.buttons |=  (1 << e.button); });
        document.addEventListener('mouseup',   e => { this.input.mouse.buttons &= ~(1 << e.button); });
        document.addEventListener('pointerlockchange', () => {
            this.input.mouse.locked = !!document.pointerLockElement;
        });
    }

// ********************************************* DEFAULT WORLD INITIALIZERS *********************************************

    /**
     * Adds ambient and directional (sun) lights to the Three.js scene.
     */
    _initDefaultLighting() {
        this.scene.add(new THREE.AmbientLight(0x404040, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        this.scene.add(sun);
    }

    /**
     * Spawns the default set of entities: player wizard, one zombie, and a static test box.
     */
    _initDefaultEntities() {
        this._initDefaultPlayer();
        this.spawnZombie(new THREE.Vector3(0, 1, -20));

        // Static collision box for testing
        const staticBox = this.entityManager.addEntity('staticBoxEntity');
        staticBox.addComponent(new C.PositionComponent(new THREE.Vector3(0, 1, -10)));
        staticBox.addComponent(new C.CollisionComponent());
        staticBox.addComponent(new C.MeshComponent(new THREE.Mesh(
            new THREE.BoxGeometry(1, 2, 1),
            new THREE.MeshStandardMaterial({ color: 0x8c7a5c })
        )));
    }

    /**
     * Creates the player entity (wizard) using playerConfig for spawn position.
     * Stores a reference in this.player.
     */
    _initDefaultPlayer() {
        const { x, y, z } = this.playerConfig;
        this.player = this.entityManager.addEntity('wizardEntity');
        this.player.addComponent(new C.InputComponent());
        this.player.addComponent(new C.PositionComponent(new THREE.Vector3(x, y, z)));
        this.player.addComponent(new C.VelocityComponent(new THREE.Vector3()));
        this.player.addComponent(new C.GravityComponent());
        this.player.addComponent(new C.CollisionComponent());
        this.player.addComponent(new C.HealthComponent());
        this.player.addComponent(new C.MeshComponent(new THREE.Mesh(
            new THREE.BoxGeometry(1, 2, 1),
            new THREE.MeshStandardMaterial({ color: 0x6a0dad })
        )));
    }

    /**
     * Builds the arena: a circular sand floor, invisible OBB walls arranged in a ring,
     * and decorative arch models loaded from a GLTF file.
     */
    _initDefaultWorld() {
        const ARENA_RADIUS   = 22;
        const WALL_THICKNESS = 1.2;
        const WALL_SEGMENTS  = 16;
        const WALL_HEIGHT    = 5;
        const SEGMENT_WIDTH  = (2 * Math.PI * ARENA_RADIUS) / WALL_SEGMENTS + 0.3;
        const SAND_COLOR     = 0xfddea5;
        const ARCH_COUNT     = 8;

        const r = ARENA_RADIUS - WALL_THICKNESS / 2;

        //floor
        const floor = this.entityManager.addEntity('floor');
        floor.addComponent(new C.PositionComponent(new THREE.Vector3(0, -5, 0)));
        floor.addComponent(new C.MeshComponent(
            new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, 10, 64),
                new THREE.MeshStandardMaterial({ color: SAND_COLOR })
            )
        ));
        floor.addComponent(new C.CollisionComponent(new THREE.Vector3(r, 5, r)));

        //bounding walls (invisible, just for collisions)
        const yAxis = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < WALL_SEGMENTS; i++) {
            const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
            const q = new THREE.Quaternion().setFromAxisAngle(yAxis, -angle - Math.PI / 2);

            const wallMesh = new THREE.Mesh(
                new THREE.BoxGeometry(SEGMENT_WIDTH, WALL_HEIGHT * 2, WALL_THICKNESS),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            wallMesh.quaternion.copy(q); // no RotationComponent, so RenderSystem won't override this

            const wall = this.entityManager.addEntity('arenaWall');
            wall.addComponent(new C.PositionComponent(
                new THREE.Vector3(
                    Math.cos(angle) * ARENA_RADIUS,
                    WALL_HEIGHT,
                    Math.sin(angle) * ARENA_RADIUS
                )
            ));
            wall.addComponent(new C.CollisionComponent(
                new THREE.Vector3(
                    SEGMENT_WIDTH / 2,   // half-width along tangent
                    WALL_HEIGHT,         // half-height
                    WALL_THICKNESS / 2   // half-depth along radial
                ),
                q                        // rotation aligns local Z with the outward radial
            ));
            wall.addComponent(new C.MeshComponent(wallMesh));
        }

        //arches on outside
        const loader = new GLTFLoader();
        loader.load(
            '../models/arch.glb',
            (gltf) => {
                for (let i = 0; i < ARCH_COUNT; i++) {
                    const angle = (i / ARCH_COUNT) * Math.PI * 2;
                    const arch = gltf.scene.clone();
                    arch.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                    arch.rotation.y = -angle + Math.PI / 2;
                    arch.scale.set(0.5, 0.5, 0.5);
                    this.scene.add(arch);
                }
            },
            undefined,
            (error) => console.error(error)
        );
}

// ************************************************ ENTITY SPAWNERS ************************************************
// called by systems to spawn entities with the appropriate components for their intended behavior

    /**
     * Creates a new fireball entity and populates it via fireballComponents().
     * @param {THREE.Vector3} origin    - World position to spawn the fireball at.
     * @param {THREE.Vector3} direction - Direction of travel (will be normalised inside the factory).
     */
    spawnFireball(origin, direction) {
        fireballComponents(this.entityManager.addEntity('fireballEntity'), origin, direction);
    }

    /**
     * Creates a new zombie entity and populates it via zombieComponents().
     * @param {THREE.Vector3} position - World position to spawn the zombie at.
     */
    spawnZombie(position) {
        zombieComponents(this.entityManager.addEntity('zombieEntity'), position);
    }

// ************************************************ LEVEL LOADER ************************************************

    /**
     * Initialises the scene from a level file or falls back to the default scene.
     * Currently only the default path is implemented; file-based loading is a stub.
     * @param {string} [filename=''] - Path to a level description file. Pass '' for defaults.
     */
    loadLevel(filename="") {
        if (filename) {

        } else {
            this._initDefaultLighting();
            this._initDefaultEntities();
            this._initDefaultWorld();
            preloadFireballModel();
        }
    }

    // ************************************************ MAIN UPDATE LOOP ************************************************
    /**
     * Called once per frame by GameEngine. Runs mesh cleanup, entity bookkeeping,
     * and all active game systems in order.
     * @param {number} delta - Elapsed time in seconds since the last frame.
     */
    update(delta) {
        // remove THREE meshes for dying entities before EntityManager prunes them
        for (const e of this.entityManager.getEntities()) {
            if (!e.isActive()) {
                const mesh = e.getComponent('MeshComponent')?.mesh;
                if (mesh) {
                    this.scene.remove(mesh);
                    this.addedMeshes.delete(mesh);
                }
            }
        }

        // process entitiesToAdd and remove dead entities
        this.entityManager.update();

        // run game systems only if not paused (except rendering)
        if (!this.isPaused) {
            this.sCameraControl();
            this.sMovement(delta);
            this.sGravity(delta);
            this.sCollision();
            this.sLifespan(delta);
        }

        this.sRender();
    }

    // ************************************************ SYSTEMS ************************************************

    /**
     * Reads mouse movement and keyboard camera keys to update camYaw/camPitch,
     * then applies the resulting quaternion to the camera and syncs its position
     * to the player wizard's world position.
     *
     * Large mouse deltas on the first frame after pointer lock is acquired are
     * discarded to prevent camera jump artifacts.
     */
    sCameraControl() {
        const keys = this.input.keys;
        const sensitivity = 0.002;
        const deltaThreshold = 200;

        if (this.input.mouse.locked) {
            let dx = this.input.mouse.dx;
            let dy = this.input.mouse.dy;
            const over = Math.abs(dx) > deltaThreshold || Math.abs(dy) > deltaThreshold;
            // skip first frame over threshold to prevent camera jumps on pointer lock acquire
            if (over && !this.camLastFrameOverThreshold) { dx = 0; dy = 0; }
            this.camLastFrameOverThreshold = over;
            this.camYaw   -= dx * sensitivity;
            this.camPitch -= dy * sensitivity;
        }
        // consume mouse deltas
        this.input.mouse.dx = 0;
        this.input.mouse.dy = 0;

        // clamp pitch to prevent flipping
        this.camPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camPitch));
        this.camera.quaternion.setFromEuler(new THREE.Euler(this.camPitch, this.camYaw, 0, 'YXZ'));

        // sync camera position to wizard
        const wizPos = this.entityManager.getWithID(0)?.getComponent('PositionComponent');
        if (wizPos) this.camera.position.copy(wizPos.position);
    }

    /**
     * Moves all entities that have both PositionComponent and VelocityComponent.
     * - InputComponent entities: WASD translates the player relative to camera facing;
     *   Space triggers a jump when isOnGround is true.
     * - All other entities: position is advanced by velocity * delta each frame.
     * @param {number} delta - Elapsed seconds since last frame.
     */
    sMovement(delta) {
        const keys = this.input.keys;
        const inputVel = this.playerConfig.speed;

        for (const e of this.entityManager.getWithComponentName('PositionComponent', 'VelocityComponent')) {
            const posComp = e.getComponent('PositionComponent');
            const pos = posComp.position;
            const vel = e.getComponent('VelocityComponent').velocity;

            if (e.getComponent('InputComponent')) {
                const fwd  = Number(!!keys['KeyW']) - Number(!!keys['KeyS']); // TODO: remove hardcoding of input keys
                const side = Number(!!keys['KeyD']) - Number(!!keys['KeyA']);

                // project camera forward/right onto XZ so pitch doesn't affect speed
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                forward.y = 0;
                forward.normalize();

                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                right.y = 0;
                right.normalize();

                const move = new THREE.Vector3()
                    .addScaledVector(forward, fwd)
                    .addScaledVector(right, side);

                if (move.lengthSq() > 0) move.normalize();
                pos.addScaledVector(move, inputVel * delta);

                if (keys['Space'] && posComp.isOnGround) { // TODO: make collision system manage isOnGround
                    vel.y = this.playerConfig.jumpStrength;
                }
            } else {
                pos.addScaledVector(vel, delta);
            }
        }
    }

    /**
     * Applies gravity to all entities with GravityComponent.
     * Accumulates downward velocity over time and integrates position.
     * Gravity is only applied when the entity is not on the ground.
     * @param {number} delta - Elapsed seconds since last frame.
     */
    sGravity(delta) {
        for (const e of this.entityManager.getWithComponentName('PositionComponent', 'VelocityComponent', 'GravityComponent')) {
            const posComp = e.getComponent('PositionComponent');
            const velComp = e.getComponent('VelocityComponent');

            if (!posComp.isOnGround) {
                velComp.velocity.y -= this.playerConfig.gravity * delta;
                posComp.position.addScaledVector(velComp.velocity, delta);
            }
        }
    }

    /**
     * Runs SAT OBB collision detection over all entity pairs and resolves penetrations.
     *
     * Per frame:
     * 1. Resets isOnGround to false for every dynamic entity.
     * 2. Tests every pair of entities with CollisionComponent + PositionComponent.
     * 3. If a CombustibleComponent entity collides with a non-player, it is destroyed
     *    and the other entity loses 30 HP.
     * 4. Pushes dynamic entities out of static geometry using the MTV.
     *    - Upward MTV on a dynamic entity → sets isOnGround = true and zeroes vertical velocity.
     *    - Both dynamic → XZ penetration is split equally; Y goes to the entity pushed upward.
     */
    sCollision() {
        // Reset isOnGround each frame; re-set to true only when a floor collision is detected.
        for (const e of this.entityManager.getWithComponentName('PositionComponent', 'VelocityComponent')) {
            e.getComponent('PositionComponent').isOnGround = false;
        }

        const entities = this.entityManager.getWithComponentName('CollisionComponent', 'PositionComponent');

        //TODO: Replace with spatial grid
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const a = entities[i];
                const b = entities[j];

                const mtv = satOBB(getOBB(a), getOBB(b));
                if (!mtv) continue;

                if (a.getComponent('CombustibleComponent')) {
                    if (b.id !== 0) {
                        a.destroy();
                        if (b.getComponent('HealthComponent')) {
                            b.getComponent('HealthComponent').hp -= 30;
                            console.log(b.getComponent('HealthComponent').hp);
                            console.log("combusted", a.id);
                        }
                    } else { continue; }
                }
                if (b.getComponent('CombustibleComponent')) {
                    if (a.id !== 0) {
                        b.destroy();
                        if (a.getComponent('HealthComponent')) {
                            a.getComponent('HealthComponent').hp -= 30;
                            console.log(a.getComponent('HealthComponent').hp);
                            console.log("combusted", b.id);
                        }
                    } else { continue; }
                }

                const aDynamic = !!a.getComponent('VelocityComponent');
                const bDynamic = !!b.getComponent('VelocityComponent');
                const yDominant = Math.abs(mtv.y) > Math.abs(mtv.x) && Math.abs(mtv.y) > Math.abs(mtv.z);

                if (aDynamic && bDynamic) {
                    const posA = a.getComponent('PositionComponent').position;
                    const posB = b.getComponent('PositionComponent').position;
                    if (yDominant) {
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
                        // XZ: split push between both
                        posA.x += mtv.x * 0.5;  posA.z += mtv.z * 0.5;
                        posB.x -= mtv.x * 0.5;  posB.z -= mtv.z * 0.5;
                    }
                } else if (aDynamic) {
                    const posA = a.getComponent('PositionComponent').position;
                    posA.add(mtv);
                    if (mtv.y > 0) {
                        a.getComponent('VelocityComponent').velocity.y = 0;
                        a.getComponent('PositionComponent').isOnGround = true;
                    }
                } else if (bDynamic) {
                    const posB = b.getComponent('PositionComponent').position;
                    posB.sub(mtv);
                    if (mtv.y < 0) {
                        b.getComponent('VelocityComponent').velocity.y = 0;
                        b.getComponent('PositionComponent').isOnGround = true;
                    }
                }
            }
        }
    }

    /**
     * Decrements LifespanComponent timers and destroys expired entities.
     * Also destroys any entity whose HP has dropped to zero or below.
     * @param {number} delta - Elapsed seconds since last frame.
     */
    sLifespan(delta) {
        // destroy entities with expired lifespan
        for (const e of this.entityManager.getWithComponentName('LifespanComponent')) {
            const lifespanComp = e.getComponent('LifespanComponent');
            lifespanComp.decrement(delta);
            if (lifespanComp.secondsLeft <= 0) e.destroy();
        }

        // destroy entities with 0 or less health
        for (const e of this.entityManager.getWithComponentName('HealthComponent')) {
            if (e.getComponent('HealthComponent').hp <= 0) e.destroy();
        }
    }

    /**
     * Syncs Three.js mesh transforms to ECS component data and lazy-adds new meshes
     * to the Three.js scene on their first appearance.
     * PositionComponent drives mesh.position; RotationComponent drives mesh.rotation.
     */
    sRender() {
        for (const entity of this.entityManager.getWithComponentName('MeshComponent')) {
            const meshComp = entity.getComponent('MeshComponent');
            if (!meshComp.mesh) continue;

            // add to scene on first appearance
            if (!this.addedMeshes.has(meshComp.mesh)) {
                this.scene.add(meshComp.mesh);
                this.addedMeshes.add(meshComp.mesh);
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) meshComp.mesh.position.copy(position);

            const rotation = entity.getComponent('RotationComponent');
            if (rotation != null) meshComp.mesh.rotation.set(rotation.yaw, rotation.pitch, rotation.roll);
        }
    }

    /**
     * Handles discrete game actions dispatched by GameEngine (via the actionMap).
     * - 'pause' start → toggles isPaused.
     * - 'attack' start → spawns a fireball along the camera's look direction.
     * @param {import('./Action.js').Action} action
     */
    sDoAction(action) {

        if (action.name === 'pause' && action.type === 'start') {
            this.isPaused = !this.isPaused;
        }
        if (action.name === 'attack' && action.type === 'start') {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            const origin = this.camera.position.clone().addScaledVector(direction, 0.6);
            this.spawnFireball(origin, direction);
        }
    }
}
