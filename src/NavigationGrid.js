import * as THREE from 'three';

const CELL_SIZE  = 1;
const GRID_HALF  = 22;
const GRID_SIZE  = GRID_HALF * 2; // 44 cells per side

const SQRT2 = Math.SQRT2;

/**
 * 2D navigation grid over the arena floor (XZ plane).
 * Cells outside the circular arena boundary or overlapping static obstacles
 * are marked as blocked. Used by findPath() for A* pathfinding.
 */
export class NavigationGrid {
    /**
     * @param {number} walkableRadius  - World-space radius inside which cells are walkable.
     * @param {Array<{minX,maxX,minZ,maxZ}>} obstacles - Axis-aligned obstacle footprints.
     */
    constructor(walkableRadius, obstacles = []) {
        // flat Uint8Array: 0 = walkable, 1 = blocked
        this._cells = new Uint8Array(GRID_SIZE * GRID_SIZE);

        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const { x, z } = this.cellToWorld(col, row);
                // block cells outside the circular walkable area
                if (x * x + z * z > walkableRadius * walkableRadius) {
                    this._cells[row * GRID_SIZE + col] = 1;
                }
            }
        }

        for (const obs of obstacles) {
            this._markObstacle(obs);
        }
    }

    _markObstacle({ minX, maxX, minZ, maxZ }) {
        // expand by half a cell so edges are safely blocked
        const pad = CELL_SIZE * 0.5;
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const { x, z } = this.cellToWorld(col, row);
                if (x >= minX - pad && x <= maxX + pad &&
                    z >= minZ - pad && z <= maxZ + pad) {
                    this._cells[row * GRID_SIZE + col] = 1;
                }
            }
        }
    }

    /** Convert world XZ to grid column/row. Returns null if out of bounds. */
    worldToCell(x, z) {
        const col = Math.floor((x + GRID_HALF) / CELL_SIZE);
        const row = Math.floor((z + GRID_HALF) / CELL_SIZE);
        if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
        return { col, row };
    }

    /** Convert grid column/row to world XZ center of that cell. */
    cellToWorld(col, row) {
        return {
            x: (col + 0.5) * CELL_SIZE - GRID_HALF,
            z: (row + 0.5) * CELL_SIZE - GRID_HALF,
        };
    }

    isWalkableCell(col, row) {
        if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return false;
        return this._cells[row * GRID_SIZE + col] === 0;
    }
}

// ─── A* ────────────────────────────────────────────────────────────────────

/**
 * Finds a path from `from` to `to` on the given NavigationGrid.
 * @param {NavigationGrid} grid
 * @param {THREE.Vector3}  from
 * @param {THREE.Vector3}  to
 * @returns {THREE.Vector3[]} Array of world-space waypoints (excluding start, including goal).
 *                            Returns [] if no path found.
 */
export function findPath(grid, from, to) {
    const startCell = grid.worldToCell(from.x, from.z);
    const goalCell  = grid.worldToCell(to.x,   to.z);
    if (!startCell || !goalCell) return [];

    // If goal is blocked, find nearest walkable neighbour
    if (!grid.isWalkableCell(goalCell.col, goalCell.row)) {
        // try immediate 8-neighbours
        let found = false;
        outer:
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nc = goalCell.col + dc;
                const nr = goalCell.row + dr;
                if (grid.isWalkableCell(nc, nr)) {
                    goalCell.col = nc;
                    goalCell.row = nr;
                    found = true;
                    break outer;
                }
            }
        }
        if (!found) return [];
    }

    const key = (c, r) => r * GRID_SIZE + c;

    const gScore  = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
    const fScore  = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
    const parent  = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
    const closed  = new Uint8Array(GRID_SIZE * GRID_SIZE);

    const sk = key(startCell.col, startCell.row);
    gScore[sk] = 0;
    fScore[sk] = heuristic(startCell.col, startCell.row, goalCell.col, goalCell.row);

    // open list as a simple min-heap on fScore
    const open = [sk];

    const DIRS = [
        [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
        [-1, -1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [1, 1, SQRT2],
    ];

    while (open.length > 0) {
        // pop node with lowest fScore
        let bestIdx = 0;
        for (let i = 1; i < open.length; i++) {
            if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
        }
        const current = open[bestIdx];
        open.splice(bestIdx, 1);

        const curRow = Math.floor(current / GRID_SIZE);
        const curCol = current % GRID_SIZE;

        if (curCol === goalCell.col && curRow === goalCell.row) {
            return reconstructPath(grid, parent, current, key(startCell.col, startCell.row));
        }

        closed[current] = 1;

        for (const [dc, dr, cost] of DIRS) {
            const nc = curCol + dc;
            const nr = curRow + dr;
            if (!grid.isWalkableCell(nc, nr)) continue;
            const nk = key(nc, nr);
            if (closed[nk]) continue;

            // for diagonal moves, ensure both cardinal neighbours are walkable (corner cutting)
            if (dc !== 0 && dr !== 0) {
                if (!grid.isWalkableCell(curCol + dc, curRow) ||
                    !grid.isWalkableCell(curCol, curRow + dr)) continue;
            }

            const tentativeG = gScore[current] + cost;
            if (tentativeG < gScore[nk]) {
                parent[nk] = current;
                gScore[nk] = tentativeG;
                fScore[nk] = tentativeG + heuristic(nc, nr, goalCell.col, goalCell.row);
                if (!open.includes(nk)) open.push(nk);
            }
        }
    }

    return []; // no path
}

function heuristic(col, row, gc, gr) {
    const dx = Math.abs(col - gc);
    const dz = Math.abs(row - gr);
    // octile distance
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
}

function reconstructPath(grid, parent, goalKey, startKey) {
    const path = [];
    let current = goalKey;
    while (current !== startKey && current !== -1) {
        const row = Math.floor(current / GRID_SIZE);
        const col = current % GRID_SIZE;
        const { x, z } = grid.cellToWorld(col, row);
        path.push(new THREE.Vector3(x, 0, z));
        current = parent[current];
    }
    path.reverse();
    return path;
}
