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
/** Below this the region has no room for a name next to its icon. */
const LABEL_MIN_PX = 76;

interface TransitionRegionProps {
  span: TransitionSpan;
  /** Longest this transition may become: neither neighbouring clip can lend more. */
  maxDurationInFrames: number;
  incomingStartFrame: number;
  label: string;
  px: number;
  fps: number;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  onCommit: (span: ResolvedSpan) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

/**
 * The transition, drawn as the one thing it is: a stretch of timeline straddling a
 * cut, which is also the thing you grab.
 *
 * It used to be a 16px chip pinned to the cut. The chip could only be clicked, so
 * the duration had nowhere to show and neither end could be pulled. Widening the
 * chip into a region while keeping the chip inside it would leave two competing
 * marks for one transition, which no editor does: the region carries the icon and
 * the name itself, and the cut shows as a hairline inside it so an off-centre
 * transition still says where the join actually falls.
 */
export function TransitionRegion({
  span, maxDurationInFrames, incomingStartFrame, label, px, fps, locked, selected,
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
    // Right and middle buttons must not arm a drag: preventDefault on a right-button
    // pointerdown suppresses the context menu the user was actually after, and the
    // matching pointerup would then land as a plain click.
    if (event.button !== 0) return;
    if (locked) {
      onSelect();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // A synthetic or already-released pointer cannot be captured; the gesture still
    // tracks correctly from the events themselves, so this must not abort the drag.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
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
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* never captured */ }
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

  // A cancelled pointer (OS gesture, window blur) is an abandoned drag, not a
  // finished one: drop the preview rather than writing where the hand happened to be.
  const cancelDrag = () => {
    gesture.current = null;
    setPreview(null);
  };
  const handleProps = (mode: TransitionDragMode) => ({
    onPointerDown: (event: React.PointerEvent) => beginDrag(event, mode),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
  });
  const beforeRatio = beforeCut / durationInFrames;
  const beforePct = Math.round(beforeRatio * 100);

  return (
    <div
      className={`cc-transition-region${selected ? ' selected' : ''}${preview ? ' dragging' : ''}${locked ? ' locked' : ''}`}
      style={{ left, width }}
      title={`${label} · ${(durationInFrames / fps).toFixed(1)}s`}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      onContextMenu={onContextMenu}
      {...handleProps('slide')}
    >
      <div
        className="cc-transition-region-handle"
        style={{ left: 0, width: HANDLE_PX }}
        {...handleProps('start')}
      />
      {/* where the two clips actually join, which stops being the middle as soon as
          the region is slid across the cut */}
      <div className="cc-transition-region-cut" style={{ left: `${beforeRatio * 100}%` }} aria-hidden />
      <div className="cc-transition-region-body" aria-hidden>
        <Icon name="swap" size={10} />
        {width >= LABEL_MIN_PX && <span className="cc-transition-region-label">{label}</span>}
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
