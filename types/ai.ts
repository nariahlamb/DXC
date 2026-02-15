
export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'custom';
export type TriadAIServiceKey = 'story' | 'state' | 'map';
export type CoreAIServiceKey = 'story' | 'memory' | 'state' | 'map';

export interface AIEndpointConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  forceJsonOutput?: boolean;
}

export interface GlobalAISettings {
  /** 全局请求超时（毫秒），未设置时按服务默认值 */
  requestTimeoutMs?: number;
  /** 按服务覆盖请求超时（毫秒） */
  serviceRequestTimeoutMs?: {
    story?: number;
    memory?: number;
    map?: number;
    state?: number;
  };
  services: {
    story: AIEndpointConfig;
    memory?: AIEndpointConfig;
    map: AIEndpointConfig;
    state: AIEndpointConfig;
  };
  multiStageThinking?: boolean;
  nativeThinkingChain?: boolean;
}

export interface LogEntry {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  turnIndex?: number; // 楼层号/回合数
  rawResponse?: string; // 原始 JSON 响应，用于编辑
  thinking?: string; // AI思考内容（<thinking>解析结果）
  snapshot?: string; // 状态快照 (JSON string of GameState BEFORE this log), 用于回滚
  isRaw?: boolean; // 标记是否为原始流式数据
  responseId?: string; // AI响应分组ID
  repairNote?: string; // 本地修复提示
  gameTime?: string; // NEW: 游戏内完整时间 "YYYY-MM-DD HH:MM"
  tags?: string[]; // 自定义标签
  type?: string; // Log type: 'system', 'player', 'npc', etc.
}

export interface MemoryEntry {
    content: string;
    timestamp: string;
    turnIndex?: number; // Optional turn index for Short Term memory
}

export interface MemorySystem {
    // 游标：指向最后一条已纳入上下文窗口的日志索引。
    // 记忆事实写入/读取统一走 TavernDB 表格系统。
    lastLogIndex: number;
}

export type PromptUsage = 'CORE' | 'START';

export interface PromptModule {
  id: string;
  name: string;
  group: string; // Group Name for UI grouping
  usage: PromptUsage; // Functional Role
  isActive: boolean;
  content: string;
  order: number; // Sorting order
}

export interface MemoryConfig {
    instantLimit: number; // Instant messages count before summary
    /** 记忆填表是否按 LOG_Summary/LOG_Outline 分表并行调用 */
    memoryParallelBySheet?: boolean;
    /** 记忆填表批大小（按回合聚合后再分批） */
    memoryFillBatchSize?: number;
    /** 记忆填表聚合延迟（毫秒） */
    memoryFillFlushDelayMs?: number;
    /** 记忆填表请求超时（毫秒） */
    memoryRequestTimeoutMs?: number;
}

export interface WritingConfig {
    /** 是否启用字数要求 */
    enableWordCountRequirement: boolean;
    /** 要求的正文字数，默认800 */
    requiredWordCount: number;
    /** 额外写作要求（附加到 [玩家输入] 段落） */
    extraRequirementPrompt?: string;
    /** 是否启用写作人称管理 */
    enableNarrativePerspective: boolean;
    /** 人称模式：'third' 第三人称，'first' 第一人称，'second' 第二人称 */
    narrativePerspective: 'third' | 'first' | 'second';
}

// --- New Context Management Types (V2) ---

export type ContextModuleType = 
    'SYSTEM_PROMPTS' | 
    'PLAYER_DATA' | // Renamed from PLAYER_STATUS
    'MAP_CONTEXT' |
    'SOCIAL_CONTEXT' | // Nearby NPCs
    'MEMORY_CONTEXT' | 
    'COMMAND_HISTORY' | 
    'USER_INPUT' |
    'PHONE_CONTEXT' |
    'INVENTORY_CONTEXT' | // Merged Loot/Inventory
    'WORLD_CONTEXT' |
    'FAMILIA_CONTEXT' |
    'TASK_CONTEXT' | 
    'STORY_CONTEXT' | 
    'CONTRACT_CONTEXT' |
    'COMBAT_CONTEXT'; 

export interface ContextModuleConfig {
    id: string;
    type: ContextModuleType;
    name: string;
    enabled: boolean;
    order: number;
    // Dynamic params for customization
    params: {
        detailLevel?: 'low' | 'medium' | 'high' | 'raw';
        limit?: number; // e.g., last 10 messages
        includeAttributes?: string[]; // e.g. ['stats', 'appearance']
        [key: string]: any;
    };
}

export interface ContextConfig {
    modules: ContextModuleConfig[];
}

export interface ReadabilitySettings {
  lineHeight: 'compact' | 'normal' | 'relaxed';
  contrastMode: 'default' | 'high';
  infoDensity: 'compact' | 'balanced' | 'comfortable';
}

export interface StateVarWriterSettings {
  enabled: boolean;
  shadowMode: boolean;
  cutoverDomains: string[];
  rejectNonWriterForCutoverDomains: boolean;
  governance?: StateVariableGovernanceSettings;
}

export type StateVarDomainSheetFieldAllowlist = Record<string, Record<string, string[]>>;
export type StateVarInvalidConfigFallbackStrategy = 'use_default_allowlist' | 'merge_with_default_allowlist';
export type StateVarSoftWarningEscalationAction = 'warn' | 'block';

export interface StateVariableGovernanceTurnScopeSettings {
  crossTurnSoftWarning: {
    enabled: boolean;
    threshold: number;
    sampling: number;
    nonBlocking: boolean;
    escalation: {
      enabled: boolean;
      threshold: number;
      action: StateVarSoftWarningEscalationAction;
    };
  };
}

