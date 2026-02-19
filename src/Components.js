import * as THREE from 'three';

export class Component {
    constructor() {
        this.name = this.constructor.name;
    }
}

export class PositionComponent extends Component {
    constructor(vec = new THREE.Vector3()) {
        super();
        this.position = vec;
        this.isOnGround = false;
    }
}

export class VelocityComponent extends Component {
    constructor(vec = new THREE.Vector3()) {
        super();
        this.velocity = vec;
    }
}

export class CollisionComponent extends Component {
    constructor(halfVec = new THREE.Vector3(0.5, 1, 0.5), rotation = new THREE.Quaternion()) {
        super();
        this.half = halfVec;
        this.rotation = rotation; // identity = axis-aligned (backward compatible)
    }
}

export class ScoreComponent extends Component {
    constructor() {
        super();
        this.score = 0;
    }
}

export class InputComponent extends Component {
    constructor() {
        super();
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
        this.jump = false;
        this.shoot = false;
    }
}

export class HealthComponent extends Component {
    constructor(maxHp = 100) {
        super();
        this.maxHp = maxHp;
        this.hp = maxHp;
    }
}

export class MeshComponent extends Component {
    constructor(mesh = null) {
        super();
        this.mesh = mesh;
    }
}

export class RotationComponent extends Component {
    constructor(yaw, pitch, roll) {
        super();
        this.yaw = yaw;
        this.pitch = pitch;
        this.roll = roll;
    }
}

export class GravityComponent extends Component {
    constructor() {
        super();
    }
}

export class LifespanComponent extends Component {
    constructor(secs) {
        super();
        this.secondsLeft = secs;
    }

    decrement(delta) {
        this.secondsLeft -= delta
    }
}