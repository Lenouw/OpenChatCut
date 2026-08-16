import { useRef, useState } from 'react';
import { Icon } from '../icons';
import {
  applyTransitionDrag,
  framesBeforeCut,
  type ResolvedSpan,
  type TransitionDragMode,
  type TransitionSpan,
} from '../../editor/transitionSpan';

/** Narrowest the region may be drawn, in pixels. A short transition at a low zoom
 *  is only a pixel or two wide, which leaves nothing to aim at, so below this the
 *  region is drawn wider than it really is and stays centred on its true span. */
const MIN_REGION_PX = 24;
/** Grab width of each edge handle, matching the clip trim handles either side. */
const HANDLE_PX = 8;

interface TransitionRegionProps {
  span: TransitionSpan;
  /** Longest this transition may become: neither neighbouring clip can lend more. */
  maxDurationInFrames: number;
  incomingStartFrame: number;
  label: string;
  px: number;
  fps: number;
  locked: boolean;
  onSelect: () => void;
  onCommit: (span: ResolvedSpan) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

/**
 * The transition drawn as what it is: a stretch of timeline straddling a cut.
 *
 * It used to be a fixed 16px chip pinned to the cut, which gave the length nowhere
 * to show and left no edge to pull, so a placed transition could not be resized or
 * shifted from the timeline at all. Here the width is the length, the chip marks
 * the cut inside it, and the two edges are draggable.
 */
export function TransitionRegion({
  span, maxDurationInFrames, incomingStartFrame, label, px, fps, locked,
  onSelect, onCommit, onContextMenu,
}: TransitionRegionProps) {
  const [preview, setPreview] = useState<ResolvedSpan | null>(null);
  // Held in a ref as well: the pointer handlers are registered once per gesture and
  // would otherwise close over the span as it was when the drag started.
  const gesture = useRef<{ mode: TransitionDragMode; startX: number; base: TransitionSpan } | null>(null);

  const shown = preview ?? span;
  const durationInFrames = shown.durationInFrames;
  const beforeCut = framesBeforeCut(shown);
  const startFrame = incomingStartFrame - beforeCut;

  const trueWidth = durationInFrames * px;
  const width = Math.max(trueWidth, MIN_REGION_PX);
  const left = startFrame * px - (width - trueWidth) / 2;

  const beginDrag = (event: React.PointerEvent, mode: TransitionDragMode) => {
    if (locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { mode, startX: event.clientX, base: { ...shown } };
  };
  const moveDrag = (event: React.PointerEvent) => {
    const active = gesture.current;
    if (!active) return;
    const deltaFrames = Math.round((event.clientX - active.startX) / px);
    setPreview(applyTransitionDrag(active.base, active.mode, deltaFrames, maxDurationInFrames));
  };
  const endDrag = (event: React.PointerEvent) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const settled = applyTransitionDrag(
      active.base,
      active.mode,
      Math.round((event.clientX - active.startX) / px),
      maxDurationInFrames,
    );
    setPreview(null);
    // A click that never moved must stay a click: it selects, it does not rewrite.
    if (settled.durationInFrames !== active.base.durationInFrames
      || settled.beforeCutInFrames !== framesBeforeCut(active.base)) onCommit(settled);
    else onSelect();
  };

  const handleProps = (mode: TransitionDragMode) => ({
    onPointerDown: (event: React.PointerEvent) => beginDrag(event, mode),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  });
  const beforePct = Math.round((beforeCut / durationInFrames) * 100);

  return (
    <div
      className={`cc-transition-region${preview ? ' dragging' : ''}${locked ? ' locked' : ''}`}
      style={{ left, width }}
      title={`${label} · ${(durationInFrames / fps).toFixed(1)}s`}
      onContextMenu={onContextMenu}
      {...handleProps('slide')}
    >
      <div
        className="cc-transition-region-handle"
        style={{ left: 0, width: HANDLE_PX }}
        {...handleProps('start')}
      />
      <div
        className="cc-transition-marker"
        style={{ left: `${(beforeCut / durationInFrames) * 100}%` }}
        aria-hidden
      >
        <Icon name="swap" size={10} />
      </div>
      <div
        className="cc-transition-region-handle"
        style={{ right: 0, width: HANDLE_PX }}
        {...handleProps('end')}
      />
      {preview && (
        <div className="cc-transition-region-readout">
          {(durationInFrames / fps).toFixed(2)}s · {beforePct}/{100 - beforePct}
        </div>
      )}
    </div>
  );
}
