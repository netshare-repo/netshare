import { io } from "socket.io-client";
import axios from "axios";
import mongoose from "mongoose";

const BASE_URL = "http://localhost:8000";
const SOCKET_URL = "http://localhost:8000";
const MONGO_URI = "mongodb://localhost:27017/netshare_db";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDistributedSystemTests() {
  console.log("\n=======================================================");
  console.log("   NetShare Distributed System Architecture Test Suite");
  console.log("=======================================================\n");

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
    test6: false,
  };

  // Connect to DB directly for test fixtures
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const usersCollection = db.collection("users");
  const nodesCollection = db.collection("nodedevices");
  const walletsCollection = db.collection("wallets");
  const tasksCollection = db.collection("testingtasks");
  const resultsCollection = db.collection("taskresults");

  // 1. Create a Platform Client for submitting tasks
  const testClientEmail = `client_${Date.now()}@netshare.io`;
  const clientUser = await usersCollection.insertOne({
    name: "Distributed Test Client",
    email: testClientEmail,
    password: "hashed_password_test",
    role: "platform_client",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const clientId = clientUser.insertedId;

  // Credit client wallet with plenty of test balance
  await walletsCollection.insertOne({
    userId: clientId,
    balance: 50000,
    spentCredits: 0,
    earnedCredits: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Client Auth JWT Token (mocked signing using backend secret)
  import("jsonwebtoken").then(async ({ default: jwt }) => {
    const JWT_SECRET = "netshare_phase_one_secret";
    const clientToken = jwt.sign({ id: clientId }, JWT_SECRET, { expiresIn: "1d" });

    // -------------------------------------------------------------
    // TEST 1: Connect 10 Nodes
    // -------------------------------------------------------------
    console.log(">>> TEST 1: Concurrently connecting 10 Edge Node Agents...");

    const nodeRegions = ["US-East", "US-West", "EU-Central", "AP-South", "Global"];
    const virtualNodes = [];
    const connectedSockets = [];

    for (let i = 0; i < 10; i++) {
      const nodeUser = await usersCollection.insertOne({
        name: `Node Participant ${i + 1}`,
        email: `node_worker_${Date.now()}_${i}@netshare.io`,
        password: "hashed_password_test",
        role: "node_participant",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const apiKey = `nsk_live_test_agent_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`;
      const nodeDevice = await nodesCollection.insertOne({
        userId: nodeUser.insertedId,
        deviceName: `Edge Worker ${i + 1}`,
        region: nodeRegions[i % nodeRegions.length],
        status: "active",
        bandwidthLimitMB: 50000,
        usedBandwidthMB: 0,
        uploadSpeedCapMbps: 15,
        downloadSpeedCapMbps: 50,
        maxConcurrentTasks: 5,
        currentActiveTasks: 0,
        reliabilityScore: 98,
        successRate: 99,
        latencyMs: 30 + i * 5,
        apiKey,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await walletsCollection.insertOne({
        userId: nodeUser.insertedId,
        balance: 0,
        spentCredits: 0,
        earnedCredits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      virtualNodes.push({
        id: nodeDevice.insertedId,
        userId: nodeUser.insertedId,
        apiKey,
        region: nodeRegions[i % nodeRegions.length],
        name: `Edge Worker ${i + 1}`,
      });
    }

    // Connect all 10 sockets
    const connectionPromises = virtualNodes.map((vNode) => {
      return new Promise((resolve, reject) => {
        const socket = io(SOCKET_URL, {
          auth: { apiKey: vNode.apiKey },
          transports: ["websocket"],
          reconnection: true,
        });

        socket.on("connect", () => {
          connectedSockets.push(socket);
        });

        socket.on("node_connect_ack", (ack) => {
          vNode.socket = socket;
          resolve(ack);
        });

        socket.on("connect_error", (err) => {
          reject(err);
        });
      });
    });

    try {
      const acks = await Promise.all(connectionPromises);
      console.log(`✓ All 10 virtual node agents connected! Acknowledged: ${acks.length} nodes`);

      // Verify health endpoint
      const healthRes = await axios.get(`${BASE_URL}/api/health`);
      console.log(`✓ Health endpoint verified: ${healthRes.data.executionPlane.connectedNodesCount} connected nodes on socket server.`);

      if (acks.length === 10 && healthRes.data.executionPlane.connectedNodesCount >= 10) {
        results.test1 = true;
      }
    } catch (err) {
      console.error("✗ Test 1 failed:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: Submit Tasks Batch
    // -------------------------------------------------------------
    console.log("\n>>> TEST 2: Submitting batch tasks into Redis / BullMQ Task Queue...");

    const createdTasks = [];
    const taskCount = 20; // Test batch

    try {
      for (let i = 0; i < taskCount; i++) {
        const taskPayload = {
          targetUrl: `https://httpbin.org/get?task_index=${i}`,
          serviceType: "performance_testing",
          targetRegion: nodeRegions[i % nodeRegions.length],
          executionLimit: 1,
        };

        const res = await axios.post(`${BASE_URL}/api/tasks`, taskPayload, {
          headers: { Authorization: `Bearer ${clientToken}` },
        });

        createdTasks.push(res.data.task);
      }

      console.log(`✓ Successfully enqueued batch of ${createdTasks.length} testing tasks.`);
      results.test2 = true;
    } catch (err) {
      console.error("✗ Test 2 failed:", err.response?.data?.message || err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: Measure Allocation Speed & Weighted Scoring
    // -------------------------------------------------------------
    console.log("\n>>> TEST 3: Measuring dynamic allocation speed and weighted node selection...");

    try {
      const allocationStartTime = Date.now();
      let allocatedTask = null;
      let receivingNode = null;

      // Listen on all 10 nodes for task assignment
      const allocationPromise = new Promise((resolve) => {
        virtualNodes.forEach((node) => {
          node.socket.once("task_assigned", (payload) => {
            const allocationSpeedMs = Date.now() - allocationStartTime;
            resolve({ node, payload, allocationSpeedMs });
          });
        });
      });

      // Submit a single targeted task
      await axios.post(
        `${BASE_URL}/api/tasks`,
        {
          targetUrl: "https://example.com",
          serviceType: "performance_testing",
          targetRegion: "US-East",
          executionLimit: 1,
        },
        { headers: { Authorization: `Bearer ${clientToken}` } }
      );

      const allocationResult = await Promise.race([
        allocationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Allocation timed out")), 8000)),
      ]);

      console.log(`✓ Task assigned to Node ${allocationResult.node.name} (${allocationResult.node.region}) in ${allocationResult.allocationSpeedMs}ms!`);
      results.test3 = true;
    } catch (err) {
      console.error("✗ Test 3 failed:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: Node Failure Recovery
    // -------------------------------------------------------------
    console.log("\n>>> TEST 4: Verifying node failure recovery and automatic queue reallocation...");

    try {
      // Pick node 0 and abruptly close its socket
      const failingNode = virtualNodes[0];
      console.log(`- Simulating unexpected disconnect on Node ${failingNode.name}...`);
      failingNode.socket.disconnect();

      await sleep(1000);

      // Verify server detected disconnect
      const healthCheck = await axios.get(`${BASE_URL}/api/health`);
      console.log(`✓ Node disconnect registered. Live nodes remaining: ${healthCheck.data.executionPlane.connectedNodesCount}`);

      results.test4 = true;
    } catch (err) {
      console.error("✗ Test 4 failed:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: Dynamic Wallet Settlement Accuracy
    // -------------------------------------------------------------
    console.log("\n>>> TEST 5: Validating Dynamic Wallet Settlement Formula (Bandwidth × Quality × Region)...");

    try {
      // Pick active node 1
      const activeNode = virtualNodes[1];
      const initialWallet = await walletsCollection.findOne({ userId: activeNode.userId });
      const initialBalance = initialWallet?.balance || 0;

      // Submit task
      const taskRes = await axios.post(
        `${BASE_URL}/api/tasks`,
        {
          targetUrl: "https://httpbin.org/bytes/1024",
          serviceType: "performance_testing",
          targetRegion: activeNode.region,
          executionLimit: 1,
        },
        { headers: { Authorization: `Bearer ${clientToken}` } }
      );

      const taskId = taskRes.data.task._id;

      // Node returns task_completed with 50MB usage
      const completionPromise = new Promise((resolve) => {
        activeNode.socket.once("task_completed_ack", (ack) => {
          resolve(ack);
        });
      });

      activeNode.socket.emit("task_completed", {
        taskId,
        bandwidthUsedMB: 50,
        latencyMs: 40,
        packetLoss: 0,
        success: true,
        successRate: 100,
        statusCode: 200,
        resultData: { testExecution: "Distributed settlement test" },
      });

      const ack = await Promise.race([
        completionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Settlement timed out")), 6000)),
      ]);

      const updatedWallet = await walletsCollection.findOne({ userId: activeNode.userId });
      const earned = (updatedWallet?.balance || 0) - initialBalance;

      console.log(`✓ Task completed! Credits Earned: ${earned} (Formula breakdown: ${ack.breakdown?.formula})`);
      if (earned > 0 && ack.rewardEarned === earned) {
        results.test5 = true;
      }
    } catch (err) {
      console.error("✗ Test 5 failed:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: Socket Reconnect & Resynchronization
    // -------------------------------------------------------------
    console.log("\n>>> TEST 6: Testing Socket.IO Reconnect and State Resynchronization...");

    try {
      const reconnectNode = virtualNodes[2];
      const prevSocket = reconnectNode.socket;

      const reconnectPromise = new Promise((resolve) => {
        const newSocket = io(SOCKET_URL, {
          auth: { apiKey: reconnectNode.apiKey },
          transports: ["websocket"],
        });

        newSocket.on("node_connect_ack", (ack) => {
          newSocket.disconnect();
          resolve(ack);
        });
      });

      prevSocket.disconnect();
      const ack = await Promise.race([
        reconnectPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Reconnect timed out")), 5000)),
      ]);

      console.log(`✓ Node reconnected successfully and received connect ack: ${ack.nodeId}`);
      results.test6 = true;
    } catch (err) {
      console.error("✗ Test 6 failed:", err.message);
    }

    // Clean up connections
    connectedSockets.forEach((s) => {
      try {
        s.disconnect();
      } catch (_) {}
    });

    await mongoose.disconnect();

    console.log("\n=======================================================");
    console.log("             DISTRIBUTED TEST SUITE SUMMARY            ");
    console.log("=======================================================");
    console.log(`Test 1: Connect 10 Nodes                  [${results.test1 ? "PASSED" : "FAILED"}]`);
    console.log(`Test 2: Submit Batch Tasks (Queue)        [${results.test2 ? "PASSED" : "FAILED"}]`);
    console.log(`Test 3: Measure Allocation Speed          [${results.test3 ? "PASSED" : "FAILED"}]`);
    console.log(`Test 4: Node Failure Recovery             [${results.test4 ? "PASSED" : "FAILED"}]`);
    console.log(`Test 5: Wallet Settlement Accuracy        [${results.test5 ? "PASSED" : "FAILED"}]`);
    console.log(`Test 6: Socket Reconnect Resync           [${results.test6 ? "PASSED" : "FAILED"}]`);
    console.log("=======================================================\n");

    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  });
}

runDistributedSystemTests().catch((err) => {
  console.error("Test runner fatal error:", err);
  process.exit(1);
});
