"""
NetShare Machine Learning Service: Node Suitability Ranking Model
Uses Random Forest Regression (with graceful fallback to analytical regression)
to predict node suitability scores based on operational telemetry:
Latency, Bandwidth Availability, Reliability Score, and Success Rate.
"""

import os
import sys

# Optional import with graceful fallback if dependencies are not yet installed
try:
    import joblib
    import numpy as np
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_squared_error, r2_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

MODEL_FILE = os.path.join(os.path.dirname(__file__), "node_ranker.joblib")


class NodeRankingModel:
    def __init__(self):
        self.model = None
        self.use_sklearn = SKLEARN_AVAILABLE
        if self.use_sklearn:
            self._load_or_train()
        else:
            print("[NetShare ML] Notice: scikit-learn/joblib not installed. Using analytical regression model.")

    def _generate_synthetic_data(self, samples=2000):
        np.random.seed(42)
        latency = np.random.uniform(10, 600, samples)
        bandwidth = np.random.uniform(50, 5000, samples)
        reliability = np.random.uniform(50, 100, samples)
        success_rate = np.random.uniform(60, 100, samples)

        latency_score = np.clip(1.0 - (latency / 500.0), 0.0, 1.0)
        bandwidth_score = np.clip(bandwidth / 2048.0, 0.0, 1.0)
        reliability_score = np.clip(reliability / 100.0, 0.0, 1.0)
        success_score = np.clip(success_rate / 100.0, 0.0, 1.0)

        noise = np.random.normal(0, 0.02, samples)
        target_score = np.clip(
            (0.40 * reliability_score)
            + (0.25 * latency_score)
            + (0.20 * bandwidth_score)
            + (0.15 * success_score)
            + noise,
            0.0,
            1.0,
        )

        X = np.column_stack([latency, bandwidth, reliability, success_rate])
        y = target_score
        return X, y

    def train(self, samples=2500):
        if not self.use_sklearn:
            return {"status": "analytical_fallback"}

        X, y = self._generate_synthetic_data(samples)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=12,
            min_samples_split=4,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_train, y_train)

        preds = self.model.predict(X_test)
        mse = mean_squared_error(y_test, preds)
        r2 = r2_score(y_test, preds)

        print(f"[NetShare ML] Node Ranking Model Trained Successfully.")
        print(f"[NetShare ML] Test R^2 Score: {r2:.4f} | MSE: {mse:.6f}")

        joblib.dump(self.model, MODEL_FILE)
        return {"r2": r2, "mse": mse}

    def _load_or_train(self):
        if os.path.exists(MODEL_FILE):
            try:
                self.model = joblib.load(MODEL_FILE)
                return
            except Exception as e:
                print(f"[NetShare ML] Model load error: {e}. Re-training...")

        self.train()

    def predict_score(self, latency, bandwidth, reliability, success_rate):
        """
        Predicts suitability score for an individual node device.
        Returns float in range [0.0, 1.0].
        """
        lat = float(latency)
        bw = float(bandwidth)
        rel = float(reliability)
        succ = float(success_rate)

        if self.use_sklearn and self.model is not None:
            features = np.array([[lat, bw, rel, succ]])
            score = self.model.predict(features)[0]
            return round(float(np.clip(score, 0.0, 1.0)), 4)

        # Analytical regression fallback
        lat_score = max(0.0, min(1.0, 1.0 - (lat / 500.0)))
        bw_score = max(0.0, min(1.0, bw / 2048.0))
        rel_score = max(0.0, min(1.0, rel / 100.0))
        succ_score = max(0.0, min(1.0, succ / 100.0))

        composite = (0.40 * rel_score) + (0.25 * lat_score) + (0.20 * bw_score) + (0.15 * succ_score)
        return round(max(0.0, min(1.0, composite)), 4)

    def rank_nodes(self, nodes_data):
        ranked = []
        for node in nodes_data:
            lat = node.get("latency", node.get("latencyMs", 50))
            bw = node.get("bandwidth", node.get("bandwidthLimitMB", 2048) - node.get("usedBandwidthMB", 0))
            rel = node.get("reliability", node.get("reliabilityScore", 100))
            succ = node.get("successRate", 100)

            score = self.predict_score(lat, bw, rel, succ)
            ranked.append({
                **node,
                "nodeScore": score,
            })

        ranked.sort(key=lambda x: x["nodeScore"], reverse=True)
        return ranked


# Global singleton model instance
ranker = NodeRankingModel()


def rank_node(latency, bandwidth, reliability, success_rate):
    """Module-level helper to predict score directly."""
    return ranker.predict_score(latency, bandwidth, reliability, success_rate)


if __name__ == "__main__":
    print("[NetShare ML] Node Ranking Model Initialized.")

    test_cases = [
        {"desc": "High Speed Fiber Node", "lat": 15, "bw": 4000, "rel": 99, "succ": 99},
        {"desc": "Average Residential Node", "lat": 65, "bw": 1500, "rel": 92, "succ": 95},
        {"desc": "Congested / High Latency Node", "lat": 350, "bw": 200, "rel": 70, "succ": 80},
    ]

    print("\n--- Sample Node Predictions ---")
    for tc in test_cases:
        s = ranker.predict_score(tc["lat"], tc["bw"], tc["rel"], tc["succ"])
        print(f"[{tc['desc']}] -> Suitability Score: {s}")
