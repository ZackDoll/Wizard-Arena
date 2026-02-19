import * as THREE from 'three';

export class Component {
    constructor() {
        this.name = this.constructor.name;
    }
}

export class PositionComponent extends Component {
    constructor(x = 0, y = 0, z = 0) {
        super();
        this.position = new THREE.Vector3(x, y, z);
        this.isOnGround = false;
    }
}

export class VelocityComponent extends Component {
    constructor(vx = 0, vy = 0, vz = 0) {
        super();
        this.velocity = new THREE.Vector3(vx, vy, vz);
    }
}

export class CollisionComponent extends Component {
    constructor(radius = 0.5) {
        super();
        this.radius = radius;
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