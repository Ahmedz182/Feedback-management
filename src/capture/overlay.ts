import { h } from '../ui/dom';

type Point = [number, number];

export interface OverlayOptions {
  /** Show a halo around the cursor and a ripple on every click. */
  cursor: boolean;
  /** Called when the user finishes a drawn stroke (points are in viewport pixels). */
  onStroke?: (points: Point[]) => void;
}

const STROKE_COLOR = '#ef4444';
const STROKE_WIDTH = 4;

/**
 * Elements drawn over the page while recording. A tab recording captures
 * them, so the video shows the cursor, clicks, and anything the user draws
 * to point things out.
 */
export class RecordingOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly cursor: HTMLElement | null;
  private readonly container: HTMLElement;
  private strokes: Point[][] = [];
  private current: Point[] | null = null;
  private drawing = false;

  constructor(root: ShadowRoot, private readonly options: OverlayOptions) {
    this.canvas = h('canvas', { class: 'fb-draw-layer' });
    this.cursor = options.cursor ? h('div', { class: 'fb-cursor', hidden: true }) : null;
    this.container = h('div', { class: 'fb-overlay', 'aria-hidden': 'true' }, this.canvas, this.cursor);
    // Insert before the recording bar so the toolbar stays clickable above the drawing layer.
    root.insertBefore(this.container, root.querySelector('.fb-recording'));

    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true });
    document.addEventListener('pointerdown', this.onPointerDown, { capture: true, passive: true });
    this.canvas.addEventListener('pointerdown', this.startStroke);
    this.canvas.addEventListener('pointermove', this.extendStroke);
    this.canvas.addEventListener('pointerup', this.endStroke);
    this.canvas.addEventListener('pointercancel', this.endStroke);
  }

  get isDrawing(): boolean {
    return this.drawing;
  }

  /** Turns draw mode on or off. While on, the page underneath can't be clicked. */
  setDrawing(on: boolean): void {
    this.drawing = on;
    this.canvas.classList.toggle('fb-draw-active', on);
  }

  clear(): void {
    this.strokes = [];
    this.redraw();
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('pointermove', this.onPointerMove, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.container.remove();
  }

  private resize = () => {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * ratio);
    this.canvas.height = Math.round(window.innerHeight * ratio);
    this.redraw();
  };

  private redraw() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of this.current ? [...this.strokes, this.current] : this.strokes) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.cursor) return;
    this.cursor.hidden = false;
    this.cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.options.cursor) return;
    const ripple = h('div', { class: 'fb-ripple', style: `left:${event.clientX}px;top:${event.clientY}px` });
    ripple.addEventListener('animationend', () => ripple.remove());
    this.container.append(ripple);
  };

  private startStroke = (event: PointerEvent) => {
    if (!this.drawing) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.current = [[event.clientX, event.clientY]];
  };

  private extendStroke = (event: PointerEvent) => {
    if (!this.current) return;
    this.current.push([event.clientX, event.clientY]);
    this.redraw();
  };

  private endStroke = () => {
    if (!this.current) return;
    const stroke = this.current;
    this.current = null;
    this.strokes.push(stroke);
    this.redraw();
    this.options.onStroke?.(stroke.map(([x, y]) => [Math.round(x), Math.round(y)]));
  };
}
