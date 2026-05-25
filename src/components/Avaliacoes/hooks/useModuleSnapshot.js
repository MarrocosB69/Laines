import { useEffect, useRef } from 'react';

/**
 * Handles the snapshot loading guard pattern shared across all evaluation forms.
 *
 * Calls `onLoad(source, input, moduleSnapshot)` exactly once per unique snapshot id.
 * `onLoad` can be an inline function — it is stored in a ref so it never needs to be
 * memoized by the caller.
 *
 * @param {object} moduleSnapshot - The snapshot object from the parent
 * @param {function} onLoad - Called with (source, input, moduleSnapshot) when a new snapshot arrives
 */
export function useModuleSnapshot(moduleSnapshot, onLoad) {
  const loadedIdRef = useRef('');
  const onLoadRef = useRef(onLoad);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const input = source?.input || {};

    onLoadRef.current(source, input, moduleSnapshot);
    loadedIdRef.current = snapshotId;
  }, [moduleSnapshot]);
}
