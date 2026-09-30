import { useCallback, useEffect, useState } from 'react';
import type { SurveyType } from '../../../types/survey';
import {
  downloadEvaluationImportArchive,
  loadEvaluationImportArchives,
  saveEvaluationImportArchive,
} from '../services/evaluationImportArchiveService';
import type { EvaluationImportArchive } from '../domain/importArchive';

export function useEvaluationImportArchives(uploadedBy: string) {
  const [archives, setArchives] = useState<EvaluationImportArchive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError('');
    void loadEvaluationImportArchives()
      .then((loaded) => {
        if (isCurrent) {
          setArchives((current) => {
            const byId = new Map(loaded.map((archive) => [archive.id, archive]));
            current.forEach((archive) => byId.set(archive.id, archive));
            return [...byId.values()].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
          });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadError(error instanceof Error ? error.message : 'Unable to load archived source files.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [uploadedBy]);

  const archiveSourceFile = useCallback(async (file: File, surveyType: SurveyType, importBatchId: string) => {
    const archive = await saveEvaluationImportArchive(file, surveyType, uploadedBy, importBatchId);
    setArchives((current) => [archive, ...current.filter((item) => item.id !== archive.id)]
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)));
  }, [uploadedBy]);

  const downloadSourceFile = useCallback((archive: EvaluationImportArchive) => (
    downloadEvaluationImportArchive(archive)
  ), []);

  return { archives, isLoading, loadError, archiveSourceFile, downloadSourceFile };
}
