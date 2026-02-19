import * as THREE from 'three'
import * as Component from './Components.js'

export class Entity {
    constructor(type, id) {
        this.id = id;
        this.type = type;
        this.components = {};
    }

    addComponent(component) {
        this.components[component.name] = component;
    }

    getComponent(name) {
        return this.components[name];
    }
}
