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
  stateToLoad: any;
  summary: string;
  timeStr: string;
}

const parseSaveText = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('文件格式错误 (Invalid JSON)');
  }
};

export const buildSaveExportPayload = (gameState: GameState): SaveExportPayload => ({
  id: 'export',
  type: 'EXPORT',
  timestamp: Date.now(),
  summary: `导出: ${gameState.角色?.姓名 || '玩家'} - Lv.${gameState.角色?.等级 || '1'}`,
  data: gameState,
  version: '3.1'
});

export const downloadSaveAsZip = async (payload: SaveExportPayload, fileBaseName: string) => {
  const zip = new JSZip();
  zip.file('save.json', JSON.stringify(payload, null, 2));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
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
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const jsonEntry = Object.values(zip.files).find(entry => !entry.dir && entry.name.toLowerCase().endsWith('.json'));
  if (!jsonEntry) {
    throw new Error('ZIP 内未找到 JSON 存档文件');
  }
  const jsonText = await jsonEntry.async('string');
  return parseSaveText(jsonText);
};

const readJson = async (file: File): Promise<any> => {
  const text = await file.text();
  return parseSaveText(text);
};

export const parseSaveFile = async (file: File): Promise<ParsedSavePayload> => {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  const parsed = isZip ? await readZipJson(file) : await readJson(file);
  const stateToLoad = parsed.data ? parsed.data : parsed;

  if (stateToLoad.character && !stateToLoad.角色) stateToLoad.角色 = stateToLoad.character;
  if (stateToLoad.inventory && !stateToLoad.背包) stateToLoad.背包 = stateToLoad.inventory;
  if (stateToLoad.logs && !stateToLoad.日志) stateToLoad.日志 = stateToLoad.logs;

  const missingFields: string[] = [];
  if (!stateToLoad.角色) missingFields.push('角色 (Character)');
  if (!stateToLoad.地图) missingFields.push('地图 (Map)');
  if (missingFields.length > 0) {
    throw new Error(`存档数据不完整，缺少核心字段:\n${missingFields.join(', ')}`);
  }

  return {
    payload: parsed,
    stateToLoad,
    summary: parsed.summary || stateToLoad.角色?.姓名 || '未知存档',
    timeStr: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : '未知时间'
  };
};
