import * as THREE from 'three';
import { Scene } from './Scene.js';
import { EntityManager } from './EntityManager.js';
import * as C from './Components.js';
import { getOBB, satOBB } from './utils.js';
import { setFireballComponents } from './Factories/FireballFactory.js';
import { setZombieComponents } from './Factories/ZombieFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SceneDeath } from './SceneDeath.js';
import { NavigationGrid, findPath } from './NavigationGrid.js';

// config file for level data, not currently used but will be for loading different levels/worlds
const LEVEL_PATH = "";

// zombie speed starts at 1 and increases by 0.2 per kill with no cap
const ZOMBIE_START_SPEED    = 1;
const ZOMBIE_SPEED_PER_KILL = 0.2;

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
            x: 0, y: 5, z: 0,
            speed: 10,
            jumpStrength: 11,
            gravity: 24,
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
        this.addedLights = new Set();

        // Fireball spawn cooldown state
        this.spawnCooldown = 0;

        // Time elapsed since game started
        this.elapsedTime = 0;

        this.zombieSpeed = ZOMBIE_START_SPEED;

        // Zombie spawner
        this.zombieCount = 0;
        this.zombieSpawnTimer = 0;

        // Player invulnerable time after getting hit by a zombie
        this.playerInvulnTime = 0.5;

        // Amount of zombies the player killed
        this.playerKills = 0;
        this.scoreEl     = document.getElementById('score');
        this.healthBarEl = document.getElementById('health-bar');
        this.healthBarContainerEl = document.getElementById('health-bar-container');
    }

    /**
     * Called once by GameEngine.changeScene(). Registers action bindings, sets up raw
     * input listeners, and delegates world setup to loadLevel().
     * @param {string} [levelPath=LEVEL_PATH] - Path to a level file, or '' for the default scene.
     */
    init(levelPath = LEVEL_PATH) {

        if (this.scoreEl) { this.scoreEl.style.display = 'block'; this.scoreEl.textContent = 'Score: 0'; }
        if (this.healthBarContainerEl) this.healthBarContainerEl.style.display = 'block';
        if (this.healthBarEl) this.healthBarEl.style.width = '100%';

        // map input to game actions
        this.registerAction('KeyW',   'moveForward');
        this.registerAction('KeyS',   'moveBackward');
        this.registerAction('KeyA',   'moveLeft');
        this.registerAction('KeyD',   'moveRight');
        this.registerAction('Space',  'jump');
        this.registerAction('Mouse0', 'attack');
        this.registerAction('KeyP',   'pause');

        // set up raw input listeners that populate this.input each frame; sDoAction will read from this.input to perform actions
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
     * Sets the arena atmosphere (sky color, perimeter fog) and adds lights to the Three.js scene.
     * Sky is a deep purple; fog is linear and dense enough to obscure beyond the arena walls (~22 units).
     */
    _initDefaultLighting() {
        // Pink/purple sky background
        this.scene.background = new THREE.Color(0x1e0b33);

        // Linear fog: starts at 16 units, fully opaque at 28 — wraps the arena perimeter in mist
        this.scene.fog = new THREE.Fog(0x000000, 16, 28);

        // Near-zero ambient — arena is very dark outside the central light pool
        this.scene.add(new THREE.AmbientLight(0x1a0a2e, 0.02));

        // Central overhead point light — tight falloff creates a bright pool at centre,
        // darkness at the edges; shadows radiate outward from the source
        const keyLight = new THREE.PointLight(0xffeedd, 120, 30, 2);
        keyLight.position.set(0, 14, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far  = 30;
        keyLight.shadow.bias = 0.0;
        keyLight.shadow.normalBias = 0.5;
        this.scene.add(keyLight);
    }

    /**
     * Spawns the default set of entities: player wizard, one zombie, and a static test box.
     */
    _initDefaultEntities() {
        this._initDefaultPlayer();

        const position = new THREE.Vector3(0, 0.75, -20);
        this.spawnZombie({position});
        this.spawnZombie({position: new THREE.Vector3(5, 0.75, -10)});

        // Static obstacles — height 6 blocks max jump (~4.2 units)
        const H = 6;
        const OBSTACLE_MAT = new THREE.MeshStandardMaterial({ color: 0x8c7a5c });
        const obstacles = [
            { pos: new THREE.Vector3( 0,  (H/2) - 2, 0), w: 1, d: 5 },
            // Centre cross walls
            { pos: new THREE.Vector3( 0,  (H/2) - 3.5, -12), w: 6, d: 1 },
            { pos: new THREE.Vector3( 0,  (H/2) - 3.5,  12), w: 6, d: 1 },
            //{ pos: new THREE.Vector3(-10, H/2,   0), w: 1, d: 6 },
            //{ pos: new THREE.Vector3( 10, H/2,   0), w: 1, d: 6 },
            // Diagonal pillars
            { pos: new THREE.Vector3(-7, H/2,  -5), w: 2, d: 2 },
            { pos: new THREE.Vector3( 7, H/2,  -5), w: 2, d: 2},
            { pos: new THREE.Vector3(-7, H/2,   5), w: 2, d: 2 },
            { pos: new THREE.Vector3( 7, H/2,   5), w: 2, d: 2 },
            // Outer ring pillars
            //{ pos: new THREE.Vector3(-14, H/2, -8), w: 2, d: 2 },
            //{ pos: new THREE.Vector3( 14, H/2, -8), w: 2, d: 2 },
            //{ pos: new THREE.Vector3(-14, H/2,  8), w: 2, d: 2 },
            //{ pos: new THREE.Vector3( 14, H/2,  8), w: 2, d: 2 },
            //{ pos: new THREE.Vector3(  0, H/2, -17), w: 4, d: 1 },
            //{ pos: new THREE.Vector3(  0, H/2,  17), w: 4, d: 1 },
        ];
        for (const { pos, w, d } of obstacles) {
            const e = this.entityManager.addEntity('staticBoxEntity');
            e.addComponent(new C.PositionComponent(pos));
            e.addComponent(new C.CollisionComponent(new THREE.Vector3(w / 2, H / 2, d / 2)));
            e.addComponent(new C.MeshComponent(new THREE.Mesh(
                new THREE.BoxGeometry(w, H, d),
                OBSTACLE_MAT
            )));
        }
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
        const playerGeo = new THREE.BoxGeometry(1, 2, 1);
        playerGeo.translate(0, 0.4, 0);
        this.player.addComponent(new C.MeshComponent(new THREE.Mesh(
            playerGeo,
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
        const WALL_SEGMENTS  = 64;
        const WALL_HEIGHT    = 5;
        const SEGMENT_WIDTH  = (2 * Math.PI * ARENA_RADIUS) / WALL_SEGMENTS + 0.3;
        const SAND_COLOR     = 0x706653;
        const ARCH_COUNT     = 8;

        

        const r = ARENA_RADIUS - WALL_THICKNESS / 2;

        const brickNormal = this.gameEngine.assets.getNormalMap('brick');
        if (brickNormal) {
            brickNormal.wrapS = brickNormal.wrapT = THREE.RepeatWrapping;
        }

        const WALL_MAT = new THREE.MeshStandardMaterial({
            color: SAND_COLOR,
            normalMap: brickNormal ?? null,
            normalScale: new THREE.Vector2(1.5, 1.5),
            roughness: 0.9,
        });
        if (brickNormal) WALL_MAT.normalMap.repeat.set(0.5, 4);

        const FLOOR_MAT = new THREE.MeshStandardMaterial({
            color: SAND_COLOR,
            normalMap: brickNormal ?? null,
            normalScale: new THREE.Vector2(1.2, 1.2),
            roughness: 0.85,
        });
        if (brickNormal) FLOOR_MAT.normalMap.repeat.set(12, 12);

        //floor
        const floor = this.entityManager.addEntity('floor');
        floor.addComponent(new C.PositionComponent(new THREE.Vector3(0, -5, 0)));
        floor.addComponent(new C.MeshComponent(
            new THREE.Mesh(
                new THREE.CylinderGeometry(r + 1.5, r + 1.5, 10, 64),
                FLOOR_MAT
            )
        ));
        floor.addComponent(new C.CollisionComponent(new THREE.Vector3(r, 5, r)));

        
        // Dome ceiling — hemisphere sitting on top of the walls
        const domeNormal = brickNormal ? brickNormal.clone() : null;
        if (domeNormal) {
            domeNormal.wrapS = domeNormal.wrapT = THREE.RepeatWrapping;
            domeNormal.repeat.set(6, 3);
            domeNormal.needsUpdate = true;
        }
        const DOME_MAT = new THREE.MeshStandardMaterial({
            color: SAND_COLOR,
            normalMap: domeNormal,
            normalScale: new THREE.Vector2(1.5, 1.5),
            roughness: 0.9,
            side: THREE.BackSide,
        });
        const dome = this.entityManager.addEntity('dome');
        dome.addComponent(new C.PositionComponent(new THREE.Vector3(0, WALL_HEIGHT * 2, 0)));
        dome.addComponent(new C.MeshComponent(
            new THREE.Mesh(new THREE.SphereGeometry(ARENA_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), DOME_MAT),
            false, // castShadow=false — BackSide dome must not cast shadows into the arena interior
            true
        ));

        //bounding walls (invisible, just for collisions)
        const yAxis = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < WALL_SEGMENTS; i++) {
            const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
            const q = new THREE.Quaternion().setFromAxisAngle(yAxis, -angle - Math.PI / 2);

            const wallMesh = new THREE.Mesh(
                new THREE.BoxGeometry(SEGMENT_WIDTH, WALL_HEIGHT * 2, WALL_THICKNESS),
                WALL_MAT
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

        // torches — point lights evenly spaced just inside the arena wall
        const TORCH_COUNT  = 8;
        const TORCH_RADIUS = ARENA_RADIUS - 2.5;
        const TORCH_HEIGHT = 2.5;
        const torchGeo = this.gameEngine.assets.getGeometry('torch');
        const torchMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c });

        const TORCH_SCALE = 0.01;
        const TORCH_TANGENT_OFFSET = 8;

        for (let i = 0; i < TORCH_COUNT; i++) {
            const angle = (i / TORCH_COUNT) * Math.PI * 2;
            const torch = this.entityManager.addEntity('torch');
            torch.addComponent(new C.PositionComponent(new THREE.Vector3(
                Math.cos(angle) * TORCH_RADIUS - Math.sin(angle) * TORCH_TANGENT_OFFSET,
                TORCH_HEIGHT,
                Math.sin(angle) * TORCH_RADIUS + Math.cos(angle) * TORCH_TANGENT_OFFSET
            )));
            torch.addComponent(new C.LightComponent(0xff6a00, 2, 14));
            if (torchGeo) {
                const mesh = new THREE.Mesh(torchGeo, torchMat);
                mesh.scale.setScalar(TORCH_SCALE);
                const baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
                const tangential = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
                const tiltQ = new THREE.Quaternion().setFromAxisAngle(tangential, Math.PI / 9);
                mesh.quaternion.multiplyQuaternions(tiltQ, baseQ);
                torch.addComponent(new C.MeshComponent(mesh));
            }
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


// data object should include any components that need to be configured (e.g. position, direction) and will be populated with the created entity and assets reference

    onEnd() {
        super.onEnd();
        if (this.scoreEl) this.scoreEl.style.display = 'none';
        if (this.healthBarContainerEl) this.healthBarContainerEl.style.display = 'none';
    }

    spawnFireball(data) {
        data.entity = this.entityManager.addEntity('fireball');
        data.assets = this.gameEngine.assets;
        setFireballComponents(data);
    }

    spawnZombie(data) {
        data.entity = this.entityManager.addEntity('zombie');
        data.assets = this.gameEngine.assets;
        setZombieComponents(data);
        this.zombieCount += 1;
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
            this._initDefaultEntities();
            this._initDefaultWorld();
            this._initDefaultLighting();
            // Build navigation grid after world is set up.
            // Register static obstacle footprints (XZ) so A* avoids them.
            this.navGrid = new NavigationGrid(20, [
                // Centre cross walls
                { minX: -3,   maxX:  3,   minZ: -10.5, maxZ:  -9.5 },
                { minX: -3,   maxX:  3,   minZ:   9.5, maxZ:  10.5 },
                { minX: -10.5,maxX: -9.5, minZ:  -3,   maxZ:   3   },
                { minX:  9.5, maxX: 10.5, minZ:  -3,   maxZ:   3   },
                // Diagonal pillars
                { minX: -7.5, maxX: -6.5, minZ:  -7,   maxZ:  -3   },
                { minX:  6.5, maxX:  7.5, minZ:  -7,   maxZ:  -3   },
                { minX: -7.5, maxX: -6.5, minZ:   3,   maxZ:   7   },
                { minX:  6.5, maxX:  7.5, minZ:   3,   maxZ:   7   },
                // Outer ring pillars
                { minX: -15,  maxX: -13,  minZ:  -9,   maxZ:  -7   },
                { minX:  13,  maxX:  15,  minZ:  -9,   maxZ:  -7   },
                { minX: -15,  maxX: -13,  minZ:   7,   maxZ:   9   },
                { minX:  13,  maxX:  15,  minZ:   7,   maxZ:   9   },
                { minX: -2,   maxX:  2,   minZ: -17.5, maxZ: -16.5 },
                { minX: -2,   maxX:  2,   minZ:  16.5, maxZ:  17.5 },
            ]);
        }
    }

    // ************************************************ MAIN UPDATE LOOP ************************************************
    /**
     * Called once per frame by GameEngine. Runs mesh cleanup, entity bookkeeping,
     * and all active game systems in order.
     * @param {number} delta - Elapsed time in seconds since the last frame.
     */
    update(delta) {
        // remove THREE objects for dying entities before EntityManager prunes them
        for (const e of this.entityManager.getEntities()) {
            if (!e.isActive()) {
                const mesh = e.getComponent('MeshComponent')?.mesh;
                if (mesh) {
                    this.scene.remove(mesh);
                    this.addedMeshes.delete(mesh);
                }
                const light = e.getComponent('LightComponent')?.light;
                if (light) {
                    this.scene.remove(light);
                    this.addedLights.delete(light);
                }

                if (e.tag === 'zombie') {
                    this.zombieCount -= 1;
                    this.playerKills += 1;
                    if (this.scoreEl) this.scoreEl.textContent = `Score: ${this.playerKills * 100}`;
                }
                if (e.tag === 'wizardEntity') {
                    this.onEnd();
                    this.gameEngine.changeScene(new SceneDeath(this.gameEngine, this.playerKills * 100));
                    return;
                }
            }
        }

        // process entitiesToAdd and remove dead entities
        this.entityManager.update();

        // run game systems only if not paused (except rendering)
        if (!this.isPaused) {
            this.sCameraControl();
            this.sZombieSpawn(delta);
            this.sZombieAI(delta);
            this.sMovement(delta);
            this.sGravity(delta);
            this.sCollision();
            this.sLifespan(delta);
            this.sAnimation(delta);
            this.spawnCooldown -= delta;
            this.playerInvulnTime -= delta;
            this.elapsedTime += delta;
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

    sZombieSpawn(delta) {
        // Config
        const SPAWN_INTERVAL   = 10;       // seconds between waves
        const ZOMBIES_PER_WAVE = 3;       // zombies per wave (can scale with elapsedTime)
        const SPAWN_RADIUS     = 12;       // how far from player zombies appear
        const ARENA_RADIUS     = 20.5;    // slightly inside wall to avoid clipping

        if (!this.player) return;

        this.zombieSpawnTimer -= delta;
        if (this.zombieCount <= 0) this.zombieSpawnTimer = 0;
        if (this.zombieSpawnTimer > 0) return;
        this.zombieSpawnTimer = SPAWN_INTERVAL;

        const playerPos = this.player.getComponent('PositionComponent')?.position;
        if (!playerPos) return;

        // Scale zombies per wave with time
        const waveSize = (this.elapsedTime <= 225) ? ZOMBIES_PER_WAVE + Math.floor(this.elapsedTime / 45) : 8;

        for (let i = 0; i < waveSize; i++) {
            // Pick a random angle and spawn at SPAWN_RADIUS away from player
            const angle = Math.random() * Math.PI * 2;
            let sx = playerPos.x + Math.cos(angle) * SPAWN_RADIUS;
            let sz = playerPos.z + Math.sin(angle) * SPAWN_RADIUS;

            // Clamp to arena circle: if outside, project back onto the boundary
            const distFromCenter = Math.sqrt(sx * sx + sz * sz);
            if (distFromCenter > ARENA_RADIUS) {
                const scale = ARENA_RADIUS / distFromCenter;
                sx *= scale;
                sz *= scale;
            }

            this.spawnZombie({
                position: new THREE.Vector3(sx, 0.75, sz)
            });
        }
    }

    /**
     * Simple AI system: move zombies toward the player by setting their XZ velocity.
     * Also rotates the zombie mesh to face movement direction.
     * @param {number} delta - Elapsed seconds since last frame.
     */
    sZombieAI(delta) {
        if (!this.player) return;
        const playerPos = this.player.getComponent('PositionComponent')?.position;
        if (!playerPos) return;

        this.zombieSpeed = ZOMBIE_START_SPEED + this.playerKills * ZOMBIE_SPEED_PER_KILL;

        const PATH_RECOMPUTE_INTERVAL = 0.5;
        const WAYPOINT_REACH_DIST_SQ  = 0.6 * 0.6;

        const zombies = this.entityManager.getEntitiesWithTag('zombie');
        for (const z of zombies) {
            if (!z.isActive()) continue;
            const posComp  = z.getComponent('PositionComponent');
            const velComp  = z.getComponent('VelocityComponent');
            const pathComp = z.getComponent('PathComponent');
            if (!posComp || !velComp) continue;

            // ── A* path update ──────────────────────────────────────────
            if (pathComp && this.navGrid) {
                pathComp.recomputeTimer -= delta;
                if (pathComp.recomputeTimer <= 0) {
                    pathComp.waypoints = findPath(this.navGrid, posComp.position, playerPos);
                    pathComp.recomputeTimer = PATH_RECOMPUTE_INTERVAL;
                }
                // advance past waypoints the zombie has reached
                while (pathComp.waypoints.length > 0) {
                    const wp = pathComp.waypoints[0];
                    const dx = wp.x - posComp.position.x;
                    const dz = wp.z - posComp.position.z;
                    if (dx * dx + dz * dz < WAYPOINT_REACH_DIST_SQ) {
                        pathComp.waypoints.shift();
                    } else {
                        break;
                    }
                }
            }

            // ── steer toward next waypoint (or player directly) ─────────
            const target = (pathComp?.waypoints?.length > 0)
                ? pathComp.waypoints[0]
                : playerPos;

            const toTarget = new THREE.Vector3(
                target.x - posComp.position.x,
                0,
                target.z - posComp.position.z
            );
            const distSq = toTarget.lengthSq();
            if (distSq < 0.01) {
                velComp.velocity.x = 0;
                velComp.velocity.z = 0;
            } else {
                toTarget.normalize();
                velComp.velocity.x = toTarget.x * this.zombieSpeed;
                velComp.velocity.z = toTarget.z * this.zombieSpeed;
            }

            // smoothly rotate mesh to face movement direction
            const meshComp = z.getComponent('MeshComponent');
            if (meshComp?.mesh) {
                const MODEL_FORWARD = new THREE.Vector3(0, 0, 1);
                const facing = new THREE.Vector3(velComp.velocity.x, 0, velComp.velocity.z);
                if (facing.lengthSq() > 0) {
                    facing.normalize();
                    const targetQ = new THREE.Quaternion().setFromUnitVectors(MODEL_FORWARD, facing);
                    meshComp.mesh.quaternion.slerp(targetQ, Math.min(1, delta * 8));
                }
            }
        }
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
        const MAX_FALL_SPEED = 30;
        for (const e of this.entityManager.getWithComponentName('PositionComponent', 'VelocityComponent', 'GravityComponent')) {
            const posComp = e.getComponent('PositionComponent');
            const velComp = e.getComponent('VelocityComponent');

            if (posComp.isOnGround) {
                if (velComp.velocity.y < 0) velComp.velocity.y = 0;
            } else {
                velComp.velocity.y -= this.playerConfig.gravity * delta;
                velComp.velocity.y = Math.max(velComp.velocity.y, -MAX_FALL_SPEED);
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

                if (((a.tag == "wizardEntity" && b.tag == "zombie") || (b.tag == "wizardEntity" && a.tag == "zombie")) && this.playerInvulnTime <= 0) {
                    const hpComp = this.player.getComponent('HealthComponent');
                    hpComp.hp -= 10;
                    this.playerInvulnTime = 0.75;
                    if (this.healthBarEl) this.healthBarEl.style.width = `${Math.max(0, (hpComp.hp / hpComp.maxHp) * 100)}%`;
                }
                
                if (a.getComponent('CombustibleComponent')) {
                    if (b.id !== 0) {
                        a.destroy();
                        if (b.getComponent('HealthComponent')) {
                            b.getComponent('HealthComponent').hp -= 50;
                        }
                    } else { continue; }
                }
                if (b.getComponent('CombustibleComponent')) {
                    if (a.id !== 0) {
                        b.destroy();
                        if (a.getComponent('HealthComponent')) {
                            a.getComponent('HealthComponent').hp -= 50;
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
     * Advances all AnimationMixer instances by delta so skeletal animations play.
     * @param {number} delta - Elapsed seconds since last frame.
     */
    sAnimation(delta) {
        for (const e of this.entityManager.getWithComponentName('AnimationComponent')) {
            e.getComponent('AnimationComponent').mixer.update(delta);
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
                meshComp.mesh.castShadow    = meshComp.castShadow;
                meshComp.mesh.receiveShadow = meshComp.receiveShadow;
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) meshComp.mesh.position.copy(position);

            const rotation = entity.getComponent('RotationComponent');
            if (rotation != null) meshComp.mesh.rotation.set(rotation.yaw, rotation.pitch, rotation.roll);
        }

        for (const entity of this.entityManager.getWithComponentName('LightComponent')) {
            const lightComp = entity.getComponent('LightComponent');

            // add to scene on first appearance
            if (!this.addedLights.has(lightComp.light)) {
                this.scene.add(lightComp.light);
                this.addedLights.add(lightComp.light);
            }

            const position = entity.getComponent('PositionComponent')?.position;
            if (position != null) {
                if (entity.tag == 'torch') {
                    const angle = Math.atan2(position.x, position.z);
                    const tangential = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
                    const tiltQ = new THREE.Quaternion().setFromAxisAngle(tangential, Math.PI / 9);
                    const lightOffset = new THREE.Vector3(0, 0.4, 0).applyQuaternion(tiltQ);
                    lightComp.light.position.copy(position.clone().add(lightOffset));
                } else {
                    lightComp.light.position.copy(position);
                }  
            } 
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
        const playerHp = this.player?.getComponent('HealthComponent')?.hp ?? 0;
        if (action.name === 'attack' && action.type === 'start' && this.spawnCooldown <= 0 && playerHp > 0) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            const position = this.camera.position.clone().addScaledVector(direction, 0.6);
            this.spawnFireball({position, direction});
            this.spawnCooldown = 0.7;
        }
    }
}
