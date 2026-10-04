# NetShare Edge Node Agent Daemon (`netshare-agent`)

The execution plane worker for the NetShare Decentralized Internet Bandwidth Sharing Platform.

## Features
- **Real-Time WebSocket Link**: Continuous two-way connection to the NetShare backend via Socket.IO.
- **Automated Heartbeat**: Dispatches health, CPU, memory, and latency metrics every 10 seconds.
- **Edge Task Execution**: Executes real HTTP Performance Tests (TTFB, connection times, download sizes) and Ping Tests (latency, jitter, packet loss).
- **Telemetry Streaming**: Live bandwidth and resource telemetry reported to the control plane.
- **Dynamic Reward Settlement**: Real-time confirmation of credits earned per task execution.

## Usage

### 1. Installation
```bash
npm install
```

### 2. Running with Node API Key
```bash
node agent.js --key nsk_live_YOUR_NODE_API_KEY --url http://localhost:8000
```

### 3. Running with JWT Token
```bash
node agent.js --token YOUR_JWT_TOKEN --url http://localhost:8000
```

### 4. Running via Environment Variables
Copy `.env.example` to `.env`, set `NODE_API_KEY`, and run:
```bash
npm start
```
