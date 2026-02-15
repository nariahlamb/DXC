import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../utils/dataMapper';
import { constructPhoneNarrativeBackdrop, constructPhoneWorldBrief } from '../utils/aiContext';

describe('phone narrative backdrop summarization', () => {
  it('compresses forum/news into bounded TopN backdrop lines', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;

    const longNewsContent = '这是一段非常长的新闻正文，用于验证叙事背景注入不会把完整原文全部灌入上下文。'.repeat(4);
    state.世界 = {
      ...(state.世界 || {}),
      头条新闻: Array.from({ length: 6 }).map((_, idx) => ({
        id: `news_${idx + 1}`,
        标题: `新闻标题${idx + 1}`,
        内容: idx === 0 ? longNewsContent : `新闻内容${idx + 1}`,
        时间戳: `第1日 0${idx}:00`,
        来源: 'guild',
        重要度: idx === 0 ? 'urgent' : 'normal'
      })),
      街头传闻: []
    };

    state.手机 = {
      ...(state.手机 || {}),
      公共帖子: {
        板块: [{ id: 'board_news', 名称: '欧拉丽快报' }],
        帖子: Array.from({ length: 6 }).map((_, idx) => ({
          id: `Forum_${idx + 1}`,
          标题: `帖子标题${idx + 1}`,
          内容: `帖子内容${idx + 1}`,
          发布者: `用户${idx + 1}`,
          时间戳: `第1日 0${idx}:10`,
          板块: '欧拉丽快报',
          点赞数: 100 - idx,
          回复: Array.from({ length: idx % 3 }, (_, i) => ({ id: `Reply_${idx}_${i}`, 内容: 'ok' }))
        }))
      }
    };

    const backdrop = constructPhoneNarrativeBackdrop(state);

    expect(backdrop).toContain('[叙事背景音/主贴与主要新闻]');
    expect((backdrop.match(/赞\d+\/回\d+/g) || []).length).toBeLessThanOrEqual(4);
    expect((backdrop.match(/\[(?:urgent|normal|minor)\//g) || []).length).toBeLessThanOrEqual(4);
    expect(backdrop).toContain('…');
    expect(backdrop).not.toContain(longNewsContent);
  });

  it('limits world brief to summarized headline topics', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.世界 = {
      ...(state.世界 || {}),
      头条新闻: Array.from({ length: 6 }).map((_, idx) => ({
        id: `news_${idx + 1}`,
        标题: `头条${idx + 1}`,
        内容: `内容${idx + 1}`,
        时间戳: `第1日 0${idx}:00`,
        来源: 'guild',
        重要度: 'normal'
      })),
      街头传闻: Array.from({ length: 6 }).map((_, idx) => ({
        id: `rumor_${idx + 1}`,
        主题: `传闻${idx + 1}`,
        内容: `传闻内容${idx + 1}`,
        传播度: 30 + idx
      }))
    };

    const brief = constructPhoneWorldBrief(state);
    expect(brief).toContain('[世界情报摘要]');
    expect(brief).not.toContain('头条6');
    expect(brief).not.toContain('传闻6');
  });
});
