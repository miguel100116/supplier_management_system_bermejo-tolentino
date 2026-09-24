import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_COMPANY_CELL_PALETTE,
  getActiveCompanyCellColors,
} from './companyCellStyles';

test('alternates gray then white across company cells', () => {
  assert.equal(ACTIVE_COMPANY_CELL_PALETTE[0].backgroundColor, '#F1F3F4');
  assert.equal(ACTIVE_COMPANY_CELL_PALETTE[1].backgroundColor, '#FFFFFF');
  assert.deepEqual(getActiveCompanyCellColors(0), ACTIVE_COMPANY_CELL_PALETTE[0]);
  assert.deepEqual(getActiveCompanyCellColors(1), ACTIVE_COMPANY_CELL_PALETTE[1]);
  assert.deepEqual(getActiveCompanyCellColors(2), ACTIVE_COMPANY_CELL_PALETTE[0]);
  assert.deepEqual(getActiveCompanyCellColors(3), ACTIVE_COMPANY_CELL_PALETTE[1]);
});

test('keeps dark text on every light background', () => {
  for (const colors of ACTIVE_COMPANY_CELL_PALETTE) {
    assert.equal(colors.color, '#1F2937');
  }
});
