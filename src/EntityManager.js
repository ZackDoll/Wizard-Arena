import { Entity } from './Entity.js';

/**
 * Creates, stores, and destroys all game entities.
 *
 * New entities are buffered in entitiesToAdd and flushed into the live list
 * at the start of each update() call, so systems never iterate a mid-frame list.
 * Dead entities (those whose isActive() returns false) are pruned during the
 * same update() call.
 */
export class EntityManager {
    constructor() {
        this.entities = [];
        this.entitiesToAdd = [];
        this.entityMap = {}; // maps tags to list of entities with that tag
        this.entityCount = 0;
    }

    /**
     * Flushes the add-buffer into the live entity list, then prunes dead entities.
     * Call once per frame before running any game systems.
     */
    update() {
        // process entities to add
        for (const entity of this.entitiesToAdd) {
            this.entities.push(entity);
            if (!this.entityMap[entity.getTag()]) {
                this.entityMap[entity.getTag()] = [];
            }
            this.entityMap[entity.getTag()].push(entity);
        }
        this.entitiesToAdd = [];

        // remove dead entities
        this.removeDeadEntities();
    }

    /**
     * Filters out all inactive entities from the live list and the tag map.
     * Called automatically by update(); can also be called manually if needed.
     */
    removeDeadEntities() {
        this.entities = this.entities.filter(e => e.isActive());

        for (const tag in this.entityMap) {
            this.entityMap[tag] = this.entityMap[tag].filter(e => e.isActive());
        }
    }

    /**
     * Creates a new entity with the given tag, queues it to be added on the
     * next update() call, and returns it immediately so components can be
     * attached before the flush.
     * @param {string} tag - Logical group label (e.g. 'wizardEntity', 'fireballEntity').
     * @returns {Entity}
     */
    addEntity(tag) {
        const entity = new Entity(this.entityCount++, tag);
        this.entitiesToAdd.push(entity);
        return entity;
    }

    /**
     * Returns all currently active entities that possess every listed component.
     * @param {...string} names - One or more component class names to filter by.
     * @returns {Entity[]}
     */
    getWithComponentName(...names) {
        return this.entities.filter(e =>
            e.isActive() && names.every(n => e.hasComponent(n))
        );
    }

    /**
     * Returns the active entity with the given numeric ID, or null if not found.
     * @param {number} id
     * @returns {Entity|null}
     */
    getWithID(id) {
        return this.entities.find(e => e.id === id && e.isActive()) ?? null;
    }

    /**
     * Returns the full live entity list (including entities that may have just been
     * marked inactive but not yet pruned). Prefer getWithComponentName() for system use.
     * @returns {Entity[]}
     */
    getEntities() {
        return this.entities;
    }

    /**
     * Returns all active entities that were created with the given tag.
     * @param {string} tag
     * @returns {Entity[]}
     */
    getEntitiesWithTag(tag) {
        return this.entityMap[tag] || [];
    }
}