export interface StateVariableGovernanceDomainScopeSettings {
  strictAllowlist: boolean;
  allowlist: StateVarDomainSheetFieldAllowlist;
  invalidConfigFallbackStrategy: StateVarInvalidConfigFallbackStrategy;
}

export interface StateVariableGovernanceSemanticScopeSettings {
  anchors: string[];
  missingAnchorPolicy: 'warn' | 'ignore';
  ambiguousAnchorPolicy: 'warn' | 'ignore';
}

export interface StateVariableGovernanceSettings {
  turnScope: StateVariableGovernanceTurnScopeSettings;
  domainScope: StateVariableGovernanceDomainScopeSettings;
  semanticScope: StateVariableGovernanceSemanticScopeSettings;
}

export type StateVariableEventOp = 'set' | 'add' | 'push' | 'delete' | 'upsert';

export interface StateVariableEvent {
  event_id: string;
  turn_id: string;
  source: string;
  domain: string;
  entity_id: string;
  path: string;
  op: StateVariableEventOp;
  value?: unknown;
  expected_version?: number;
  idempotency_key: string;
  created_at: number;
}

export interface StateVariableEventBatchEnvelope {
  batch_id: string;
  turn_id: string;
  source: string;
  created_at: number;
  events: StateVariableEvent[];
}

export interface AppSettings {
  backgroundImage: string;
  fontSize: 'small' | 'medium' | 'large';
  readability: ReadabilitySettings;
  enableActionOptions: boolean; // NEW: Toggle for Action Suggestions
  enableStreaming: boolean; // NEW: Toggle for AI Streaming
  enableCombatUI: boolean; // Toggle for combat panel UI
  chatLogLimit?: number | null; // UI render limit, null for unlimited
  apiProtectionEnabled?: boolean;
  promptModules: PromptModule[];
  aiConfig: GlobalAISettings;
  memoryConfig: MemoryConfig;
  contextConfig: ContextConfig;
  stateVarWriter: StateVarWriterSettings;
  writingConfig: WritingConfig;
  系统设置?: {
    世界更新间隔回合: number;
    通知设置: {
      新闻推送: boolean;
      传闻更新: boolean;
      私信通知: boolean;
      论坛动态: boolean;
    };
    订阅源: string[];
    更新频率?: 'realtime' | 'fast' | 'normal' | 'manual';
  };
}

// --- Tavern Command Protocol ---
export interface TavernCommand {
    action:
      // Legacy path actions (deprecated, runtime-rejected for business writes)
      | 'set'
      | 'add'
      | 'push'
      | 'delete'
      // Table-first generic actions
      | 'upsert_sheet_rows'
      | 'delete_sheet_rows'
      // Explicit economy actions
      | 'append_econ_ledger'
      | 'apply_econ_delta'
      // Domain actions
      | 'set_encounter_rows'
      | 'upsert_battle_map_rows'
      | 'set_map_visuals'
      | 'set_initiative'
      | 'consume_dice_rows'
      | 'refill_dice_pool'
      | 'roll_dice_check'
      | 'set_action_economy'
      | 'spend_action_resource'
      | 'resolve_attack_check'
      | 'resolve_saving_throw'
      | 'resolve_damage_roll'
      | 'append_combat_resolution'
      | 'append_log_summary'
      | 'append_log_outline'
      | 'set_action_options'
      | 'upsert_npc'
      | 'upsert_inventory'
      | 'upsert_exploration_map';
    key?: string;
    path?: string;
    value?: any;
    type?: string;
    command?: string;
    mode?: string;
    transactionId?: string;
    txId?: string;
    turnId?: string;
    turn?: string | number;
    回合?: string | number;
    expectedSheetVersion?: number;
    expectedRowVersion?: number;
    expectedSheetVersions?: Record<string, number>;
    changedFields?: string[];
    lockOwner?: string;
    source?: string;
}

// ActionOption can be a simple string (legacy) or a structured Tavern action option
export type ActionOption =
  | string
  | {
      id?: string;
      名称: string;
      描述?: string;
      类型?: string;
      消耗?: {
        体力?: number;
        精神?: number;
        法利?: number;
        物品?: string;
      };
      效果?: string;
      条件?: string;
      优先级?: number;
    };

export interface AIResponse {
  logs: { sender: string; text: string }[]; // Logs carries ALL narrative and dialogue
  tavern_commands: TavernCommand[];
  action_options?: ActionOption[];
  rawResponse?: string;
  thinking?: string; // AI思考内容（<thinking>解析结果）
  thinking_pre?: string; // 第一段思考
  thinking_post?: string; // 第二段思考
  thinking_plan?: string; // 剧情预先思考（多重思考）
  thinking_style?: string; // 文风思考
  thinking_draft?: string; // 剧情草稿（多重思考）
  thinking_check?: string; // 剧情合理性校验
  thinking_canon?: string; // 原著思考
  thinking_vars_pre?: string; // 变量预思考
  thinking_vars_other?: string; // 其他功能变量更新思考
  thinking_vars_merge?: string; // 变量融入剧情矫正
  thinking_gap?: string; // 查缺补漏思考
  thinking_vars_post?: string; // 变量矫正思考
  thinking_story?: string; // 完整剧情（多重思考）
  narrative?: string; // Optional for legacy support
  repairNote?: string; // 本地修复提示
  phone_sync_plan?: any; // 手机剧情同步指令（JSON 字段）
}

export interface PhoneAIResponse {
  allowed: boolean;
  blocked_reason?: string;
  messages?: any[];
  phone_updates?: any;
  tavern_commands?: TavernCommand[];
  time_advance_minutes?: number;
  thread_summaries?: { threadId: string; summary: string }[];
  rawResponse?: string;
  thinking?: string;
  repairNote?: string;
}
