
export interface StoryTrigger {
  预计触发: string; // "第N日 HH:MM"
  内容: string;
  类型?: '主线' | '支线' | '世界' | '危机' | '人物' | string;
  触发条件?: string;
  重要度?: '低' | '中' | '高' | '关键' | string;
  状态?: '待触发' | '已触发' | '已取消' | string;
}

export interface StoryMilestone {
  时间: string;
  事件: string;
  影响?: string;
}

export interface StoryState {
  主线: {
    当前卷数: number;
    当前篇章: string;
    当前阶段: string;
    关键节点: string;
    节点状态: string;
  };
  引导: {
    当前目标: string;
    下一触发: string;
    行动提示: string;
  };
  时间轴: {
    预定日期: string;
    下一关键时间?: string;
  };
  路线: {
    是否正史: boolean;
    偏移度: number;
    分歧说明?: string;
  };
  待触发: StoryTrigger[]; // 最多 3 条
  里程碑?: StoryMilestone[];
  备注?: string;
}

export interface Contract {
  id: string;
  名称: string;
  描述: string;
  状态: string;
  条款: string;
}

export interface TaskLog {
    时间戳: string;
    内容: string;
}

export interface Task {
  id: string;
  标题: string;
  描述: string;
  状态: 'active' | 'completed' | 'failed';
  奖励: string;
  评级: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
  
  // Enhanced Tracking
  接取时间?: string; 
  结束时间?: string; // Finish Time
  截止时间?: string; // Deadline
  日志?: TaskLog[];     
}
