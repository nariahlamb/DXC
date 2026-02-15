/**
 * 性能检测工具
 * 提供设备性能检测和FPS监控功能
 */

export interface PerformanceMetrics {
  fps: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  deviceInfo: {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    platform: string;
    userAgent: string;
  };
}

/**
 * FPS监控器
 */
export class FPSMonitor {
  private frames: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 60;
  private rafId: number | null = null;

  start(callback?: (fps: number) => void) {
    const measure = () => {
      this.frames++;
      const currentTime = performance.now();

      if (currentTime >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
        this.frames = 0;
        this.lastTime = currentTime;

        if (callback) {
          callback(this.fps);
        }
      }

      this.rafId = requestAnimationFrame(measure);
    };

    this.rafId = requestAnimationFrame(measure);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getCurrentFPS(): number {
    return this.fps;
  }
}

/**
 * 获取当前性能指标
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
  const nav = navigator as any;
  const perf = performance as any;

  const metrics: PerformanceMetrics = {
    fps: 60, // 默认值，需要通过FPSMonitor实时更新
    deviceInfo: {
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    },
  };

  // 内存信息（仅Chromium支持）
  if (perf.memory) {
    metrics.memory = {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    };
  }

  return metrics;
};

/**
 * 检测是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * 检测是否为低端设备
 */
export const isLowEndDevice = (): boolean => {
  const nav = navigator as any;
  const deviceMemory = nav.deviceMemory || 4;
  const hardwareConcurrency = nav.hardwareConcurrency || 4;

  // 内存 < 4GB 或 CPU < 4核 视为低端设备
  return deviceMemory < 4 || hardwareConcurrency < 4;
};

/**
 * 网络状况检测
 */
export const getNetworkInfo = () => {
  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!connection) {
    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
    };
  }

  return {
    effectiveType: connection.effectiveType || 'unknown',
    downlink: connection.downlink || 0,
    rtt: connection.rtt || 0,
    saveData: connection.saveData || false,
  };
};

/**
 * 图片懒加载工具
 */
export const createImageLoader = () => {
  if (typeof window === 'undefined') return null;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: '50px',
    }
  );

  return observer;
};
