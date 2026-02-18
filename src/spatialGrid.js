// Uniform Spatial Grid for broadphase collision detection.
// No Three.js dependency — works with any bounds object that has
// .min.x, .min.z, .max.x, .max.z properties (i.e., a THREE.Box3).
//
// Usage:
//   const grid = new SpatialGrid({ cellSize: 4 });
//   grid.insert(object, box3);         // register object in cells it overlaps
//   const candidates = grid.query(box3); // get nearby objects for narrow phase
//   grid.clear();                      // reset each frame

export class SpatialGrid {
    constructor({ cellSize = 4 } = {}) {
        this.cellSize = cellSize;
        this.cells = new Map();       // "cx,cz" -> Set<object>
        this.objectCells = new Map(); // object  -> string[] (keys it was inserted into)
    }

    _worldToCell(coord) {
        return Math.floor(coord / this.cellSize);
    }

    _cellKey(cx, cz) {
        return `${cx},${cz}`;
    }

    _boundsToCell(box3) {
        return {
            minCX: this._worldToCell(box3.min.x),
            maxCX: this._worldToCell(box3.max.x + 0.001), // epsilon handles exact cell boundary
            minCZ: this._worldToCell(box3.min.z),
            maxCZ: this._worldToCell(box3.max.z + 0.001),
        };
    }

    // Register an object in all grid cells its bounds overlap.
    insert(object, box3) {
        const { minCX, maxCX, minCZ, maxCZ } = this._boundsToCell(box3);
        const keys = [];
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const key = this._cellKey(cx, cz);
                if (!this.cells.has(key)) this.cells.set(key, new Set());
                this.cells.get(key).add(object);
                keys.push(key);
            }
        }
        this.objectCells.set(object, keys);
    }

    // Return all objects in the cells overlapped by box3.
    // The querying object itself may be included — callers must filter it out.
    query(box3) {
        const { minCX, maxCX, minCZ, maxCZ } = this._boundsToCell(box3);
        const result = new Set();
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const cell = this.cells.get(this._cellKey(cx, cz));
                if (cell) for (const obj of cell) result.add(obj);
            }
        }
        return Array.from(result);
    }

    // Remove a single object from the grid without a full clear.
    // Useful for incremental updates when only fast-moving objects (e.g. projectiles) change position.
    remove(object) {
        const keys = this.objectCells.get(object);
        if (!keys) return;
        for (const key of keys) {
            const cell = this.cells.get(key);
            if (cell) {
                cell.delete(object);
                if (cell.size === 0) this.cells.delete(key); // keep Map sparse
            }
        }
        this.objectCells.delete(object);
    }

    // Clear all grid data. Call once per frame before re-inserting objects.
    clear() {
        this.cells.clear();
        this.objectCells.clear();
    }
}
