import { MIN_TRANSITION_FRAMES } from '../../editor/transitionSpan';

/** Duration presets offered on the transition badge menu, in seconds. Short
 *  enough to keep the menu scannable; finer values come from dragging the
 *  region's edges, or from the agent tools. */
export const TRANSITION_DURATION_PRESETS = [0.2, 0.3, 0.5, 1, 2] as const;

/** Frames for a preset at the timeline's rate, clamped to the store's own
 *  minimum so what the menu offers is exactly what gets persisted. */
export function transitionPresetFrames(seconds: number, fps: number): number {
  return Math.max(MIN_TRANSITION_FRAMES, Math.round(seconds * fps));
}

/** The preset matching the applied duration, so the menu can tick it. Durations
 *  set elsewhere (agent, imported project) match nothing rather than being
 *  mislabelled as the nearest preset. */
export function activeTransitionPreset(durationInFrames: number, fps: number): number | null {
  return TRANSITION_DURATION_PRESETS.find(
    (seconds) => transitionPresetFrames(seconds, fps) === durationInFrames,
  ) ?? null;
}
