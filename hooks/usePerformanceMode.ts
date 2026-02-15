import { useState, useEffect } from 'react';

export type PerformanceMode = 'full' | 'medium' | 'minimal';
export type MotionLevel = 'full' | 'medium' | 'minimal';
const PERFORMANCE_MODE_KEY = 'dxc-performance-mode';

export const resolveMotionLevel = (input: {
  fps: number;
  userPreference: 'auto' | MotionLevel;
}): MotionLevel => {
  if (input.userPreference !== 'auto') return input.userPreference;
  if (input.fps < 30) return 'minimal';
  if (input.fps < 50) return 'medium';
  return 'full';
};

interface PerformanceDetection {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
  };
}

type ExtendedNavigator = Navigator & {
  deviceMemory?: number;
  connection?: PerformanceDetection['connection'];
  mozConnection?: PerformanceDetection['connection'];
  webkitConnection?: PerformanceDetection['connection'];
};

const isPerformanceMode = (value: unknown): value is PerformanceMode =>
  value === 'full' || value === 'medium' || value === 'minimal';

const safeReadStorage = (): PerformanceMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(PERFORMANCE_MODE_KEY);
    return isPerformanceMode(stored) ? stored : null;
  } catch (error) {
    console.warn('performance mode read skipped', error);
    return null;
  }
};

const safeWriteStorage = (mode: PerformanceMode) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERFORMANCE_MODE_KEY, mode);
  } catch (error) {
    console.warn('performance mode write skipped', error);
  }
};

const safeRemoveStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PERFORMANCE_MODE_KEY);
  } catch (error) {
    console.warn('performance mode remove skipped', error);
  }
};

/**
 * 检测设备性能并返回推荐的性能模式
 */
export const detectPerformanceMode = (): PerformanceMode => {
  if (typeof navigator === 'undefined') return 'medium';

  // 检测设备内存
  const nav = navigator as ExtendedNavigator;
  const deviceMemory = nav.deviceMemory || 4; // 默认4GB
  const hardwareConcurrency = nav.hardwareConcurrency || 4; // 默认4核

  // 检测网络连接
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const effectiveType = connection?.effectiveType || '4g';

  // 性能评分系统
  let performanceScore = 0;

  // 内存评分 (0-40分)
  if (deviceMemory >= 8) performanceScore += 40;
  else if (deviceMemory >= 4) performanceScore += 30;
  else if (deviceMemory >= 2) performanceScore += 20;
  else performanceScore += 10;

  // CPU评分 (0-40分)
  if (hardwareConcurrency >= 8) performanceScore += 40;
  else if (hardwareConcurrency >= 4) performanceScore += 30;
  else if (hardwareConcurrency >= 2) performanceScore += 20;
  else performanceScore += 10;

  // 网络评分 (0-20分)
  if (effectiveType === '4g') performanceScore += 20;
  else if (effectiveType === '3g') performanceScore += 15;
  else if (effectiveType === '2g') performanceScore += 10;
  else performanceScore += 5;

  // 根据总分返回性能模式
  if (performanceScore >= 70) return 'full';
  if (performanceScore >= 40) return 'medium';
  return 'minimal';
};

/**
 * 性能模式 Hook
 * 自动检测设备性能并提供性能模式控制
 */
export const usePerformanceMode = () => {
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>(() => {
    // 优先使用用户设置，否则自动检测
    return safeReadStorage() || detectPerformanceMode();
  });

  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(() => {
    return safeReadStorage() === null;
  });

  // 更新性能模式
  const updatePerformanceMode = (mode: PerformanceMode, persist = true) => {
    setPerformanceMode(mode);
    setIsAutoDetected(!persist);

    if (persist) {
      safeWriteStorage(mode);
    }
  };

  // 重置为自动检测
  const resetToAutoDetect = () => {
    safeRemoveStorage();
    const detectedMode = detectPerformanceMode();
    setPerformanceMode(detectedMode);
    setIsAutoDetected(true);
  };

  // 监听窗口大小变化（移动端/桌面端切换）
  useEffect(() => {
    if (!isAutoDetected || typeof window === 'undefined') return;

    const handleResize = () => {
      // 仅在自动检测模式下响应
      const newMode = detectPerformanceMode();
      if (newMode !== performanceMode) {
        setPerformanceMode(newMode);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoDetected, performanceMode]);

  // 性能模式配置
  const motionLevel = resolveMotionLevel({
    fps: performanceMode === 'full' ? 60 : performanceMode === 'medium' ? 40 : 24,
    userPreference: 'auto'
  });
  const config = {
    // 动画
    enableAnimations: motionLevel !== 'minimal',
    enableComplexAnimations: motionLevel === 'full',

    // 粒子效果
    enableParticles: motionLevel === 'full',
    maxParticles: motionLevel === 'full' ? 20 : motionLevel === 'medium' ? 10 : 0,

    // 光晕效果
    enableGlow: motionLevel !== 'minimal',
    glowIntensity: motionLevel === 'full' ? 1 : 0.6,

    // 纹理
    enableTextures: motionLevel !== 'minimal',
    textureQuality: motionLevel === 'full' ? 'high' : 'low',

    // 模糊效果
    enableBlur: motionLevel !== 'minimal',
    blurStrength: motionLevel === 'full' ? 'strong' : 'weak',

    // 阴影
    enableShadows: motionLevel !== 'minimal',

    // 帧率
    targetFPS: motionLevel === 'full' ? 60 : motionLevel === 'medium' ? 30 : 20,
  };

  return {
    performanceMode,
    motionLevel,
    isAutoDetected,
    updatePerformanceMode,
    resetToAutoDetect,
    config,
  };
};
