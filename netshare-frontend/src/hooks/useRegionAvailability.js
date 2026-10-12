import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "../api/axiosInstance";

const CLIENT_REGIONS = "Pakistan,UAE,USA,UK,India";
const REFRESH_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = 30_000;

export function useRegionAvailability() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stale, setStale] = useState(false);
  const requestId = useRef(0);
  const activeController = useRef(null);
  const lastUpdatedRef = useRef(null);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;

    const currentRequestId = ++requestId.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setRefreshing(true);
    setError("");

    try {
      const response = await axiosInstance.get("/node/availability", {
        params: { regions: CLIENT_REGIONS },
        signal: controller.signal,
        timeout: 8_000,
      });
      if (currentRequestId !== requestId.current) return;

      const generatedAt = Date.parse(response.data?.generatedAt);
      if (!Array.isArray(response.data?.regions) || !Number.isFinite(generatedAt)) {
        throw new Error("Malformed availability response");
      }
      setRegions(response.data.regions);
      lastUpdatedRef.current = generatedAt;
      setLastUpdated(generatedAt);
      setStale(Date.now() - generatedAt > STALE_AFTER_MS);
    } catch (requestError) {
      if (requestError.code !== "ERR_CANCELED" && currentRequestId === requestId.current) {
        setError("Could not refresh regional availability. Try again shortly.");
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const pollTimer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const freshnessTimer = window.setInterval(() => {
      const updatedAt = lastUpdatedRef.current;
      setStale(updatedAt !== null && Date.now() - updatedAt > STALE_AFTER_MS);
    }, REFRESH_INTERVAL_MS);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(pollTimer);
      window.clearInterval(freshnessTimer);
      document.removeEventListener("visibilitychange", visibilityHandler);
      requestId.current += 1;
      activeController.current?.abort();
    };
  }, [refresh]);

  return {
    regions,
    loading,
    refreshing,
    error,
    lastUpdated,
    stale,
    refresh,
  };
}
