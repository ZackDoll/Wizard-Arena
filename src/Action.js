/**
 * Represents a game action dispatched by the input system.
 * Actions are created from raw keyboard/mouse events and forwarded to the current scene.
 */
export class Action {
    /**
     * @param {string} name - Logical action name (e.g. 'moveForward', 'attack', 'pause').
     * @param {string} type - Phase of the action: 'start' (keydown/mousedown) or 'stop' (keyup/mouseup).
     * @param {Object} [data={}] - Optional payload for additional action-specific data.
     */
    constructor(name, type, data = {}) {
        this.name = name; // e.g. 'move', 'attack', etc.
        this.type = type; // e.g. 'start' for keydown, 'stop' for keyup, etc.
        this.data = data; // any additional data needed for the action (e.g. direction of movement)
    }
}
