import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import EventEmitter from "events";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisConnection = null;
let taskQueue = null;
let isRedisAvailable = false;

// Resilient in-memory fallback queue when Redis is offline or not installed locally
class InMemoryQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.jobs = [];
    this.isProcessing = false;
    this.handlers = [];
  }

  async add(jobName, data, options = {}) {
    const existing = this.jobs.find(job => String(job.data.taskId) === String(data.taskId));
    if (existing) return existing;
    const job = {
      id: `mem_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: jobName,
      data,
      opts: options,
      timestamp: Date.now(),
      attemptsMade: 0,
      maxAttempts: options.attempts || 3,
    };
    this.jobs.push(job);
    setImmediate(() => this.processNext());
    return job;
  }

  registerHandler(handler) {
    this.handlers.push(handler);
    setImmediate(() => this.processNext());
  }

  async processNext() {
    if (this.isProcessing || this.jobs.length === 0 || this.handlers.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.jobs.shift();

    try {
      for (const handler of this.handlers) {
        await handler(job);
      }
    } catch (err) {
      console.error(`[InMemoryQueue] Error processing job ${job.id}:`, err.message);
      job.attemptsMade++;
      if (job.attemptsMade < job.maxAttempts) {
        console.log(`[InMemoryQueue] Retrying job ${job.id} (attempt ${job.attemptsMade + 1}/${job.maxAttempts})`);
        this.jobs.push(job);
      }
    } finally {
      this.isProcessing = false;
      if (this.jobs.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

const memoryQueue = new InMemoryQueue("task-queue");

/**
 * Initializes Redis connection and BullMQ queue
 */
export const initTaskQueue = async () => {
  try {
    const redisClient = new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) return null; // Don't spam reconnect if Redis isn't installed locally
        return Math.min(times * 1000, 2000);
      },
    });

    redisClient.on("error", (err) => {
      if (!isRedisAvailable) {
        // Suppress repeated connection logs if running on fallback
      }
    });

    await redisClient.connect();
    redisConnection = redisClient;
    isRedisAvailable = true;
    redisClient.on('close', () => { isRedisAvailable = false; });
    redisClient.on('ready', () => { isRedisAvailable = true; });

    taskQueue = new Queue("task-queue", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    console.log(`[TaskQueueService] Connected to Redis BullMQ at ${REDIS_HOST}:${REDIS_PORT}`);
    return { isRedis: true, queue: taskQueue };
  } catch (error) {
    isRedisAvailable = false;
    console.log("[TaskQueueService] Redis not detected on localhost; active in Resilient In-Memory Task Queue mode.");
    return { isRedis: false, queue: memoryQueue };
  }
};

/**
 * Enqueue a task for dynamic allocation and real-time execution
 */
export const enqueueTask = async (taskData) => {
  const payload = {
    taskId: taskData._id || taskData.taskId,
    targetUrl: taskData.targetUrl,
    serviceType: taskData.serviceType,
    targetRegion: taskData.targetRegion,
    executionLimit: taskData.executionLimit,
    estimatedCost: taskData.estimatedCost,
    clientId: taskData.clientId,
    createdAt: new Date().toISOString(),
  };

  if (isRedisAvailable && taskQueue) {
    try {
    const queued = (async () => {
    const existing = await taskQueue.getJob(String(payload.taskId));
    if (existing && ['failed', 'completed'].includes(await existing.getState())) await existing.remove();
    const job = await taskQueue.add("execute-testing-task", payload, {
      jobId: String(payload.taskId),
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
    });
    return { queueType: "redis-bullmq", jobId: job.id };
    })();
    let timer;
    try { return await Promise.race([queued, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Redis queue timeout')), 2000);
    })]); } finally { clearTimeout(timer); }
    } catch {
      // Mongo pending-work reconciliation and the atomic claim prevent replay.
      isRedisAvailable = false;
    }
  }
  {
    const job = await memoryQueue.add("execute-testing-task", payload, {
      attempts: 3,
    });
    return { queueType: "in-memory-queue", jobId: job.id };
  }
};

export const getQueue = () => (isRedisAvailable && taskQueue ? taskQueue : memoryQueue);
export const getRedisConnection = () => redisConnection;
export const getIsRedisAvailable = () => isRedisAvailable;
export const getMemoryQueue = () => memoryQueue;

export default {
  initTaskQueue,
  enqueueTask,
  getQueue,
  getRedisConnection,
  getIsRedisAvailable,
  getMemoryQueue,
};
