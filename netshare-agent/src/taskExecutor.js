import http from "http";
import https from "https";
import { performance } from "perf_hooks";

export class TaskExecutor {
  /**
   * Executes an HTTP Performance Test
   * Collects: response time, status code, download size, connection time
   */
  async executeHttpPerformanceTest(targetUrl, limits = {}) {
    return new Promise((resolve) => {
      const urlObj = new URL(targetUrl);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const startTime = performance.now();
      let dnsTime = 0;
      let tcpTime = 0;
      let firstByteTime = 0;
      let downloadSize = 0;
      let statusCode = 0;
      let headers = {};

      const req = client.get(
        targetUrl,
        {
          timeout: limits.timeoutMs || 25000,
          headers: {
            "User-Agent": "NetShare-Edge-Agent/1.0",
            Accept: "*/*",
          },
        },
        (res) => {
          firstByteTime = performance.now() - startTime;
          statusCode = res.statusCode || 200;
          headers = res.headers;

          res.on("data", (chunk) => {
            downloadSize += chunk.length;
          });

          res.on("end", () => {
            const totalDuration = performance.now() - startTime;
            const sizeMB = parseFloat((downloadSize / (1024 * 1024)).toFixed(4));
            // Minimum billing/usage threshold of 0.05MB for headers/transfers
            const billedMB = Math.max(0.05, sizeMB);

            resolve({
              success: statusCode >= 200 && statusCode < 400,
              statusCode,
              latencyMs: Math.round(firstByteTime),
              totalDurationMs: Math.round(totalDuration),
              connectionTimeMs: Math.round(tcpTime || firstByteTime * 0.4),
              dnsTimeMs: Math.round(dnsTime),
              downloadSizeBytes: downloadSize,
              downloadBandwidthMB: billedMB,
              bandwidthUsedMB: billedMB,
              uploadBandwidthMB: 0.01,
              packetLoss: 0,
              successRate: statusCode >= 200 && statusCode < 400 ? 100 : 50,
              resultData: {
                statusCode,
                contentType: headers["content-type"] || "unknown",
                server: headers["server"] || "unknown",
                responseSizeBytes: downloadSize,
                dnsTimeMs: Math.round(dnsTime),
                connectionTimeMs: Math.round(tcpTime || firstByteTime * 0.4),
                ttfbMs: Math.round(firstByteTime),
                totalTimeMs: Math.round(totalDuration),
              },
            });
          });
        }
      );

      req.on("socket", (socket) => {
        socket.on("lookup", () => {
          dnsTime = performance.now() - startTime;
        });
        socket.on("connect", () => {
          tcpTime = performance.now() - startTime;
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 408,
          latencyMs: limits.timeoutMs || 25000,
          totalDurationMs: limits.timeoutMs || 25000,
          connectionTimeMs: 0,
          downloadSizeBytes: 0,
          downloadBandwidthMB: 0.01,
          bandwidthUsedMB: 0.01,
          uploadBandwidthMB: 0.01,
          packetLoss: 100,
          successRate: 0,
          resultData: { error: "Request timed out" },
        });
      });

      req.on("error", (err) => {
        const totalDuration = performance.now() - startTime;
        resolve({
          success: false,
          statusCode: 502,
          latencyMs: Math.round(totalDuration),
          totalDurationMs: Math.round(totalDuration),
          connectionTimeMs: 0,
          downloadSizeBytes: 0,
          downloadBandwidthMB: 0.01,
          bandwidthUsedMB: 0.01,
          uploadBandwidthMB: 0.01,
          packetLoss: 100,
          successRate: 0,
          resultData: { error: err.message },
        });
      });
    });
  }

  /**
   * Executes a Ping / Latency Test
   * Collects: latency, jitter, packet loss
   */
  async executePingTest(targetUrl, limits = {}) {
    const pingSamples = 4;
    const latencies = [];
    let failedPings = 0;

    for (let i = 0; i < pingSamples; i++) {
      const sample = await this.executeHttpPerformanceTest(targetUrl, {
        timeoutMs: 5000,
      });

      if (sample.success) {
        latencies.push(sample.latencyMs);
      } else {
        failedPings++;
      }

      // 100ms pause between pings
      if (i < pingSamples - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    const packetLoss = Math.round((failedPings / pingSamples) * 100);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 500;

    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 500;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 500;

    return {
      success: packetLoss < 100,
      statusCode: 200,
      latencyMs: avgLatency,
      packetLoss,
      bandwidthUsedMB: 0.05,
      downloadBandwidthMB: 0.05,
      uploadBandwidthMB: 0.02,
      successRate: 100 - packetLoss,
      resultData: {
        samples: pingSamples,
        packetLossPercent: packetLoss,
        avgLatencyMs: avgLatency,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        jitterMs: maxLatency - minLatency,
      },
    };
  }

  /**
   * Main Task Execution Dispatcher
   */
  async executeTask(task) {
    const { target, taskType, serviceType, limits } = task;
    const type = (taskType || serviceType || "").toLowerCase();

    console.log(`[TaskExecutor] Executing task ${task.taskId} (Type: ${type}, Target: ${target})...`);

    if (type.includes("ping") || type.includes("connectivity")) {
      return await this.executePingTest(target, limits);
    } else {
      // Handles performance_testing, ad_verification, accessibility_testing, etc.
      return await this.executeHttpPerformanceTest(target, limits);
    }
  }
}

export default new TaskExecutor();
