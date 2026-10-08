import os
from flask import Flask, request, jsonify
from nodeRanking import ranker

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "service": "NetShare ML Ranking Microservice",
        "status": "online",
        "model": "synthetic RandomForestRegressor" if ranker.model is not None else "analytical fallback",
        "trainingData": "synthetic" if ranker.model is not None else "none",
        "features": ["latency", "bandwidth", "reliability", "successRate"],
    }), 200


@app.route("/predict-score", methods=["POST"])
def predict_score():
    """
    Predict node score.
    Payload:
    {
      "latency": 45,
      "bandwidth": 1500,
      "reliability": 98,
      "successRate": 99
    }
    """
    try:
        data = request.get_json(force=True)
        latency = float(data.get("latency", 50))
        bandwidth = float(data.get("bandwidth", 2048))
        reliability = float(data.get("reliability", 100))
        success_rate = float(data.get("successRate", 100))

        score = ranker.predict_score(latency, bandwidth, reliability, success_rate)

        return jsonify({
            "status": "success",
            "nodeScore": score,
            "inputs": {
                "latency": latency,
                "bandwidth": bandwidth,
                "reliability": reliability,
                "successRate": success_rate,
            },
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/rank-nodes", methods=["POST"])
def rank_nodes():
    """
    Ranks an array of candidate nodes.
    Payload:
    {
      "nodes": [
        { "id": "node_1", "latency": 25, "bandwidth": 3000, "reliability": 98, "successRate": 99 },
        { "id": "node_2", "latency": 150, "bandwidth": 800, "reliability": 85, "successRate": 90 }
      ]
    }
    """
    try:
        data = request.get_json(force=True)
        nodes = data.get("nodes", [])

        ranked = ranker.rank_nodes(nodes)

        return jsonify({
            "status": "success",
            "count": len(ranked),
            "rankedNodes": ranked,
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"[NetShare ML] Starting service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
