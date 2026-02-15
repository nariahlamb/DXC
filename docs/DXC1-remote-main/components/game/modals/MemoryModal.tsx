import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightCircle, Brain, ChevronLeft, ChevronRight, Database, Filter, Rows3, Table2 } from 'lucide-react';
import type { GameState } from '../../../types';
import type { TavernDBSheetId, TavernDBTableRow, TavernDBTransactionTrace } from '../../../types/taverndb';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { projectGameStateToTavernTables } from '../../../utils/taverndb/tableProjection';
import { getDomainMappingRegistry } from '../../../utils/taverndb/sheetRegistry';
import { handleUpsertSheetRows } from '../../../hooks/gameLogic/extendedCommands';

type PairStatus = 'paired' | 'summary-only' | 'outline-only' | 'none';

type LockStatus = {
  rowLocked: boolean;
  cellLockedFields: string[];
};

const normalizeAmIndex = (value: unknown): string | null => {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return null;
  const matched = text.match(/^AM(\d+)$/);
  if (!matched) return null;
  return `AM${Number(matched[1]).toString().padStart(4, '0')}`;
};

const PairStatusBadge: React.FC<{ status: PairStatus }> = ({ status }) => {
  if (status === 'paired') {
    return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-emerald-900/40 border border-emerald-700/40 text-emerald-300">paired</span>;
  }
  if (status === 'summary-only') {
    return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-900/40 border border-amber-700/40 text-amber-300">summary-only</span>;
  }
  if (status === 'outline-only') {
    return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-blue-900/40 border border-blue-700/40 text-blue-300">outline-only</span>;
  }
  return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-zinc-900 border border-zinc-800 text-zinc-500">none</span>;
};

const LockStatusBadge: React.FC<{ lock: LockStatus }> = ({ lock }) => {
  if (!lock.rowLocked && lock.cellLockedFields.length === 0) {
    return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-zinc-900 border border-zinc-800 text-zinc-500">free</span>;
  }
  if (lock.rowLocked) {
    return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-red-900/40 border border-red-700/40 text-red-300">row-lock</span>;
  }
  return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-900/40 border border-amber-700/40 text-amber-300">cell-lock</span>;
};

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onUpdateGameState?: React.Dispatch<React.SetStateAction<GameState>>;
  embedded?: boolean;
}

interface RowView {
  rawIndex: number;
  row: TavernDBTableRow;
}

interface QualityMetricSnapshot {
  pairingRate: number;
  paired: number;
  total: number;
  missingOutline: number;
  missingSummary: number;
  overlapRate: number;
  highOverlapCount: number;
  overlapTotal: number;
  unknownSlots: number;
  unknownPreview: string;
  pairingSeverity: string;
  overlapSeverity: string;
  unknownSeverity: string;
  battleMapSeverity: string;
  battleMapMessage: string;
  characterSeverity: string;
  characterMessage: string;
}

const ROW_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const normalizeTxTraceId = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  const [base] = text.split(':');
  return base || text;
};

const getRowText = (row: TavernDBTableRow): string => {
  return Object.values(row).map((value) => String(value ?? '')).join(' ').toLowerCase();
};

