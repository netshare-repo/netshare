/**
 * Task Receiver & Validator for NetShare Edge Agent
 */
export class TaskReceiver {
  constructor(nodeConfig = {}) {
    this.nodeConfig = nodeConfig;
  }

  setNodeConfig(config) {
    this.nodeConfig = { ...this.nodeConfig, ...config };
  }

  /**
   * Validates incoming task message authorization, structure, and permission
   */
  validateTask(taskPayload) {
    if (!taskPayload) {
      return { valid: false, error: "Empty task payload received" };
    }

    const {
      taskId,
      target,
      authorizedHost,
      authorizedPort,
      authorizedMethod = 'GET',
    } = taskPayload;

    if (!taskId) {
      return { valid: false, error: "Missing required taskId" };
    }

    if (!target) {
      return { valid: false, error: "Missing required task target URL" };
    }

    // Validate URL syntax
    try {
      const parsed = new URL(target);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { valid: false, error: `Unauthorized URL protocol: ${parsed.protocol}` };
      }
      const effectivePort = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === 'https:' ? 443 : 80;
      if (!authorizedHost || parsed.hostname.toLowerCase() !== authorizedHost.toLowerCase()) {
        return { valid: false, error: 'Missing or mismatched authorized host' };
      }
      if (!authorizedPort || effectivePort !== Number(authorizedPort)) {
        return { valid: false, error: 'Missing or mismatched authorized port' };
      }
      if (!['GET', 'HEAD'].includes(authorizedMethod.toUpperCase())) {
        return { valid: false, error: `Unauthorized HTTP method: ${authorizedMethod}` };
      }
    } catch (e) {
      return { valid: false, error: `Malformed target URL: ${target}` };
    }

    // Node permission & bandwidth check
    if (this.nodeConfig.status === "paused" || this.nodeConfig.status === "inactive") {
      return {
        valid: false,
        error: `Node is currently in ${this.nodeConfig.status} state and cannot accept tasks`,
      };
    }

    return { valid: true, error: null };
  }
}

export default new TaskReceiver();
