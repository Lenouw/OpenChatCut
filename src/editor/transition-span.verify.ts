import assert from 'node:assert/strict';
import {
  MIN_TRANSITION_FRAMES,
  applyTransitionDrag,
  clampTransitionSpan,
  framesBeforeCut,
  transitionStartFrame,
} from './transitionSpan';
import { reduce } from './reduce';
import type { TimelineItem, TimelineState } from './types';

// A project written before beforeCutInFrames existed carries no split, and must keep
// rendering exactly where it did: centred, biased to the incoming clip on odd lengths.
assert.equal(framesBeforeCut({ durationInFrames: 30 }), 15);
assert.equal(framesBeforeCut({ durationInFrames: 31 }), 15, 'odd lengths floor, as before the field');
assert.equal(framesBeforeCut({ durationInFrames: 2 }), 1);
assert.equal(transitionStartFrame({ durationInFrames: 30 }, 100), 85);

// An explicit split is honoured, including the two ends: entirely before the cut
// (the transition plays out over the outgoing clip) and entirely after it.
assert.equal(framesBeforeCut({ durationInFrames: 30, beforeCutInFrames: 6 }), 6);
assert.equal(transitionStartFrame({ durationInFrames: 30, beforeCutInFrames: 6 }, 100), 94);
assert.equal(transitionStartFrame({ durationInFrames: 30, beforeCutInFrames: 30 }, 100), 70);
assert.equal(transitionStartFrame({ durationInFrames: 30, beforeCutInFrames: 0 }, 100), 100);

// A split outside its own transition is meaningless, so it is pulled back in rather
// than drawing a region that starts after it ends.
assert.equal(framesBeforeCut({ durationInFrames: 30, beforeCutInFrames: 45 }), 30);
assert.equal(framesBeforeCut({ durationInFrames: 30, beforeCutInFrames: -8 }), 0);

// Neither neighbour can lend frames it does not have: past that the transition would
// run off a clip's edge, which reads on screen as a freeze frame.
assert.deepEqual(clampTransitionSpan({ durationInFrames: 90 }, 40, 60), { durationInFrames: 40, beforeCutInFrames: 20 });
assert.deepEqual(clampTransitionSpan({ durationInFrames: 90 }, 60, 40), { durationInFrames: 40, beforeCutInFrames: 20 });
assert.equal(clampTransitionSpan({ durationInFrames: 1 }, 60, 60).durationInFrames, MIN_TRANSITION_FRAMES);

// Shortening also brings the split in, so a wide split cannot survive onto a
// transition too short to hold it.
assert.deepEqual(
  clampTransitionSpan({ durationInFrames: 90, beforeCutInFrames: 80 }, 30, 30),
  { durationInFrames: 30, beforeCutInFrames: 30 },
);

// Dragging the start edge right shortens the transition from the front: its end
// stays put, so length and the part before the cut fall by the same amount.
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'start', 5, 60),
  { durationInFrames: 25, beforeCutInFrames: 10 },
);
// ...and dragging it left lengthens the transition backwards over the outgoing clip.
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'start', -5, 60),
  { durationInFrames: 35, beforeCutInFrames: 20 },
);

// Dragging the end edge only adds length after the cut; the start does not move.
const stretched = applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'end', 10, 60);
assert.deepEqual(stretched, { durationInFrames: 40, beforeCutInFrames: 15 });
assert.equal(
  transitionStartFrame(stretched, 100),
  transitionStartFrame({ durationInFrames: 30, beforeCutInFrames: 15 }, 100),
  'the start edge holds while the end is pulled',
);

// Sliding keeps the length and moves the whole region across the cut: this is the
// gesture that changes the before/after balance, and the only one that should.
const slid = applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'slide', -9, 60);
assert.deepEqual(slid, { durationInFrames: 30, beforeCutInFrames: 24 });
assert.equal(slid.durationInFrames, 30, 'sliding never retimes');

