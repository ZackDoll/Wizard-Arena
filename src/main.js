import * as THREE from 'three';
import { GameEngine } from './GameEngine.js';
import * as C from './Components.js';
import * as S from './Systems.js';
import { loadWorld } from './world.js';
import { preloadFireballModel } from './Factories/FireballFactory.js';

// CONSTANTS
const WALL_SEGMENTS = 16;
const ARENA_RADIUS = 22;     // distance from center to middle of wall
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 1.2;
// Arc length per segment + small overlap to close gaps between angled boxes
const SEGMENT_WIDTH = (2 * Math.PI * ARENA_RADIUS) / WALL_SEGMENTS + 0.3;

const STONE_COLOR = 0x8c7a5c; // weathered sandstone


 // create engine (main system)
const engine = new GameEngine(document.body);

// create and add systems to engine 

engine.addSystem(new S.RenderSystem(engine.scene));
engine.addSystem(new S.InputSystem(engine.renderer, engine.camera));
engine.addSystem(new S.CameraControlSystem(engine.camera, engine.systems['InputSystem']));
engine.addSystem(new S.MovementSystem(engine.systems['InputSystem'], engine.camera));
engine.addSystem(new S.GravitySystem());
engine.addSystem(new S.SpawnSystem(engine.camera, engine.systems['InputSystem'], engine.spawnQueue));
engine.addSystem(new S.LifespanSystem(engine.destroyQueue));
engine.addSystem(new S.CollisionSystem(engine.destroyQueue));
// engine.addSystem(new S.AttackSystem());


// create and add entities to engine

// create wizard (must be first entity)
const wizard = engine.addEntity('wizardEntity');
wizard.addComponent(new C.InputComponent());
const wizardGeo = new THREE.BoxGeometry(1, 2, 1);
const wizardMat = new THREE.MeshStandardMaterial({ color: 0x6a0dad });
const wizardMesh = new THREE.Mesh(wizardGeo, wizardMat);
wizard.addComponent(new C.MeshComponent(wizardMesh));
wizard.addComponent(new C.PositionComponent(new THREE.Vector3(0, 2, 0)));
wizard.addComponent(new C.VelocityComponent(new THREE.Vector3()));
wizard.addComponent(new C.GravityComponent());

wizard.addComponent(new C.CollisionComponent());
// wizard.addComponent(new C.ScoreComponent());
// wizard.addComponent(new C.HealthComponent());

// create test zombie
engine.EM.spawnZombie(new THREE.Vector3(0, 1, -20));

//nonmoving box to test static collisions
const staticBox = engine.addEntity('staticBoxEntity');
const staticBoxGeo = new THREE.BoxGeometry(1, 2, 1);
const staticBoxMat = new THREE.MeshStandardMaterial({ color: 0x8c7a5c });
const staticBoxMesh = new THREE.Mesh(staticBoxGeo, staticBoxMat);
staticBox.addComponent(new C.MeshComponent(staticBoxMesh));
staticBox.addComponent(new C.PositionComponent(new THREE.Vector3(0, 1, -10)));
staticBox.addComponent(new C.CollisionComponent());


// arena floor + arch models created in world.js

// debug axes (red=X, green=Y, blue=Z)
const axisLen = 10, axisR = 0.08;
const axisDefs = [
    { color: 0xff0000, pos: [axisLen/2, 0, 0], rot: [0, 0, Math.PI/2] }, // X
    { color: 0x00ff00, pos: [0, axisLen/2, 0], rot: [0, 0, 0]          }, // Y
    { color: 0x0000ff, pos: [0, 0, axisLen/2], rot: [Math.PI/2, 0, 0]  }, // Z
];
for (const { color, pos, rot } of axisDefs) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(axisR, axisR, axisLen, 8),
        new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    engine.scene.add(mesh);
}

// load world models
loadWorld(engine);
preloadFireballModel();

// run
engine.run();