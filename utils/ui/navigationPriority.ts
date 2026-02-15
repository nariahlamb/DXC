export type NavigationKey = 'PHONE' | 'TASKS' | 'MAP' | 'INVENTORY' | 'SETTINGS';

export const getNavigationPriority = (input: {
  unreadPhoneCount: number;
  activeTaskCount: number;
  hasUrgentNews: boolean;
}) => {
  // MVP: 固定顺序，后续可按 input 动态调整权重。
  return ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS'] as const;
};
