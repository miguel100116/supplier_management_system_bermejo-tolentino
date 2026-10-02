let lockCount = 0;
let restoreScroll: (() => void) | null = null;

/** Freeze document scrolling while keeping the visible page and scrollbar width stable. */
export function lockPageScroll(browserWindow: Window, pageDocument: Document): () => void {
  const body = pageDocument.body;
  const root = pageDocument.documentElement;
  const x = browserWindow.scrollX;
  const y = browserWindow.scrollY;
  const previous = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    rootOverflow: root.style.overflow,
  };
  const scrollbarWidth = Math.max(0, browserWindow.innerWidth - root.clientWidth);
  const existingPadding = parseFloat(browserWindow.getComputedStyle(body).paddingRight) || 0;

  root.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = '-' + y + 'px';
  body.style.left = '-' + x + 'px';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (scrollbarWidth) body.style.paddingRight = existingPadding + scrollbarWidth + 'px';

  return () => {
    body.style.position = previous.position;
    body.style.top = previous.top;
    body.style.left = previous.left;
    body.style.right = previous.right;
    body.style.width = previous.width;
    body.style.overflow = previous.overflow;
    body.style.paddingRight = previous.paddingRight;
    root.style.overflow = previous.rootOverflow;
    browserWindow.scrollTo(x, y);
  };
}

/** Multiple open dialogs share one lock; the final close restores the original page position. */
export function acquireModalScrollLock(
  browserWindow: Window = window,
  pageDocument: Document = document,
): () => void {
  if (lockCount === 0) restoreScroll = lockPageScroll(browserWindow, pageDocument);
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      restoreScroll?.();
      restoreScroll = null;
    }
  };
}
