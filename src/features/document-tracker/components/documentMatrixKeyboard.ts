const HORIZONTAL_SCROLL_STEP = 160;

export interface HorizontalScrollSurface {
  scrollBy(options: ScrollToOptions): void;
}

/** Scrolls the document matrix one column at a time for horizontal arrow keys. */
export function scrollDocumentMatrixWithArrowKey(
  surface: HorizontalScrollSurface,
  key: string,
): boolean {
  const left = key === 'ArrowLeft'
    ? -HORIZONTAL_SCROLL_STEP
    : key === 'ArrowRight'
      ? HORIZONTAL_SCROLL_STEP
      : null;

  if (left === null) return false;

  surface.scrollBy({ left, behavior: 'smooth' });
  return true;
}
