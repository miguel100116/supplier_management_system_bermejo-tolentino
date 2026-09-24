/**
 * Accessible neutral fills for active-company cells.
 *
 * Keep the text color dark when changing a background. The accompanying
 * border is a slightly stronger shade of the same family so adjacent cells
 * remain distinct without relying on saturated color.
 */
export const ACTIVE_COMPANY_CELL_PALETTE = [
  { backgroundColor: '#F1F3F4', borderColor: '#DADCE0', color: '#1F2937' }, // Subtle gray
  { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#1F2937' }, // White
] as const;

export function getActiveCompanyCellColors(index: number) {
  return ACTIVE_COMPANY_CELL_PALETTE[index % ACTIVE_COMPANY_CELL_PALETTE.length];
}
