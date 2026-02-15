export interface NoteEntry {
  id: string;
  标题: string;
  内容: string;
  标签?: string[];
  时间戳: string;
  更新时间?: string;
  重要?: boolean;
}
