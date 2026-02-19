import { Entity } from './Entity'

export class EntityManager {
    constructor() {
        this._entities = [];
        this._nextId = 0;
    }

    create(type) {
        const entity = new Entity(type, this._nextId++);
        this._entities.push(entity);
        return entity;
    }

    remove(id) {
        this._entities = this._entities.filter(e => e.id !== id);
    }

    getAll() {
        return this._entities;
    }

    getWithComponentName(...componentNames) {
        return this._entities.filter(e =>
            componentNames.every(name => e.getComponent(name))
        );
    }

    getWithID(id) {
        return this._entities.filter(e => e.id == id)[0];
    }
}
