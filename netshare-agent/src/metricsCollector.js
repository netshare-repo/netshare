import os from "os";

/**
 * System Metrics and Telemetry Collector for NetShare Edge Node
 */
export class MetricsCollector {
  constructor() {
    this.previousCpu = this.getCpuTimes();
  }

  getCpuTimes() {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
  }

  getCpuUsagePercent() {
    const current = this.getCpuTimes();
    const prev = this.previousCpu;
    this.previousCpu = current;

    const totalDiff = current.total - prev.total;
    const idleDiff = current.idle - prev.idle;

    if (totalDiff <= 0) return 1.5;
    const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
    return parseFloat(Math.max(0, Math.min(100, usage)).toFixed(1));
  }

  getMemoryUsagePercent() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return parseFloat(((used / total) * 100).toFixed(1));
  }

  getSystemStatus() {
    return {
      cpuUsage: this.getCpuUsagePercent(),
      memoryUsage: this.getMemoryUsagePercent(),
      freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
      totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      platform: os.platform(),
      uptimeSeconds: os.uptime(),
    };
  }
}

export default new MetricsCollector();
