import { ProxyVerifyErrorKind, type ProxyVerifyResult } from '@repo/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useGetAdminOperationsQuery, useVerifyScraperProxiesMutation } from '../../api/admin.api';
import { formatProxyRow, formatProxyRows, newProxyRow, parseProxyRows } from '../../utils/proxyRows';

import { ScraperProxiesEditorComponent } from './ScraperProxiesEditor.component';
import { ProxyRowTestState, type ProxyRowField, type ProxyRowState, type ProxyRowTestStatus, type ScraperProxiesEditorProps } from './ScraperProxiesEditor.types';

export const ScraperProxiesEditorContainer = ({
  value,
  disabled,
  onChange,
}: ScraperProxiesEditorProps): React.ReactElement => {
  const [rows, setRows] = useState<ProxyRowState[]>(() => parseProxyRows(value));
  const [rowStatuses, setRowStatuses] = useState<Record<string, ProxyRowTestStatus>>({});
  const [savedResults, setSavedResults] = useState<ProxyVerifyResult[] | null>(null);
  const [savedTestFailed, setSavedTestFailed] = useState(false);
  const [verifyProxies, { isLoading: isSavedTestRunning }] = useVerifyScraperProxiesMutation();
  // The service's own per-proxy tally of REAL traffic (ids are host:port only).
  const { data: operations } = useGetAdminOperationsQuery();
  const proxyStats = operations?.scraperStats?.proxies ?? [];

  // `value` is the setting row's draft, owned by the parent panel. It only
  // ever changes to something OTHER than what we last emitted when it was
  // reset externally (Cancel/Escape, or a successful Save clearing the
  // draft back to '' — this is a write-only secret, so a save never redisplays
  // what was saved). Either way, the rows the admin was editing are stale.
  const lastEmitted = useRef(formatProxyRows(rows));
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const nextRows = parseProxyRows(value);
      setRows(nextRows);
      setRowStatuses({});
      lastEmitted.current = formatProxyRows(nextRows);
    }
    // Only ever react to `value` changing out from under us — recomputing
    // `lastEmitted` on every row edit would defeat this entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = useCallback(
    (nextRows: ProxyRowState[]) => {
      setRows(nextRows);
      const joined = formatProxyRows(nextRows);
      lastEmitted.current = joined;
      onChange(joined);
    },
    [onChange]
  );

  const onFieldChange = useCallback(
    (localId: string, field: ProxyRowField, fieldValue: string) => {
      emit(rows.map((row) => (row.localId === localId ? { ...row, [field]: fieldValue } : row)));
    },
    [rows, emit]
  );

  const onSchemeChange = useCallback(
    (localId: string, scheme: string | number) => {
      emit(rows.map((row) => (row.localId === localId ? { ...row, scheme: String(scheme) as ProxyRowState['scheme'] } : row)));
    },
    [rows, emit]
  );

  const onAddRow = useCallback(() => {
    emit([...rows, newProxyRow()]);
  }, [rows, emit]);

  const onRemoveRow = useCallback(
    (localId: string) => {
      const next = rows.filter((row) => row.localId !== localId);
      emit(next.length > 0 ? next : [newProxyRow()]);
      setRowStatuses((prev) => {
        const { [localId]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [rows, emit]
  );

  const canTestRow = useCallback(
    (localId: string) => {
      const row = rows.find((r) => r.localId === localId);
      return row !== undefined && formatProxyRow(row) !== null;
    },
    [rows]
  );

  const onTestRow = useCallback(
    (localId: string) => {
      const row = rows.find((r) => r.localId === localId);
      const entry = row ? formatProxyRow(row) : null;
      if (!entry) {
        return;
      }
      setRowStatuses((prev) => ({ ...prev, [localId]: { state: ProxyRowTestState.TESTING } }));
      verifyProxies({ proxies: entry })
        .unwrap()
        .then((res) => {
          const result = res.results[0];
          setRowStatuses((prev) => ({
            ...prev,
            [localId]: result
              ? { state: result.ok ? ProxyRowTestState.OK : ProxyRowTestState.FAILED, errorKind: result.errorKind }
              : { state: ProxyRowTestState.FAILED, errorKind: ProxyVerifyErrorKind.OTHER },
          }));
        })
        .catch(() => {
          setRowStatuses((prev) => ({ ...prev, [localId]: { state: ProxyRowTestState.FAILED, errorKind: ProxyVerifyErrorKind.OTHER } }));
        });
    },
    [rows, verifyProxies]
  );

  const onTestSaved = useCallback(() => {
    setSavedTestFailed(false);
    verifyProxies(undefined)
      .unwrap()
      .then((res) => setSavedResults(res.results))
      .catch(() => {
        setSavedResults(null);
        setSavedTestFailed(true);
      });
  }, [verifyProxies]);

  return (
    <ScraperProxiesEditorComponent
      rows={rows}
      rowStatuses={rowStatuses}
      disabled={disabled}
      canTestRow={canTestRow}
      savedResults={savedResults}
      isSavedTestRunning={isSavedTestRunning}
      savedTestFailed={savedTestFailed}
      proxyStats={proxyStats}
      onFieldChange={onFieldChange}
      onSchemeChange={onSchemeChange}
      onAddRow={onAddRow}
      onRemoveRow={onRemoveRow}
      onTestRow={onTestRow}
      onTestSaved={onTestSaved}
    />
  );
};
