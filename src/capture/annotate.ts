import type { FeedbackLabels } from '../types';
import { h, icon } from '../ui/dom';
import { icons } from '../ui/icons';

type Tool = 'pen' | 'box' | 'hide';
type Point = [number, number];
type Shape =
  | { tool: 'pen'; color: string; points: Point[] }
  | { tool: 'box' | 'hide'; color: string; from: Point; to: Point };

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'];

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load screenshot'));
    };
    img.src = url;
  });
}

/**
 * Opens a full-screen editor over the screenshot so the user can draw,
 * highlight areas, and black out sensitive data. Resolves with the edited
 * PNG, or `null` if the user cancels.
 */
export async function annotate(root: ShadowRoot, image: Blob, labels: FeedbackLabels): Promise<Blob | null> {
  const img = await loadImage(image);

  return new Promise((resolve) => {
    const shapes: Shape[] = [];
    let current: Shape | null = null;
    let tool: Tool = 'pen';
    let color = COLORS[0];

    const canvas = h('canvas', { class: 'fb-annotate-canvas' });
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    const lineWidth = Math.max(3, Math.round(canvas.width / 400));

    function drawShape(shape: Shape) {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.tool === 'pen') {
        ctx.beginPath();
        shape.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        return;
      }
      const x = Math.min(shape.from[0], shape.to[0]);
      const y = Math.min(shape.from[1], shape.to[1]);
      const w = Math.abs(shape.to[0] - shape.from[0]);
      const hgt = Math.abs(shape.to[1] - shape.from[1]);
      if (shape.tool === 'hide') {
        ctx.fillStyle = '#111827';
        ctx.fillRect(x, y, w, hgt);
      } else {
        ctx.strokeRect(x, y, w, hgt);
      }
    }

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      shapes.forEach(drawShape);
      if (current) drawShape(current);
    }

    function toImagePoint(event: PointerEvent): Point {
      const rect = canvas.getBoundingClientRect();
      return [
        ((event.clientX - rect.left) / rect.width) * canvas.width,
        ((event.clientY - rect.top) / rect.height) * canvas.height,
      ];
    }

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      const point = toImagePoint(event);
      current = tool === 'pen' ? { tool, color, points: [point] } : { tool, color, from: point, to: point };
      redraw();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!current) return;
      const point = toImagePoint(event);
      if (current.tool === 'pen') current.points.push(point);
      else current.to = point;
      redraw();
    });
    const finishShape = () => {
      if (!current) return;
      shapes.push(current);
      current = null;
      redraw();
    };
    canvas.addEventListener('pointerup', finishShape);
    canvas.addEventListener('pointercancel', finishShape);

    const toolButtons = new Map<Tool, HTMLButtonElement>();
    const toolButton = (value: Tool, label: string, svg: string) => {
      const button = h(
        'button',
        { type: 'button', class: 'fb-tool', title: label, 'aria-label': label, 'aria-pressed': String(value === tool) },
        icon(svg),
      );
      button.addEventListener('click', () => {
        tool = value;
        toolButtons.forEach((b, t) => b.setAttribute('aria-pressed', String(t === tool)));
      });
      toolButtons.set(value, button);
      return button;
    };

    const swatches = COLORS.map((value) => {
      const swatch = h('button', {
        type: 'button',
        class: 'fb-swatch',
        style: `background:${value}`,
        'aria-label': value,
        'aria-pressed': String(value === color),
      });
      swatch.addEventListener('click', () => {
        color = value;
        swatches.forEach((s) => s.setAttribute('aria-pressed', String(s === swatch)));
      });
      return swatch;
    });

    const finish = (result: Blob | null) => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(result);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(null);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        shapes.pop();
        redraw();
      }
    };

    const overlay = h(
      'div',
      { class: 'fb-annotate', role: 'dialog', 'aria-modal': 'true' },
      h(
        'div',
        { class: 'fb-annotate-toolbar' },
        toolButton('pen', labels.annotateDraw, icons.pen),
        toolButton('box', labels.annotateBox, icons.square),
        toolButton('hide', labels.annotateHide, icons.eyeOff),
        h('span', { class: 'fb-divider' }),
        ...swatches,
        h('span', { class: 'fb-divider' }),
        h(
          'button',
          { type: 'button', class: 'fb-tool', title: labels.annotateUndo, 'aria-label': labels.annotateUndo, onclick: () => (shapes.pop(), redraw()) },
          icon(icons.undo),
        ),
        h('span', { class: 'fb-spacer' }),
        h('button', { type: 'button', class: 'fb-btn fb-btn-ghost', onclick: () => finish(null) }, labels.annotateCancel),
        h(
          'button',
          {
            type: 'button',
            class: 'fb-btn fb-btn-primary',
            onclick: () => canvas.toBlob((blob) => finish(blob ?? image), 'image/png'),
          },
          labels.annotateDone,
        ),
      ),
      h('div', { class: 'fb-annotate-stage' }, canvas),
    );

    document.addEventListener('keydown', onKeyDown, true);
    root.append(overlay);
    redraw();
  });
}
