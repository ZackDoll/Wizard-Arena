/**
 * A game entity — a unique ID + tag container that holds a bag of Components.
 * Entities are created via EntityManager.addEntity(); never constructed directly.
 */
export class Entity {
    #isActive = true;

    /**
     * @param {number} id   - Unique numeric identifier assigned by EntityManager.
     * @param {string} [tag='default'] - Logical group label (e.g. 'wizardEntity', 'fireballEntity').
     */
    constructor(id, tag = "default") {
        this.tag = tag;
        this.id = id;
        this.components = {};
    }

    /**
     * Returns true if the entity has a component of the given type name.
     * @param {string} name - Component class name (e.g. 'PositionComponent').
     * @returns {boolean}
     */
    hasComponent(name) {
        return this.components[name] !== undefined;
    }

    /**
     * Attaches a component to this entity, keyed by its class name.
     * Replaces any previously attached component of the same type.
     * @param {import('./Components.js').Component} component
     */
    addComponent(component) {
        this.components[component.name] = component;
    }

    /**
     * Returns the component of the given type, or undefined if not present.
     * @param {string} name - Component class name.
     * @returns {import('./Components.js').Component|undefined}
     */
    getComponent(name) {
        return this.components[name];
    }

    /**
     * Detaches and deletes the component of the given type from this entity.
     * @param {string} name - Component class name.
     */
    removeComponent(name) {
        delete this.components[name];
    }

    /**
     * Marks this entity for removal. EntityManager.removeDeadEntities() will
     * prune it from all lists on the next update() call.
     */
    destroy() {
        this.#isActive = false;
    }

    /**
     * Returns this entity's unique numeric ID.
     * @returns {number}
     */
    getID() {
        return this.id;
    }

    /**
     * Returns true while the entity is alive (i.e. destroy() has not been called).
     * @returns {boolean}
     */
    isActive() {
        return this.#isActive;
    }

    /**
     * Returns the tag string this entity was created with.
     * @returns {string}
     */
    getTag() {
        return this.tag;
    }
}
