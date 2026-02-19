export class Entity {
    constructor(type, id) {
        this.id = id;
        this.type = type;
        this.components = {};
        this.active = true;
    }

    addComponent(component) {
        this.components[component.name] = component;
    }

    getComponent(name) {
        return this.components[name];
    }
}