const parseEditorValue = (raw: string): unknown => {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
  return raw;
};

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onUpdateGameState,
  embedded = false
}) => {
  const tables = useMemo(() => projectGameStateToTavernTables(gameState, { includeEmptySheets: true }), [gameState]);
  const [sheetQuery, setSheetQuery] = useState('');
  const [rowQuery, setRowQuery] = useState('');
  const [selectedSheetId, setSelectedSheetId] = useState<TavernDBSheetId>('LOG_Summary');
  const [selectedRowCursor, setSelectedRowCursor] = useState(0);
  const [rowPage, setRowPage] = useState(0);
  const [rowPageSize, setRowPageSize] = useState<number>(ROW_PAGE_SIZE_OPTIONS[0]);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [replayTxId, setReplayTxId] = useState('');
  const [replayCursor, setReplayCursor] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setSheetQuery('');
    setRowQuery('');
    setSelectedSheetId((prev) => {
      const exists = tables.some((table) => table.id === prev);
      if (exists) return prev;
      const fallback = tables.find((table) => table.id === 'LOG_Summary') || tables[0];
      return (fallback?.id || 'LOG_Summary') as TavernDBSheetId;
    });
    setSelectedRowCursor(0);
    setRowPage(0);
    setReplayTxId('');
    setReplayCursor(0);
  }, [isOpen, tables]);

  const summaryTable = useMemo(() => tables.find((table) => table.id === 'LOG_Summary'), [tables]);
  const outlineTable = useMemo(() => tables.find((table) => table.id === 'LOG_Outline'), [tables]);
  const mappingTable = useMemo(() => tables.find((table) => table.id === 'SYS_MappingRegistry'), [tables]);
  const validationIssueTable = useMemo(() => tables.find((table) => table.id === 'SYS_ValidationIssue'), [tables]);
  const sheetPrimaryKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    getDomainMappingRegistry().forEach((row) => {
      map.set(String(row.sheetId), String(row.primaryKey || ''));
    });
    return map;
  }, []);
  const mappingBySheet = useMemo(() => {
    const map = new Map<string, Array<{ domain: string; module: string; sheetId: string; primaryKey: string; description: string }>>();
    getDomainMappingRegistry().forEach((row) => {
      const key = String(row.sheetId);
      const list = map.get(key) || [];
      list.push({
        domain: String(row.domain || ''),
        module: String(row.module || ''),
        sheetId: String(row.sheetId || ''),
        primaryKey: String(row.primaryKey || ''),
        description: String(row.description || '')
      });
      map.set(key, list);
    });
    return map;
  }, []);
  const txJournal = useMemo(() => (
    Array.isArray((gameState as any)?.__tableMeta?.txJournal)
      ? ((gameState as any).__tableMeta.txJournal as TavernDBTransactionTrace[])
      : []
  ), [gameState]);

  const amPairing = useMemo(() => {
    const summarySet = new Set<string>();
    const outlineSet = new Set<string>();
    const summaryStatus = new Map<number, PairStatus>();
    const outlineStatus = new Map<number, PairStatus>();

    (summaryTable?.rows || []).forEach((row) => {
      const am = normalizeAmIndex(row['编码索引']);
      if (am) summarySet.add(am);
    });
    (outlineTable?.rows || []).forEach((row) => {
      const am = normalizeAmIndex(row['编码索引']);
      if (am) outlineSet.add(am);
    });

    (summaryTable?.rows || []).forEach((row, index) => {
      const am = normalizeAmIndex(row['编码索引']);
      if (!am) {
        summaryStatus.set(index, 'summary-only');
        return;
      }
      summaryStatus.set(index, outlineSet.has(am) ? 'paired' : 'summary-only');
    });

    (outlineTable?.rows || []).forEach((row, index) => {
      const am = normalizeAmIndex(row['编码索引']);
      if (!am) {
        outlineStatus.set(index, 'outline-only');
        return;
      }
      outlineStatus.set(index, summarySet.has(am) ? 'paired' : 'outline-only');
    });

    let paired = 0;
    summarySet.forEach((am) => {
      if (outlineSet.has(am)) paired += 1;
    });

    const total = new Set<string>([...summarySet, ...outlineSet]).size;

    return { summaryStatus, outlineStatus, paired, total };
  }, [summaryTable, outlineTable]);

  const rowLockIndexMap = useMemo(() => {
    const map = new Map<string, LockStatus>();
    const rowLocks = Array.isArray((gameState as any)?.__tableMeta?.rowLocks) ? (gameState as any).__tableMeta.rowLocks : [];
    const cellLocks = Array.isArray((gameState as any)?.__tableMeta?.cellLocks) ? (gameState as any).__tableMeta.cellLocks : [];

    rowLocks.forEach((lock: any) => {
      const sheetId = String(lock?.sheetId || '');
      const rowId = normalizeAmIndex(lock?.rowId) || String(lock?.rowId || '');
      if (!sheetId || !rowId) return;
      const key = `${sheetId}::${rowId}`;
      const current = map.get(key) || { rowLocked: false, cellLockedFields: [] };
      current.rowLocked = true;
      map.set(key, current);
    });

    cellLocks.forEach((lock: any) => {
      const sheetId = String(lock?.sheetId || '');
      const rowId = normalizeAmIndex(lock?.rowId) || String(lock?.rowId || '');
      const field = String(lock?.field || '').trim();
      if (!sheetId || !rowId || !field) return;
      const key = `${sheetId}::${rowId}`;
      const current = map.get(key) || { rowLocked: false, cellLockedFields: [] };
      if (!current.cellLockedFields.includes(field)) {
        current.cellLockedFields.push(field);
      }
      map.set(key, current);
    });

    return map;
  }, [gameState]);

  const visibleTables = useMemo(() => {
    const query = sheetQuery.trim().toLowerCase();
    if (!query) return tables;
    return tables.filter((table) => (
      table.label.toLowerCase().includes(query) ||
      table.id.toLowerCase().includes(query)
    ));
  }, [tables, sheetQuery]);

  const selectedTable = useMemo(() => {
    const explicit = visibleTables.find((table) => table.id === selectedSheetId);
    return explicit || visibleTables[0] || null;
  }, [visibleTables, selectedSheetId]);

  useEffect(() => {
    if (!selectedTable) return;
    if (selectedTable.id !== selectedSheetId) {
      setSelectedSheetId(selectedTable.id as TavernDBSheetId);
    }
  }, [selectedTable, selectedSheetId]);

  const rowViews = useMemo(() => {
    if (!selectedTable) return [] as RowView[];
    const query = rowQuery.trim().toLowerCase();
    const source = selectedTable.rows.map((row, rawIndex) => ({ rawIndex, row }));
    if (!query) return source;
    return source.filter(({ row }) => getRowText(row).includes(query));
  }, [selectedTable, rowQuery]);
  const rowPageCount = useMemo(() => {
    if (rowViews.length === 0) return 1;
    return Math.max(1, Math.ceil(rowViews.length / rowPageSize));
  }, [rowViews.length, rowPageSize]);
  const pagedRowViews = useMemo(() => {
    const start = rowPage * rowPageSize;
    return rowViews.slice(start, start + rowPageSize);
  }, [rowViews, rowPage, rowPageSize]);

  useEffect(() => {
    setSelectedRowCursor(0);
    setRowPage(0);
  }, [selectedSheetId, rowQuery]);

  useEffect(() => {
    if (rowPage < rowPageCount) return;
    setRowPage(Math.max(0, rowPageCount - 1));
  }, [rowPage, rowPageCount]);

  useEffect(() => {
    if (selectedRowCursor < pagedRowViews.length) return;
    setSelectedRowCursor(0);
  }, [selectedRowCursor, pagedRowViews.length]);

  const selectedRowView = pagedRowViews[selectedRowCursor] || null;
  const selectedRow = selectedRowView?.row || null;
  const selectedRawIndex = selectedRowView?.rawIndex ?? -1;

  const showPairColumn = selectedTable?.id === 'LOG_Summary' || selectedTable?.id === 'LOG_Outline';
  const selectedSheetMappings = useMemo(() => (
    selectedTable ? (mappingBySheet.get(selectedTable.id) || []) : []
  ), [mappingBySheet, selectedTable]);
  const mappingTargetSheetId = useMemo(() => {
    if (selectedTable?.id !== 'SYS_MappingRegistry' || !selectedRow) return '';
    return String(selectedRow['sheet_id'] ?? '').trim();
  }, [selectedTable, selectedRow]);
  const canJumpToMappedSheet = useMemo(
    () => !!mappingTargetSheetId && tables.some((table) => table.id === mappingTargetSheetId),
    [mappingTargetSheetId, tables]
  );
  const selectedSheetModule = selectedSheetMappings[0]?.module || '';
  const selectedSheetDomain = selectedSheetMappings[0]?.domain || '';
  const selectedSheetPrimaryKey = selectedSheetMappings[0]?.primaryKey || (selectedTable?.columns[0] || '');
  const selectedSheetPrimaryValue = useMemo(() => {
    if (!selectedRow || !selectedSheetPrimaryKey) return '';
    return String(selectedRow[selectedSheetPrimaryKey] ?? '').trim();
  }, [selectedRow, selectedSheetPrimaryKey]);
  const moduleSheetTargets = useMemo(() => {
    if (!selectedSheetModule) return [] as TavernDBSheetId[];
    return tables
      .filter((table) => (mappingBySheet.get(table.id) || []).some((row) => row.module === selectedSheetModule))
      .map((table) => table.id as TavernDBSheetId);
  }, [tables, mappingBySheet, selectedSheetModule]);
  const replayTrace = useMemo(() => {
    const txId = normalizeTxTraceId(replayTxId);
    if (!txId) return null;
    return txJournal.find((item) => normalizeTxTraceId((item as any)?.txId) === txId) || null;
  }, [txJournal, replayTxId]);
  const replayPatch = useMemo(() => {
    if (!replayTrace || !Array.isArray((replayTrace as any).patches)) return null;
    return (replayTrace as any).patches[replayCursor] || null;
  }, [replayTrace, replayCursor]);

  const resolvePairStatus = (rawIndex: number): PairStatus => {
    if (!selectedTable) return 'none';
    if (selectedTable.id === 'LOG_Summary') return amPairing.summaryStatus.get(rawIndex) || 'summary-only';
    if (selectedTable.id === 'LOG_Outline') return amPairing.outlineStatus.get(rawIndex) || 'outline-only';
    return 'none';
  };

  const resolveLockStatus = (row: TavernDBTableRow): LockStatus => {
    if (!selectedTable) return { rowLocked: false, cellLockedFields: [] };
    if (selectedTable.id !== 'LOG_Summary' && selectedTable.id !== 'LOG_Outline') {
      return { rowLocked: false, cellLockedFields: [] };
    }
    const am = normalizeAmIndex(row['编码索引']);
    if (!am) return { rowLocked: false, cellLockedFields: [] };
    return rowLockIndexMap.get(`${selectedTable.id}::${am}`) || { rowLocked: false, cellLockedFields: [] };
  };

  const totalRows = useMemo(() => tables.reduce((sum, table) => sum + table.rows.length, 0), [tables]);
  const lockCount = useMemo(() => {
    const rowLocks = Array.isArray((gameState as any)?.__tableMeta?.rowLocks) ? (gameState as any).__tableMeta.rowLocks.length : 0;
    const cellLocks = Array.isArray((gameState as any)?.__tableMeta?.cellLocks) ? (gameState as any).__tableMeta.cellLocks.length : 0;
    return { rowLocks, cellLocks };
  }, [gameState]);
  const qualityMetrics = useMemo<QualityMetricSnapshot>(() => {
    const rows = Array.isArray(validationIssueTable?.rows) ? validationIssueTable!.rows : [];
    const metricRows = rows.filter((row) => String(row?.action || '') === 'quality_metric');
    const metricById = new Map<string, TavernDBTableRow>();
    metricRows.forEach((row) => {
      metricById.set(String(row?.issue_id || ''), row);
    });

    const pairingRow = metricById.get('METRIC_AM_PAIRING');
    const overlapRow = metricById.get('METRIC_SUMMARY_OUTLINE_OVERLAP');
    const unknownRow = metricById.get('METRIC_UNKNOWN_SLOTS');
    const battleMapRow = metricById.get('METRIC_DND_BATTLEMAP');
    const characterRow = metricById.get('METRIC_DND_CHARACTER');

    const pairingMessage = String(pairingRow?.message || '');
    const overlapMessage = String(overlapRow?.message || '');
    const unknownMessage = String(unknownRow?.message || '');

    const pairingRateMatch = pairingMessage.match(/AM配对率\s+(\d+)%/);
    const missingOutlineMatch = pairingMessage.match(/missingOutline=(\d+)/);
    const missingSummaryMatch = pairingMessage.match(/missingSummary=(\d+)/);
    const overlapRateMatch = overlapMessage.match(/同质化均值\s+(\d+)%/);
    const highOverlapMatch = overlapMessage.match(/>=88%:\s*(\d+)\/(\d+)/);
    const unknownSlotsMatch = unknownMessage.match(/UNKNOWN_SLOTS=(\d+)/);

    const fallbackPairingRate = amPairing.total > 0
      ? Math.round((amPairing.paired / amPairing.total) * 100)
      : 100;

    const unknownPreview = unknownSlotsMatch && Number(unknownSlotsMatch[1]) > 0
      ? unknownMessage
        .split('|')
        .slice(1)
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .slice(0, 1)
        .join(' ')
      : '';

    return {
      pairingRate: pairingRateMatch ? Number(pairingRateMatch[1]) : fallbackPairingRate,
      paired: amPairing.paired,
      total: amPairing.total,
      missingOutline: missingOutlineMatch ? Number(missingOutlineMatch[1]) : 0,
      missingSummary: missingSummaryMatch ? Number(missingSummaryMatch[1]) : 0,
      overlapRate: overlapRateMatch ? Number(overlapRateMatch[1]) : 0,
      highOverlapCount: highOverlapMatch ? Number(highOverlapMatch[1]) : 0,
      overlapTotal: highOverlapMatch ? Number(highOverlapMatch[2]) : 0,
      unknownSlots: unknownSlotsMatch ? Number(unknownSlotsMatch[1]) : 0,
      unknownPreview,
      pairingSeverity: String(pairingRow?.severity || 'info'),
      overlapSeverity: String(overlapRow?.severity || 'info'),
      unknownSeverity: String(unknownRow?.severity || 'info'),
      battleMapSeverity: String(battleMapRow?.severity || 'info'),
      battleMapMessage: String(battleMapRow?.message || 'BattleMap兼容数据待生成'),
      characterSeverity: String(characterRow?.severity || 'info'),
      characterMessage: String(characterRow?.message || '角色DND字段数据待生成')
    };
  }, [validationIssueTable, amPairing]);

  const getSeverityStyle = (severity: string) => {
    if (severity === 'error') {
      return 'text-red-300 border-red-700/40 bg-red-900/20';
    }
    if (severity === 'warning') {
      return 'text-amber-300 border-amber-700/40 bg-amber-900/20';
    }
    return 'text-emerald-300 border-emerald-700/40 bg-emerald-900/20';
  };
  const selectedAmRowId = useMemo(() => {
    if (!showPairColumn || !selectedRow) return null;
    return normalizeAmIndex(selectedRow['编码索引']);
  }, [showPairColumn, selectedRow]);
  const selectedAuditTxId = useMemo(() => {
    if (selectedTable?.id !== 'SYS_TransactionAudit' || !selectedRow) return '';
    return normalizeTxTraceId(selectedRow['tx_id']);
  }, [selectedTable, selectedRow]);
  const selectedRowLocks = useMemo(() => {
    if (!showPairColumn || !selectedTable || !selectedAmRowId) return [] as any[];
    const locks = Array.isArray((gameState as any)?.__tableMeta?.rowLocks) ? (gameState as any).__tableMeta.rowLocks : [];
    return locks.filter((lock: any) => String(lock?.sheetId || '') === selectedTable.id && String(lock?.rowId || '') === selectedAmRowId);
  }, [gameState, showPairColumn, selectedTable, selectedAmRowId]);
  const selectedCellLocks = useMemo(() => {
    if (!showPairColumn || !selectedTable || !selectedAmRowId) return [] as any[];
    const locks = Array.isArray((gameState as any)?.__tableMeta?.cellLocks) ? (gameState as any).__tableMeta.cellLocks : [];
    return locks.filter((lock: any) => String(lock?.sheetId || '') === selectedTable.id && String(lock?.rowId || '') === selectedAmRowId);
  }, [gameState, showPairColumn, selectedTable, selectedAmRowId]);
  const hasSpecialRowLock = selectedRowLocks.some((lock: any) => String(lock?.owner || '').trim() === 'am-special');
  const hasManualRowLock = selectedRowLocks.some((lock: any) => String(lock?.owner || '').trim() === 'manual-ui');
  const rowEditBlocked = showPairColumn && hasSpecialRowLock && !hasManualRowLock;
  const manualCellFieldSet = useMemo(
    () => new Set(selectedCellLocks
      .filter((lock: any) => String(lock?.owner || '').trim() === 'manual-ui')
      .map((lock: any) => String(lock?.field || '').trim())
      .filter(Boolean)),
    [selectedCellLocks]
  );
  const specialCellFieldSet = useMemo(
    () => new Set(selectedCellLocks
      .filter((lock: any) => String(lock?.owner || '').trim() === 'am-special')
      .map((lock: any) => String(lock?.field || '').trim())
      .filter(Boolean)),
    [selectedCellLocks]
  );
  const lockableColumns = useMemo(() => (
    selectedTable?.columns.filter((column) => column !== '编码索引') || []
  ), [selectedTable]);

  useEffect(() => {
    if (!selectedAuditTxId) return;
    setReplayTxId(selectedAuditTxId);
    setReplayCursor(0);
  }, [selectedAuditTxId]);

  useEffect(() => {
    setEditing(false);
    setEditError('');
    if (!selectedTable || !selectedRow) {
      setEditDraft({});
      return;
    }
    const draft: Record<string, string> = {};
    selectedTable.columns.forEach((column) => {
      const value = selectedRow[column];
      if (typeof value === 'string') {
        draft[column] = value;
      } else if (value === null || value === undefined) {
        draft[column] = '';
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        draft[column] = String(value);
      } else {
        try {
          draft[column] = JSON.stringify(value);
        } catch {
          draft[column] = String(value);
        }
      }
    });
    setEditDraft(draft);
  }, [selectedTable, selectedRow, selectedRawIndex]);

  const handleSaveRowEdit = () => {
    if (!selectedTable || !selectedRow || !onUpdateGameState) return;
    const keyField = sheetPrimaryKeyMap.get(selectedTable.id) || selectedTable.columns[0];
    const keyRaw = editDraft[keyField];
    if (String(keyRaw ?? '').trim() === '') {
      setEditError(`主键字段不能为空: ${keyField}`);
      return;
    }
    const rowPayload: Record<string, unknown> = {};
    selectedTable.columns.forEach((column) => {
      rowPayload[column] = parseEditorValue(editDraft[column] ?? '');
    });

    let writeError = '';
    onUpdateGameState((prev) => {
      const next = structuredClone(prev);
      const result = handleUpsertSheetRows(next, {
        sheetId: selectedTable.id,
        rows: [rowPayload]
      });
      if (!result.success) {
        writeError = result.error || '保存失败';
        return prev;
      }
      return next;
    });

    if (writeError) {
      setEditError(writeError);
      return;
    }
    setEditError('');
    setEditing(false);
  };

  const updateLockMeta = (updater: (meta: any) => any) => {
    if (!onUpdateGameState) return;
    onUpdateGameState((prev) => {
      const currentMeta = (prev as any)?.__tableMeta || {};
      const baseMeta = {
        ...currentMeta,
        rowLocks: Array.isArray(currentMeta.rowLocks) ? [...currentMeta.rowLocks] : [],
        cellLocks: Array.isArray(currentMeta.cellLocks) ? [...currentMeta.cellLocks] : []
      };
      const nextMeta = updater(baseMeta);
      return { ...prev, __tableMeta: nextMeta };
    });
  };

  const handleToggleRowLock = () => {
    if (!selectedTable || !selectedAmRowId || !onUpdateGameState) return;
    if (hasSpecialRowLock && !hasManualRowLock) return;
    const sheetId = selectedTable.id;
    const rowId = selectedAmRowId;
    updateLockMeta((meta) => {
      const rowLocks = Array.isArray(meta.rowLocks) ? [...meta.rowLocks] : [];
      const hasManual = rowLocks.some((lock: any) =>
        String(lock?.sheetId || '') === sheetId
        && String(lock?.rowId || '') === rowId
        && String(lock?.owner || '') === 'manual-ui'
      );
      const nextRowLocks = hasManual
        ? rowLocks.filter((lock: any) => !(
            String(lock?.sheetId || '') === sheetId
            && String(lock?.rowId || '') === rowId
            && String(lock?.owner || '') === 'manual-ui'
          ))
        : [
            ...rowLocks,
            {
              sheetId,
              rowId,
              owner: 'manual-ui',
              reason: 'memory-modal',
              createdAt: Date.now()
            }
          ];
      return { ...meta, rowLocks: nextRowLocks };
    });
  };

  const handleToggleCellLock = (field: string) => {
    if (!selectedTable || !selectedAmRowId || !onUpdateGameState) return;
    const normalizedField = String(field || '').trim();
    if (!normalizedField) return;
    if (specialCellFieldSet.has(normalizedField) && !manualCellFieldSet.has(normalizedField)) return;
    const sheetId = selectedTable.id;
    const rowId = selectedAmRowId;
    updateLockMeta((meta) => {
      const cellLocks = Array.isArray(meta.cellLocks) ? [...meta.cellLocks] : [];
      const hasManual = cellLocks.some((lock: any) =>
        String(lock?.sheetId || '') === sheetId
        && String(lock?.rowId || '') === rowId
        && String(lock?.field || '') === normalizedField
        && String(lock?.owner || '') === 'manual-ui'
      );
      const nextCellLocks = hasManual
        ? cellLocks.filter((lock: any) => !(
            String(lock?.sheetId || '') === sheetId
            && String(lock?.rowId || '') === rowId
            && String(lock?.field || '') === normalizedField
            && String(lock?.owner || '') === 'manual-ui'
          ))
        : [
            ...cellLocks,
            {
              sheetId,
              rowId,
              field: normalizedField,
              owner: 'manual-ui',
              reason: 'memory-modal',
              createdAt: Date.now()
            }
          ];
      return { ...meta, cellLocks: nextCellLocks };
    });
  };

  const tableArea = (
    <div className="flex-1 min-h-0 bg-[#0f0f12] p-4 md:p-5 overflow-hidden">
      <div className="flex flex-col gap-3 h-full min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 shrink-0">
          <div className={`rounded-sm border p-2 ${getSeverityStyle(qualityMetrics.pairingSeverity)}`}>
            <div className="text-[9px] uppercase tracking-widest opacity-80">AM配对率</div>
            <div className="text-lg font-semibold leading-tight mt-1">{qualityMetrics.pairingRate}%</div>
            <div className="text-[10px] opacity-80 mt-1">
              paired {qualityMetrics.paired}/{qualityMetrics.total} · miss O:{qualityMetrics.missingOutline} / S:{qualityMetrics.missingSummary}
            </div>
          </div>
          <div className={`rounded-sm border p-2 ${getSeverityStyle(qualityMetrics.unknownSeverity)}`}>
            <div className="text-[9px] uppercase tracking-widest opacity-80">UNKNOWN_SLOTS</div>
            <div className="text-lg font-semibold leading-tight mt-1">{qualityMetrics.unknownSlots}</div>
            <div className="text-[10px] opacity-80 mt-1 truncate" title={qualityMetrics.unknownPreview || '当前关键槽位均有来源'}>
              {qualityMetrics.unknownPreview || '当前关键槽位均有来源'}
            </div>
          </div>
          <div className={`rounded-sm border p-2 ${getSeverityStyle(qualityMetrics.overlapSeverity)}`}>
            <div className="text-[9px] uppercase tracking-widest opacity-80">Summary/Outline同质化</div>
            <div className="text-lg font-semibold leading-tight mt-1">{qualityMetrics.overlapRate}%</div>
            <div className="text-[10px] opacity-80 mt-1">
              {'>=88%:'} {qualityMetrics.highOverlapCount}/{qualityMetrics.overlapTotal}
            </div>
          </div>
          <div className={`rounded-sm border p-2 ${getSeverityStyle(qualityMetrics.battleMapSeverity)}`}>
            <div className="text-[9px] uppercase tracking-widest opacity-80">BattleMap兼容</div>
            <div className="text-[10px] opacity-90 mt-1 truncate" title={qualityMetrics.battleMapMessage}>
              {qualityMetrics.battleMapMessage}
            </div>
          </div>
          <div className={`rounded-sm border p-2 ${getSeverityStyle(qualityMetrics.characterSeverity)}`}>
            <div className="text-[9px] uppercase tracking-widest opacity-80">角色DND字段</div>
            <div className="text-[10px] opacity-90 mt-1 truncate" title={qualityMetrics.characterMessage}>
              {qualityMetrics.characterMessage}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_300px] gap-3 flex-1 min-h-0">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-zinc-800/70">
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Database size={12} /> Sheets
            </div>
            <div className="text-[10px] text-zinc-600 mb-2">
              映射字典: {mappingTable?.rows.length || 0} 条
            </div>
            <div className="relative">
              <input
                className="w-full bg-black/40 border border-zinc-800 text-zinc-300 text-[11px] px-2 py-1.5 rounded-sm outline-none focus:border-zinc-600"
                placeholder="筛选表名"
                value={sheetQuery}
                onChange={(event) => setSheetQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-2 space-y-1">
            {visibleTables.map((table) => {
              const active = selectedTable?.id === table.id;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedSheetId(table.id)}
                  className={`w-full text-left px-2 py-2 rounded-sm border transition-colors ${active ? 'bg-purple-900/30 border-purple-700/50 text-purple-200' : 'bg-black/30 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}
                >
                  <div className="text-[11px] font-semibold">{table.label}</div>
                  <div className="text-[9px] font-mono mt-0.5">{table.id} · {table.rows.length}</div>
                </button>
              );
            })}
            {visibleTables.length === 0 && (
              <div className="text-[10px] text-zinc-600 italic p-2">无匹配数据表</div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-zinc-800/70">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Table2 size={12} /> {selectedTable?.label || 'Table'}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono">
                Rows {rowViews.length === 0 ? '0' : `${rowPage * rowPageSize + 1}-${Math.min(rowViews.length, (rowPage + 1) * rowPageSize)}`}/{rowViews.length}
              </div>
            </div>
            <div className="mt-2 relative">
              <Filter size={12} className="absolute left-2 top-1.5 text-zinc-600" />
              <input
                className="w-full bg-black/40 border border-zinc-800 text-zinc-300 text-[11px] pl-7 pr-2 py-1.5 rounded-sm outline-none focus:border-zinc-600"
                placeholder="按当前表内容搜索"
                value={rowQuery}
                onChange={(event) => setRowQuery(event.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRowPage((prev) => Math.max(0, prev - 1))}
                  disabled={rowPage <= 0}
                  className="px-1.5 py-0.5 text-[10px] rounded-sm border border-zinc-700 text-zinc-300 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500 inline-flex items-center"
                >
                  <ChevronLeft size={11} />
                </button>
                <span className="text-[10px] text-zinc-500 font-mono">Page {rowPage + 1}/{rowPageCount}</span>
                <button
                  type="button"
                  onClick={() => setRowPage((prev) => Math.min(rowPageCount - 1, prev + 1))}
                  disabled={rowPage >= rowPageCount - 1}
                  className="px-1.5 py-0.5 text-[10px] rounded-sm border border-zinc-700 text-zinc-300 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500 inline-flex items-center"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
              <select
                value={rowPageSize}
                onChange={(event) => {
                  setRowPageSize(Number(event.target.value) || ROW_PAGE_SIZE_OPTIONS[0]);
                  setRowPage(0);
                  setSelectedRowCursor(0);
                }}
                className="bg-black/40 border border-zinc-800 text-zinc-300 text-[10px] px-1.5 py-1 rounded-sm outline-none focus:border-zinc-600"
              >
                {ROW_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}/page</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {!selectedTable ? (
              <div className="p-3 text-[10px] text-zinc-600 italic">请先选择一个数据表</div>
            ) : (
              <table className="min-w-full text-[10px]">
                <thead className="sticky top-0 bg-zinc-900/95 border-b border-zinc-800">
                  <tr className="text-zinc-500">
                    <th className="text-left px-2 py-1.5 font-medium w-14">#</th>
                    {selectedTable.columns.map((column) => (
                      <th key={column} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{column}</th>
                    ))}
                    {showPairColumn && <th className="text-left px-2 py-1.5 font-medium">配对</th>}
                    {showPairColumn && <th className="text-left px-2 py-1.5 font-medium">锁</th>}
                  </tr>
                </thead>
                <tbody>
                  {pagedRowViews.map((rowView, cursor) => {
                    const active = selectedRowCursor === cursor;
                    const pairStatus = resolvePairStatus(rowView.rawIndex);
                    const lockStatus = resolveLockStatus(rowView.row);
                    return (
                      <tr
                        key={`${selectedTable.id}-${rowView.rawIndex}`}
                        className={`border-b border-zinc-900 cursor-pointer ${active ? 'bg-purple-900/20' : 'hover:bg-zinc-900/30'}`}
                        onClick={() => setSelectedRowCursor(cursor)}
                      >
                        <td className="px-2 py-1.5 text-zinc-500 font-mono">{rowView.rawIndex + 1}</td>
                        {selectedTable.columns.map((column) => (
                          <td key={column} className="px-2 py-1.5 text-zinc-300 whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis">
                            {String(rowView.row[column] ?? '-')}
                          </td>
                        ))}
                        {showPairColumn && (
                          <td className="px-2 py-1.5"><PairStatusBadge status={pairStatus} /></td>
                        )}
                        {showPairColumn && (
                          <td className="px-2 py-1.5"><LockStatusBadge lock={lockStatus} /></td>
                        )}
                      </tr>
                    );
                  })}
                  {pagedRowViews.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-zinc-600 italic" colSpan={selectedTable.columns.length + (showPairColumn ? 3 : 1)}>无匹配行</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-zinc-800/70">
            <div className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Rows3 size={12} /> Row Detail
            </div>
            <div className="text-[9px] text-zinc-600 font-mono mt-1">
              {selectedTable?.id || '-'}#{selectedRawIndex >= 0 ? selectedRawIndex + 1 : '-'}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3 space-y-2">
            {!selectedRow ? (
              <div className="text-[10px] text-zinc-600 italic">选择一行查看字段详情</div>
            ) : (
              <>
                {showPairColumn && (
                  <div className="border border-zinc-800/70 bg-black/30 rounded-sm p-2 space-y-2">
                    <div className="text-[9px] uppercase tracking-wide text-zinc-500">Lock Controls</div>
                    {!selectedAmRowId ? (
                      <div className="text-[10px] text-zinc-600">当前行无可识别 AM 编码索引，无法管理锁。</div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] text-zinc-400">AM: <span className="font-mono text-zinc-300">{selectedAmRowId}</span></div>
                          <button
                            type="button"
                            onClick={handleToggleRowLock}
                            disabled={!onUpdateGameState || (hasSpecialRowLock && !hasManualRowLock)}
                            className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                          >
                            {hasManualRowLock ? '解除行锁' : (hasSpecialRowLock ? 'AM 行锁(只读)' : '锁定行')}
                          </button>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          行锁拥有者: {selectedRowLocks.length > 0 ? selectedRowLocks.map((lock: any) => String(lock?.owner || 'unknown')).join(', ') : 'none'}
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-500">字段锁</div>
                          <div className="max-h-24 overflow-auto custom-scrollbar space-y-1 pr-1">
                            {lockableColumns.map((field) => {
                              const manualLocked = manualCellFieldSet.has(field);
                              const specialLocked = specialCellFieldSet.has(field);
                              const readOnlySpecial = specialLocked && !manualLocked;
                              return (
                                <label key={field} className="flex items-center justify-between gap-2 text-[10px] text-zinc-300">
                                  <span className="truncate">{field}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCellLock(field)}
                                    disabled={!onUpdateGameState || readOnlySpecial}
                                    className="px-1.5 py-0.5 rounded-sm border border-zinc-700 text-zinc-300 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                                  >
                                    {manualLocked ? '解锁' : (specialLocked ? 'AM锁' : '加锁')}
                                  </button>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selectedTable?.id === 'SYS_MappingRegistry' && (
                  <div className="border border-zinc-800/70 bg-black/30 rounded-sm p-2 space-y-2">
                    <div className="text-[9px] uppercase tracking-wide text-zinc-500">Mapping Jump</div>
                    <div className="text-[10px] text-zinc-400">
                      domain: <span className="font-mono text-zinc-300">{String(selectedRow['domain'] ?? '-')}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      module: <span className="font-mono text-zinc-300">{String(selectedRow['module'] ?? '-')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-zinc-400">
                        target: <span className="font-mono text-zinc-300">{mappingTargetSheetId || '-'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!canJumpToMappedSheet || !mappingTargetSheetId) return;
                          setSelectedSheetId(mappingTargetSheetId as TavernDBSheetId);
                          setSelectedRowCursor(0);
                        }}
                        disabled={!canJumpToMappedSheet}
                        className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500 inline-flex items-center gap-1"
                      >
                        <ArrowRightCircle size={12} />
                        跳转表
                      </button>
                    </div>
                  </div>
                )}
                {selectedTable?.id !== 'SYS_MappingRegistry' && (
                  <div className="border border-zinc-800/70 bg-black/30 rounded-sm p-2 space-y-2">
                    <div className="text-[9px] uppercase tracking-wide text-zinc-500">Module Locator</div>
                    <div className="text-[10px] text-zinc-400">
                      module: <span className="font-mono text-zinc-300">{selectedSheetModule || '-'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      domain: <span className="font-mono text-zinc-300">{selectedSheetDomain || '-'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      key: <span className="font-mono text-zinc-300">{selectedSheetPrimaryKey || '-'}</span>
                      {' = '}
                      <span className="font-mono text-zinc-300">{selectedSheetPrimaryValue || '-'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedSheetModule) return;
                          setSheetQuery(selectedSheetModule);
                          if (moduleSheetTargets.length > 0) {
                            setSelectedSheetId(moduleSheetTargets[0]);
                            setSelectedRowCursor(0);
                            setRowPage(0);
                          }
                        }}
                        disabled={!selectedSheetModule || moduleSheetTargets.length === 0}
                        className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                      >
                        同模块跳转
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedSheetPrimaryValue) return;
                          setRowQuery(selectedSheetPrimaryValue);
                          setRowPage(0);
                          setSelectedRowCursor(0);
                        }}
                        disabled={!selectedSheetPrimaryValue}
                        className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                      >
                        主键定位
                      </button>
                    </div>
                  </div>
                )}
                {selectedTable?.id === 'SYS_TransactionAudit' && (
                  <div className="border border-zinc-800/70 bg-black/30 rounded-sm p-2 space-y-2">
                    <div className="text-[9px] uppercase tracking-wide text-zinc-500">Transaction Replay</div>
                    <div className="text-[10px] text-zinc-400">
                      tx: <span className="font-mono text-zinc-300">{replayTrace?.txId || selectedAuditTxId || '-'}</span>
                    </div>
                    {!replayTrace ? (
                      <div className="text-[10px] text-zinc-600">该事务暂无 patch 轨迹，可能由旧版本产生。</div>
                    ) : (
                      <>
                        <div className="text-[10px] text-zinc-500">
                          status={String((replayTrace as any).status || '')} · commands={Number((replayTrace as any).commandCount || 0)} · patches={Number((replayTrace as any).patchCount || 0)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReplayCursor((prev) => Math.max(0, prev - 1))}
                            disabled={replayCursor <= 0}
                            className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                          >
                            上一步
                          </button>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {replayPatch ? `${replayCursor + 1}/${(replayTrace as any).patches.length}` : '0/0'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReplayCursor((prev) => Math.min(Math.max(0, ((replayTrace as any).patches.length || 1) - 1), prev + 1))}
                            disabled={!replayPatch || replayCursor >= ((replayTrace as any).patches.length || 0) - 1}
                            className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                          >
                            下一步
                          </button>
                        </div>
                        {replayPatch && (
                          <div className="text-[10px] text-zinc-300 space-y-1">
                            <div>
                              <span className="text-zinc-500">op:</span> <span className="font-mono">{String((replayPatch as any).operation || '')}</span>
                              {' · '}
                              <span className="text-zinc-500">sheet:</span> <span className="font-mono">{String((replayPatch as any).sheetId || '')}</span>
                              {' · '}
                              <span className="text-zinc-500">row:</span> <span className="font-mono">{String((replayPatch as any).rowId || '')}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">fields:</span> <span className="font-mono">{Array.isArray((replayPatch as any).changedFields) && (replayPatch as any).changedFields.length > 0 ? (replayPatch as any).changedFields.join(', ') : '-'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const targetSheet = String((replayPatch as any).sheetId || '').trim();
                                if (!targetSheet || !tables.some((table) => table.id === targetSheet)) return;
                                setSelectedSheetId(targetSheet as TavernDBSheetId);
                                setSelectedRowCursor(0);
                                setRowPage(0);
                              }}
                              className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 hover:border-zinc-500"
                            >
                              跳转受影响表
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {selectedTable?.id !== 'SYS_MappingRegistry' && (
                  <div className="border border-zinc-800/70 bg-black/30 rounded-sm p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[9px] uppercase tracking-wide text-zinc-500">Row Edit</div>
                      <div className="flex items-center gap-1.5">
                        {!editing ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(true);
                              setEditError('');
                            }}
                            disabled={!onUpdateGameState || rowEditBlocked}
                            className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-200 disabled:text-zinc-600 disabled:border-zinc-800 hover:border-zinc-500"
                          >
                            编辑行
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(false);
                                setEditError('');
                              }}
                              className="px-2 py-1 text-[10px] rounded-sm border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveRowEdit}
                              className="px-2 py-1 text-[10px] rounded-sm border border-emerald-700 text-emerald-300 hover:border-emerald-500"
                            >
                              保存
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {rowEditBlocked && (
                      <div className="text-[10px] text-amber-300">该行存在 `am-special` 锁，需先解除特殊锁后再编辑。</div>
                    )}
                    {editError && (
                      <div className="text-[10px] text-red-300">{editError}</div>
                    )}
                    {editing && (
                      <div className="text-[10px] text-zinc-500">
                        保存会通过 `upsert_sheet_rows` 回写到表与对应模块状态。
                      </div>
                    )}
                  </div>
                )}
                {selectedTable?.columns.map((column) => (
                  <div key={column} className="border border-zinc-800/70 bg-black/30 rounded-sm p-2">
                    <div className="text-[9px] uppercase tracking-wide text-zinc-500 mb-1">{column}</div>
                    {editing ? (
                      <textarea
                        value={editDraft[column] ?? ''}
                        onChange={(event) => setEditDraft((prev) => ({ ...prev, [column]: event.target.value }))}
                        className="w-full min-h-[48px] bg-black/50 border border-zinc-700 text-zinc-200 text-[11px] px-2 py-1 rounded-sm outline-none focus:border-zinc-500 whitespace-pre-wrap"
                      />
                    ) : (
                      <div className="text-[11px] text-zinc-200 whitespace-pre-wrap break-all">{String(selectedRow[column] ?? '-')}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  const footer = (
    <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-500">
      <span>Template-driven sheets: {tables.length} / rows: {totalRows}</span>
      <span>AM pairing: {amPairing.paired}/{amPairing.total} · locks: R{lockCount.rowLocks}/C{lockCount.cellLocks}</span>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {tableArea}
        <div className="shrink-0 px-4 py-2 border-t border-white/5 bg-black/20">{footer}</div>
      </div>
    );
  }

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Memory Tables"
      icon={<Brain size={20} />}
      size="xl"
      theme="default"
      footer={footer}
      className="flex flex-col"
    >
      {tableArea}
    </ModalWrapper>
  );
};
