import JSZip from 'jszip';
import { GameState } from '../types';

export interface SaveExportPayload {
  id: 'export';
  type: 'EXPORT';
  timestamp: number;
  summary: string;
  data: GameState;
  version: string;
}

export interface ParsedSavePayload {
  payload: any;
  stateToLoad: GameState;
  summary: string;
  timeStr: string;
}

const parseSaveText = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('存档格式错误（无效 JSON）');
  }
};

export const buildSaveExportPayload = (gameState: GameState): SaveExportPayload => ({
  id: 'export',
  type: 'EXPORT',
  timestamp: Date.now(),
  summary: `存档: ${gameState.角色?.姓名 || '未知角色'} - Lv.${gameState.角色?.等级 || '1'}`,
  data: gameState,
  version: '3.1'
});

export const downloadSaveAsZip = async (payload: SaveExportPayload, fileBaseName: string) => {
  const zip = new JSZip();
  zip.file('save.json', JSON.stringify(payload, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBaseName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const readZipJson = async (file: File): Promise<any> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const jsonEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.json')
  );

  if (!jsonEntry) {
    throw new Error('ZIP 中未找到 JSON 存档文件');
  }

  const jsonText = await jsonEntry.async('string');
  return parseSaveText(jsonText);
};

const readJson = async (file: File): Promise<any> => {
  const text = await file.text();
  return parseSaveText(text);
};

const normalizeLegacyState = (state: any) => {
  if (!state || typeof state !== 'object') return state;

  // 兼容旧英文字段
  if (state.character && !state.角色) state.角色 = state.character;
  if (state.inventory && !state.背包) state.背包 = state.inventory;
  if (state.logs && !state.日志) state.日志 = state.logs;

  return state;
};

export const parseSaveFile = async (file: File): Promise<ParsedSavePayload> => {
  const isZip =
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';

  const parsed = isZip ? await readZipJson(file) : await readJson(file);
  const stateToLoad = normalizeLegacyState(parsed.data ? parsed.data : parsed) as GameState;

  const missingFields: string[] = [];
  if (!stateToLoad.角色) missingFields.push('角色 (Character)');
  if (!stateToLoad.地图) missingFields.push('地图 (Map)');

  if (missingFields.length > 0) {
    throw new Error(`存档缺少必要字段:\n${missingFields.join(', ')}`);
  }

  return {
    payload: parsed,
    stateToLoad,
    summary: parsed.summary || stateToLoad.角色?.姓名 || '未知存档',
    timeStr: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : '未知时间'
  };
};
