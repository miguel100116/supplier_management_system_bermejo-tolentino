import { acquireModalScrollLock } from './useModalScrollLock';
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

function registerHandler(handler: ActiveEscapeHandler, lockScroll: boolean) {
  const releaseScroll = lockScroll ? acquireModalScrollLock() : undefined;
  activeHandlers.set(handler.id, handler);
  if (!listenerAttached) {
    window.addEventListener('keydown', handleModalEscape, true);
    listenerAttached = true;
  }

  return () => {
    activeHandlers.delete(handler.id);
    releaseScroll?.();
    if (activeHandlers.size === 0 && listenerAttached) {
      window.removeEventListener('keydown', handleModalEscape, true);
      listenerAttached = false;
    }
  };
}

/** Register an open modal's Escape action and scroll lock. Pass false as the fourth argument for a popover. */
export function useModalEscape(
  isOpen: boolean,
  onEscape: () => void,
  priority = 0,
  lockScroll = true,
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
    }, lockScroll);
  }, [isOpen, priority, lockScroll]);
}
