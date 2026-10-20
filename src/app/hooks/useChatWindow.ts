import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const SIZE_KEY = 'qualificavix-chat-window-v1';
const DEFAULT_SIZE = { width: 480, height: 680 };
type Size = typeof DEFAULT_SIZE;

function readSize(): Size {
  try {
    const value = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
    if (value && Number.isFinite(value.width) && Number.isFinite(value.height)
      && value.width >= 320 && value.width <= 1200 && value.height >= 320 && value.height <= 1200) return { width: value.width, height: value.height };
  } catch { /* Window preferences must never prevent opening the chat. */ }
  return DEFAULT_SIZE;
}

export function useChatWindow(open: boolean) {
  const [size, setSize] = useState(readSize);
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight, inset: 0 });
  const drag = useRef<(Size & { x: number; y: number; pointerId: number }) | null>(null);

  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* Session resizing still works. */ }
  }, [size]);

  useEffect(() => {
    if (!open) { drag.current = null; return; }
    const visual = window.visualViewport;
    const update = () => setViewport({
      width: visual?.width ?? window.innerWidth,
      height: visual?.height ?? window.innerHeight,
      inset: visual ? Math.max(0, window.innerHeight - visual.height - visual.offsetTop) : 0,
    });
    update();
    window.addEventListener('resize', update);
    visual?.addEventListener('resize', update);
    visual?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      visual?.removeEventListener('resize', update);
      visual?.removeEventListener('scroll', update);
    };
  }, [open]);

  const resize = (width: number, height: number) => {
    setExpanded(false);
    setSize({
      width: Math.round(Math.max(320, Math.min(width, 1200, viewport.width - 32))),
      height: Math.round(Math.max(320, Math.min(height, 1200, viewport.height - 32))),
    });
  };
  const endDrag = () => { drag.current = null; };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panel = event.currentTarget.closest('[role="dialog"]')?.getBoundingClientRect();
    if (!panel) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { width: panel.width, height: panel.height, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    resize(start.width + start.x - event.clientX, start.height + start.y - event.clientY);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const panel = event.currentTarget.closest('[role="dialog"]')?.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 20;
    resize((panel?.width ?? size.width) + direction[0] * step, (panel?.height ?? size.height) + direction[1] * step);
  };
  return {
    size, viewport, expanded, toggleExpanded: () => setExpanded(value => !value),
    resetSize: () => { setSize(DEFAULT_SIZE); setExpanded(false); },
    resizeHandle: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag, onKeyDown },
  };
}
