
/**
 * Abstract base class for all game scenes (e.g. main menu, gameplay, cutscene).
 * Subclasses override update(), sDoAction(), and sRender() with scene-specific logic.
 */
export class Scene {
    /**
     * @param {import('./GameEngine.js').GameEngine} gameEngine - The shared engine instance.
     */
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.entityManager = null;
        this.actionMap = {};
        this.isPaused = false;
        this.hasEnded = false;
        this.scene = null;
    }

    /**
     * Marks this scene as ended. GameEngine can check hasEnded to transition to the next scene.
     */
    onEnd() {
        this.hasEnded = true;
    }

    /**
     * Called once per frame by GameEngine. Subclasses run all game systems here.
     * @param {number} delta - Elapsed time in seconds since the last frame.
     */
    update() {
        // to be overridden by subclasses
    }

    /**
     * Executes the given action (e.g. move, attack, pause).
     * Called internally by doAction(); subclasses override this.
     * @param {import('./Action.js').Action} action
     */
    sDoAction(action) {
        // do be overridden by subclasses; performs the given action (e.g. move, attack, etc.)
    }

    /**
     * Renders all entities that have a MeshComponent.
     * Subclasses override this to sync Three.js mesh transforms.
     */
    sRender() {
        // to be overridden by subclasses; renders all entities with mesh components
    }

    /**
     * Public entry point for dispatching an action to this scene.
     * Delegates to sDoAction(), which subclasses override.
     * @param {import('./Action.js').Action} action
     */
    doAction(action) {
        this.sDoAction(action);
    }

    /**
     * Maps a raw input key code (e.g. 'KeyW', 'Mouse0') to a logical action name.
     * The GameEngine uses this map to translate DOM events into Action objects.
     * @param {string} inputKey   - DOM key code or synthetic mouse key (e.g. 'Mouse0').
     * @param {string} actionName - Logical name for the action (e.g. 'moveForward').
     */
    registerAction(inputKey, actionName) {
        this.actionMap[inputKey] = actionName;
    }

    /**
     * Returns the height of the renderer canvas in pixels.
     * @returns {number}
     */
    height() {
        return this.gameEngine.renderer.domElement.height;
    }

    /**
     * Returns the width of the renderer canvas in pixels.
     * @returns {number}
     */
    width() {
        return this.gameEngine.renderer.domElement.width;
    }

}
