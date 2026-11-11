/**
 * The book is right-bound: pages turn from left to right. A leaf has two faces:
 * `a` is up while the leaf lies on the left of the spine, `b` once it has been
 * turned onto the right. Values are 1-based book page numbers, or null for
 * blank paper.
 *
 * `position` is the number of leaves lying on the right of the spine.
 */
export interface Leaf {
  a: number | null;
  b: number | null;
}

export function buildLeaves(pageCount: number): Leaf[] {
  // Leaf 0 already lies on the right and carries page 1, as in a printed mushaf.
  const leaves: Leaf[] = [];
  for (let j = 0; j <= Math.floor(pageCount / 2); j++) {
    const a = j === 0 || 2 * j > pageCount ? null : 2 * j;
    const b = 2 * j + 1 <= pageCount ? 2 * j + 1 : null;
    leaves.push({ a, b });
  }
  return leaves;
}

export function initialPosition(): number {
  return 1;
}

export function canTurnForward(leaves: Leaf[], position: number): boolean {
  return position + 1 <= leaves.length - 1;
}

export function canTurnBack(position: number): boolean {
  return position >= 2;
}

/** Visible pages in reading order: the right page first. */
export function visiblePages(leaves: Leaf[], position: number): number[] {
  return [leaves[position - 1]?.b, leaves[position]?.a].filter((p): p is number => p != null);
}

/** Whether a step in reading order is possible from the current focus. */
export function canStep(leaves: Leaf[], position: number, focus: 1 | -1 | null, dir: 1 | -1): boolean {
  if (focus === null) return dir === 1 ? canTurnForward(leaves, position) : canTurnBack(position);
  if (dir === 1) return focus === -1 ? leaves[position]?.a != null : canTurnForward(leaves, position);
  return focus === 1 ? leaves[position - 1]?.b != null : canTurnBack(position);
}
