import { useCallback, useEffect, useState } from 'react';
import type { SurveyType } from '../../../types/survey';
import {
  downloadEvaluationImportArchive,
  discardPendingEvaluationImportArchive,
  loadEvaluationImportArchives,
  removeOrdinaryEvaluationImport,
  removeTestEvaluationImport,
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

  const archiveSourceFile = useCallback(async (file: File, surveyType: SurveyType | 'Combined', importBatchId: string) => {
    const archive = await saveEvaluationImportArchive(file, surveyType, uploadedBy, importBatchId);
    setArchives((current) => [archive, ...current.filter((item) => item.id !== archive.id)]
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)));
    return archive;
  }, [uploadedBy]);

  const discardPendingArchive = useCallback(async (archive: EvaluationImportArchive) => {
    await discardPendingEvaluationImportArchive(archive);
    setArchives((current) => current.filter((item) => item.id !== archive.id));
  }, []);

  const downloadSourceFile = useCallback((archive: EvaluationImportArchive) => (
    downloadEvaluationImportArchive(archive)
  ), []);

  const removeTestImport = useCallback(async (archive: EvaluationImportArchive) => {
    const result = await removeTestEvaluationImport(archive);
    setArchives((current) => current.filter((item) => item.id !== archive.id));
    return result;
  }, []);

  const removeOrdinaryImport = useCallback(async (archive: EvaluationImportArchive) => {
    const result = await removeOrdinaryEvaluationImport(archive);
    setArchives((current) => current.filter((item) => item.id !== archive.id));
    return result;
  }, []);

  return { archives, isLoading, loadError, archiveSourceFile, discardPendingArchive, downloadSourceFile, removeTestImport, removeOrdinaryImport };
}