// Dragging past what the clips can give stops at the limit instead of running away,
// and a slide that overshoots parks against the cut rather than inverting.
assert.equal(applyTransitionDrag({ durationInFrames: 30 }, 'end', 500, 40).durationInFrames, 40);
assert.equal(applyTransitionDrag({ durationInFrames: 30 }, 'start', 500, 40).durationInFrames, MIN_TRANSITION_FRAMES);
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'slide', -500, 60),
  { durationInFrames: 30, beforeCutInFrames: 30 },
);
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'slide', 500, 60),
  { durationInFrames: 30, beforeCutInFrames: 0 },
);

// A drag that never moved returns the span unchanged, so a click on the region stays
// a selection instead of writing a no-op edit into the undo history.
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 30, beforeCutInFrames: 15 }, 'slide', 0, 60),
  { durationInFrames: 30, beforeCutInFrames: 15 },
);
assert.deepEqual(
  applyTransitionDrag({ durationInFrames: 31 }, 'end', 0, 60),
  { durationInFrames: 31, beforeCutInFrames: 15 },
  'an untouched centred transition resolves to its stored centre, not a shifted one',
);

// ── through the reducer, which is what actually persists ─────────────────────
// The helpers above are pure; these assertions cover the path a dragged edge really
// takes, so a clamp that lives only in the component cannot be mistaken for safety.
const base: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [
    { id: 'a', track: 'V1', startFrame: 0, durationInFrames: 40, kind: 'video', name: 'a', src: '/a.mp4' },
    { id: 'b', track: 'V1', startFrame: 40, durationInFrames: 90, kind: 'video', name: 'b', src: '/b.mp4' },
  ] as TimelineItem[],
};
const placed = reduce(base, { type: 'addTransition', id: 'tr', incomingItemId: 'b', transType: 'cross-dissolve', durationInFrames: 30 });
assert.equal(placed.transitions![0]!.durationInFrames, 30);
assert.equal(
  placed.transitions![0]!.beforeCutInFrames,
  undefined,
  'a newly placed transition stores no split, so it stays centred like every older one',
);

const shifted = reduce(placed, { type: 'setTransition', id: 'tr', patch: { beforeCutInFrames: 6 } });
assert.equal(shifted.transitions![0]!.beforeCutInFrames, 6, 'the split survives the reducer');
assert.equal(shifted.transitions![0]!.durationInFrames, 30, 'setting a split never retimes');

// A split wider than the transition, or negative, is brought back inside it.
assert.equal(reduce(placed, { type: 'setTransition', id: 'tr', patch: { beforeCutInFrames: 99 } }).transitions![0]!.beforeCutInFrames, 30);
assert.equal(reduce(placed, { type: 'setTransition', id: 'tr', patch: { beforeCutInFrames: -4 } }).transitions![0]!.beforeCutInFrames, 0);

// The shorter neighbour still caps the length, and shortening drags the stored split
// down with it rather than leaving a split longer than the transition it describes.
const overlong = reduce(shifted, { type: 'setTransition', id: 'tr', patch: { durationInFrames: 200 } });
assert.equal(overlong.transitions![0]!.durationInFrames, 40, 'capped by the 40-frame outgoing clip');
const squeezed = reduce(
  reduce(placed, { type: 'setTransition', id: 'tr', patch: { beforeCutInFrames: 30 } }),
  { type: 'setTransition', id: 'tr', patch: { durationInFrames: 10 } },
);
assert.equal(squeezed.transitions![0]!.durationInFrames, 10);
assert.equal(squeezed.transitions![0]!.beforeCutInFrames, 10, 'the split is pulled in with the length');

// Patches that touch neither field leave the span alone, so toggling a transition
// off does not quietly recentre one the editor had deliberately shifted.
const toggled = reduce(shifted, { type: 'setTransition', id: 'tr', patch: { enabled: false } });
assert.equal(toggled.transitions![0]!.beforeCutInFrames, 6);
assert.equal(toggled.transitions![0]!.durationInFrames, 30);

console.log('transition-span.verify OK');
