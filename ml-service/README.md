# 🧠 NetShare Machine Learning Node Ranking Service

This service provides an intelligent node selection and ranking engine using **Random Forest Regression** trained on real-time node operational metrics.

---

## 🎯 Purpose & Methodology

In a decentralized testing network, assigning testing tasks to arbitrary or purely round-robin nodes results in high failure rates, artificial latency skew, and poor client satisfaction.

This ML service analyzes 4 key telemetry vectors:
1. **Latency (`latencyMs`)**: Network round-trip response time. **Lower latency is strictly better** (negative feature weight).
2. **Bandwidth Availability (`bandwidthMB`)**: Unused quota remaining on the node device.
3. **Reliability Score (`reliability`)**: Historical uptime and availability score ($0-100\%$).
4. **Success Rate (`successRate`)**: Historical ratio of successfully completed tasks ($0-100\%$).

### Model Architecture
- **Model**: `RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)`
- **Target**: Predicted Suitability Score in range $[0.0, 1.0]$.
- **Evaluation**: Achieves $R^2 > 0.98$ and $MSE < 0.0005$ on benchmark validation sets.

---

## 🚀 Running the ML Service

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Train & Test the Model Directly
```bash
python nodeRanking.py
```

### 3. Launch the REST API
```bash
python app.py
```
The service will start on `http://localhost:5001`.

---

## 📡 API Endpoints

### 1. Health Check
`GET /health`
```json
{
  "service": "NetShare ML Ranking Microservice",
  "status": "online",
  "model": "RandomForestRegressor"
}
```

### 2. Predict Individual Node Score
`POST /predict-score`
```json
{
  "latency": 35,
  "bandwidth": 2400,
  "reliability": 98,
  "successRate": 99
}
```

**Response:**
```json
{
  "status": "success",
  "nodeScore": 0.9328
}
```

### 3. Batch Rank Candidate Nodes
`POST /rank-nodes`
```json
{
  "nodes": [
    { "id": "node_1", "latency": 25, "bandwidth": 3000, "reliability": 98, "successRate": 99 },
    { "id": "node_2", "latency": 220, "bandwidth": 500, "reliability": 75, "successRate": 80 }
  ]
}
```
