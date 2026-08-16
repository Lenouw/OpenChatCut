import type { TransitionItem } from './transitionTypes';

/** Shortest transition the store will hold. Anything below this is indistinguishable
 *  from a hard cut and leaves the shader no frames to interpolate over. */
export const MIN_TRANSITION_FRAMES = 2;

/** The part of a transition item that decides where it sits on the timeline. */
export type TransitionSpan = Pick<TransitionItem, 'durationInFrames' | 'beforeCutInFrames'>;

/** A span with the split spelled out, as stored after any clamp. */
export type ResolvedSpan = { durationInFrames: number; beforeCutInFrames: number };

/** Which edge of the region a drag is moving. */
export type TransitionDragMode = 'start' | 'end' | 'slide';

/** How many frames of the transition fall before the cut. An absent
 *  `beforeCutInFrames` means centred, which is how every project written before
 *  the field existed was rendered, so old projects keep their look. */
export function framesBeforeCut(span: TransitionSpan): number {
  const centred = Math.floor(span.durationInFrames / 2);
  const requested = span.beforeCutInFrames ?? centred;
  return Math.max(0, Math.min(requested, span.durationInFrames));
}

/** The first frame the transition covers. The cut itself is the incoming clip's
 *  start, so the transition reaches back from there by whatever sits before it. */
export function transitionStartFrame(span: TransitionSpan, incomingStartFrame: number): number {
  return incomingStartFrame - framesBeforeCut(span);
}

/**
 * Bring a span back inside what the two clips can actually give it.
 *
 * The duration may never exceed either neighbour: beyond that the transition
 * would need frames the clip does not have, which shows up as a freeze frame.
 * Once the duration fits, any split between 0 and the full duration fits too,
 * so the offset only needs holding inside its own transition.
 */
export function clampTransitionSpan(
  span: TransitionSpan,
  outgoingDuration: number,
  incomingDuration: number,
): ResolvedSpan {
  const longest = Math.max(MIN_TRANSITION_FRAMES, Math.min(outgoingDuration, incomingDuration));
  const durationInFrames = Math.max(
    MIN_TRANSITION_FRAMES,
    Math.min(span.durationInFrames, longest),
  );
  return {
    durationInFrames,
    beforeCutInFrames: framesBeforeCut({ ...span, durationInFrames }),
  };
}

/**
 * Apply a drag of `deltaFrames` to a span, in terms of the edge being moved.
 *
 * Dragging the start edge moves where the transition begins while its end stays
 * put, so it trades length against the part sitting before the cut. Dragging the
 * end edge only adds length after the cut. Sliding keeps the length and carries
 * the whole thing across the cut, which is what changes the before/after balance.
 */
export function applyTransitionDrag(
  span: TransitionSpan,
  mode: TransitionDragMode,
  deltaFrames: number,
  maxDurationInFrames: number,
): ResolvedSpan {
  const before = framesBeforeCut(span);
  const dragged: TransitionSpan = mode === 'start'
    ? { durationInFrames: span.durationInFrames - deltaFrames, beforeCutInFrames: before - deltaFrames }
    : mode === 'end'
      ? { durationInFrames: span.durationInFrames + deltaFrames, beforeCutInFrames: before }
      : { durationInFrames: span.durationInFrames, beforeCutInFrames: before - deltaFrames };
  // Both neighbours are held to the same limit, so the clamp takes it twice.
  return clampTransitionSpan(dragged, maxDurationInFrames, maxDurationInFrames);
}
