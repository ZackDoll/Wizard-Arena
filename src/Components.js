import * as THREE from 'three';

/**
 * Base class for all ECS components.
 * Sets this.name to the subclass constructor name so entities can key them by type.
 */
export class Component {
    constructor() {
        this.name = this.constructor.name;
    }
}

/**
 * Stores the world-space position of an entity and whether it is resting on the ground.
 */
export class PositionComponent extends Component {
    /**
     * @param {THREE.Vector3} [vec=new THREE.Vector3()] - Initial position.
     */
    constructor(vec = new THREE.Vector3()) {
        super();
        this.position = vec;
        this.isOnGround = false;
    }
}

/**
 * Stores the linear velocity of an entity.
 */
export class VelocityComponent extends Component {
    /**
     * @param {THREE.Vector3} [vec=new THREE.Vector3()] - Initial velocity.
     */
    constructor(vec = new THREE.Vector3()) {
        super();
        this.velocity = vec;
    }
}

/**
 * Defines an oriented bounding box (OBB) used for collision detection.
 */
export class CollisionComponent extends Component {
    /**
     * @param {THREE.Vector3}  [halfVec=new THREE.Vector3(0.5, 1, 0.5)] - Half-extents of the OBB.
     * @param {THREE.Quaternion} [rotation=new THREE.Quaternion()]       - OBB orientation (identity = axis-aligned).
     */
    constructor(halfVec = new THREE.Vector3(0.5, 1, 0.5), rotation = new THREE.Quaternion()) {
        super();
        this.half = halfVec;
        this.rotation = rotation; // identity = axis-aligned (backward compatible)
    }
}

/**
 * Tracks the player's score.
 */
export class ScoreComponent extends Component {
    constructor() {
        super();
        this.score = 0;
    }
}

/**
 * Marker component that flags an entity as player-controlled.
 * The movement system reads this to apply keyboard input to the entity.
 */
export class InputComponent extends Component {
    constructor() {
        super();
    }
}

/**
 * Stores current and maximum hit points for an entity.
 */
export class HealthComponent extends Component {
    /**
     * @param {number} [maxHp=100] - Maximum (and initial) hit points.
     */
    constructor(maxHp = 100) {
        super();
        this.maxHp = maxHp;
        this.hp = maxHp;
    }
}

/**
 * Holds a reference to the Three.js mesh used to visually represent an entity.
 */
export class MeshComponent extends Component {
    /**
     * @param {THREE.Object3D|null} [mesh=null] - The Three.js mesh or scene object.
     */
    constructor(mesh = null) {
        super();
        this.mesh = mesh;
    }
}

/**
 * Stores Euler rotation angles applied to the entity's mesh each frame by the render system.
 */
export class RotationComponent extends Component {
    /**
     * @param {number} yaw   - Rotation around the Y axis (radians).
     * @param {number} pitch - Rotation around the X axis (radians).
     * @param {number} roll  - Rotation around the Z axis (radians).
     */
    constructor(yaw, pitch, roll) {
        super();
        this.yaw = yaw;
        this.pitch = pitch;
        this.roll = roll;
    }
}

/**
 * Marker component that opts an entity into the gravity system.
 */
export class GravityComponent extends Component {
    constructor() {
        super();
    }
}

/**
 * Tracks the remaining lifetime of a temporary entity (e.g. a projectile).
 * The lifespan system destroys the entity when secondsLeft reaches zero.
 */
export class LifespanComponent extends Component {
    /**
     * @param {number} secs - How many seconds the entity should live.
     */
    constructor(secs) {
        super();
        this.secondsLeft = secs;
    }

    /**
     * Subtracts elapsed time from the remaining lifespan.
     * @param {number} delta - Elapsed time in seconds since last frame.
     */
    decrement(delta) {
        this.secondsLeft -= delta;
    }
}

/**
 * Marker component that flags an entity as combustible.
 * On contact with another entity, the combustible entity is destroyed and deals damage.
 */
export class CombustibleComponent extends Component {
    constructor() {
        super();
    }
}
