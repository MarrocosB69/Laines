import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages the save status indicator shared across all evaluation forms.
 * States: null | 'saving' | 'saved' | 'error'
 * 'saved' and 'error' auto-reset to null after 3 seconds.
 */
export function useSaveStatus() {
  const [saveStatus, setSaveStatus] = useState(null);
  const resetRef = useRef(null);

  const setSaving = useCallback(() => {
    if (resetRef.current) clearTimeout(resetRef.current);
    setSaveStatus('saving');
  }, []);

  const setSuccess = useCallback(() => {
    setSaveStatus('saved');
    resetRef.current = setTimeout(() => setSaveStatus(null), 3000);
  }, []);

  const setFailure = useCallback(() => {
    setSaveStatus('error');
    resetRef.current = setTimeout(() => setSaveStatus(null), 3000);
  }, []);

  useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  return { saveStatus, setSaving, setSuccess, setFailure };
}
