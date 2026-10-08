import { executeSecureResidentialHttpTest } from './secureTaskExecutor.js';

export class TaskExecutor {
  /** Execute one independently validated HTTP/HTTPS probe. */
  async executeHttpPerformanceTest(targetUrl, limits = {}, authorization = {}) {
    return executeSecureResidentialHttpTest(targetUrl, {
      authorizedHost: authorization.authorizedHost,
      authorizedPort: authorization.authorizedPort,
      authorizedMethod: authorization.authorizedMethod || 'GET',
      timeoutMs: limits.timeoutMs || 25000,
      maxRedirects: 3,
    });
  }

  /** Repeated secure HTTP probes used for latency/availability tasks. */
  async executePingTest(targetUrl, limits = {}, authorization = {}) {
    const samples = Math.min(Math.max(Number(limits.executionLimit || 3), 1), 10);
    const results = [];

    for (let i = 0; i < samples; i += 1) {
      results.push(await this.executeHttpPerformanceTest(
        targetUrl,
        { ...limits, timeoutMs: Math.min(limits.timeoutMs || 5000, 5000) },
        authorization
      ));
    }

    const successful = results.filter((result) => result.success);
    const bandwidthUsedMB = results.reduce((sum, result) => sum + Number(result.bandwidthUsedMB || 0), 0);
    const latencyMs = successful.length
      ? Math.round(successful.reduce((sum, result) => sum + result.latencyMs, 0) / successful.length)
      : Math.max(...results.map((result) => result.latencyMs), 0);
    const packetLoss = Math.round(((samples - successful.length) / samples) * 100);

    return {
      success: successful.length > 0,
      statusCode: successful.at(-1)?.statusCode || results.at(-1)?.statusCode || 502,
      latencyMs,
      packetLoss,
      bandwidthUsedMB,
      downloadBandwidthMB: results.reduce((sum, result) => sum + Number(result.downloadBandwidthMB || 0), 0),
      uploadBandwidthMB: results.reduce((sum, result) => sum + Number(result.uploadBandwidthMB || 0), 0),
      successRate: Math.round((successful.length / samples) * 100),
      resultData: { samples, packetLossPercent: packetLoss },
    };
  }

  async executeTask(task) {
    const { target, taskType, serviceType, limits = {} } = task;
    const type = (taskType || serviceType || '').toLowerCase();
    const authorization = {
      authorizedHost: task.authorizedHost,
      authorizedPort: Number(task.authorizedPort),
      authorizedMethod: task.authorizedMethod || 'GET',
    };

    if (!authorization.authorizedHost || !authorization.authorizedPort) {
      throw new Error('Task authorization envelope is missing host or port');
    }

    console.log(`[TaskExecutor] Executing authorized task ${task.taskId} (Type: ${type}, Target: ${target})...`);
    return type.includes('ping') || type.includes('connectivity')
      ? this.executePingTest(target, limits, authorization)
      : this.executeHttpPerformanceTest(target, limits, authorization);
  }
}

export default new TaskExecutor();
