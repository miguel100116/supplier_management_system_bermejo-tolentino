import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomForm, SurveyType } from '../../../types/survey';
import { prepareDefaultSurveysForReactivation } from './surveyReactivation';

const now = new Date(2026, 9, 9, 12);

function form(surveyType: SurveyType, overrides: Partial<CustomForm> = {}): CustomForm {
  return {
    id: `default-${surveyType.toLowerCase()}`,
    title: `${surveyType} Survey`,
    surveyType,
    description: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    status: 'Completed',
    deadlineDate: '31/12/2026',
    questions: [],
    ...overrides,
  };
}

test('reactivates only imported ended standard forms and clears manual end state', () => {
  const courier = form('Courier', { manuallyEndedAt: '2026-10-01T00:00:00.000Z' });
  const supplier = form('Supplier', { manuallyEndedAt: '2026-10-01T00:00:00.000Z' });

  const result = prepareDefaultSurveysForReactivation([courier, supplier], ['Courier'], now);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, courier.id);
  assert.equal(result[0].status, 'Running');
  assert.equal(result[0].manuallyEndedAt, undefined);
  assert.equal(result[0].deadlineDate, '31/12/2026');
});

test('clears an expired deadline so a reopened form is actually Active in Manage Access', () => {
  const supplier = form('Supplier', { status: 'Running', deadlineDate: '01/01/2000' });

  const [reopened] = prepareDefaultSurveysForReactivation([supplier], ['Supplier'], now);

  assert.equal(reopened.status, 'Running');
  assert.equal(reopened.deadlineDate, undefined);
});

test('does not reopen archived, paused, or custom forms', () => {
  const archived = form('Courier', { status: 'Archived', archivedAt: '2026-10-01T00:00:00.000Z' });
  const paused = form('Supplier', { status: 'Paused' });
  const custom = form('Subcontractor', { id: 'custom-subcontractor' });

  assert.deepEqual(
    prepareDefaultSurveysForReactivation([archived, paused, custom], ['Courier', 'Supplier', 'Subcontractor'], now),
    [],
  );
});
