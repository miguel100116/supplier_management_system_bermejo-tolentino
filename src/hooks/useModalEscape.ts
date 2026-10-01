import { useEffect, useRef } from 'react';

interface ActiveEscapeHandler {
  id: symbol;
  callback: () => void;
  order: number;
  priority: number;
}

const activeHandlers = new Map<symbol, ActiveEscapeHandler>();
let nextOrder = 0;
let listenerAttached = false;

function handleModalEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;

  const topmost = [...activeHandlers.values()].sort(
    (a, b) => b.priority - a.priority || b.order - a.order,
  )[0];
  if (!topmost) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  topmost.callback();
}

function registerHandler(handler: ActiveEscapeHandler) {
  activeHandlers.set(handler.id, handler);
  if (!listenerAttached) {
    window.addEventListener('keydown', handleModalEscape, true);
    listenerAttached = true;
  }

  return () => {
    activeHandlers.delete(handler.id);
    if (activeHandlers.size === 0 && listenerAttached) {
      window.removeEventListener('keydown', handleModalEscape, true);
      listenerAttached = false;
    }
  };
}

/** Register an open modal's Escape action. Higher layers win, then the latest mount. */
export function useModalEscape(
  isOpen: boolean,
  onEscape: () => void,
  priority = 0,
) {
  const id = useRef(Symbol('modal-escape-handler'));
  const callback = useRef(onEscape);
  callback.current = onEscape;

  useEffect(() => {
    if (!isOpen) return;

    return registerHandler({
      id: id.current,
      callback: () => callback.current(),
      order: ++nextOrder,
      priority,
    });
  }, [isOpen, priority]);
}
