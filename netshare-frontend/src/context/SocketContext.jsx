import { useEffect, useState, useRef } from "react";
import { SocketContext } from './socketState';
import { io } from "socket.io-client";
import { useAuth } from "./authState";


const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? window.location.origin : "http://localhost:8000");

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveNodes, setLiveNodes] = useState([]);
  const [liveTelemetry, setLiveTelemetry] = useState({});
  const [systemEvents, setSystemEvents] = useState([]);

  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("netshare_token");

    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        queueMicrotask(() => { setSocket(null); setIsConnected(false); });
      }
      return;
    }

    const socketInstance = io(SOCKET_SERVER_URL, {
      auth: {
        token,
        role: user?.role || "client",
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setSocket(socketInstance);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    // Admin / global snapshots
    socketInstance.on("connected_nodes_snapshot", (nodes) => {
      setLiveNodes(nodes || []);
    });

    socketInstance.on("node_status_change", (data) => {
      setLiveNodes((prev) => {
        const existingIndex = prev.findIndex((n) => n.nodeId === data.nodeId);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...data };
          return updated;
        } else if (data.online) {
          return [...prev, data];
        }
        return prev;
      });

      setSystemEvents((prev) => [
        {
          id: Date.now() + Math.random(),
          type: "node_status",
          message: `Node ${data.nodeId?.substring(0, 8)} status changed to ${data.status}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    });

    socketInstance.on("telemetry_update", (telemetry) => {
      setLiveTelemetry((prev) => ({
        ...prev,
        [telemetry.nodeId]: telemetry,
      }));
    });

    socketInstance.on("task_assigned_event", (event) => {
      setSystemEvents((prev) => [
        {
          id: Date.now() + Math.random(),
          type: "task_assigned",
          message: `Task ${event.task?.taskId?.substring(0, 8)} dispatched to Node ${event.nodeId?.substring(0, 8)}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    });

    socketInstance.on("task_completed_event", (event) => {
      setSystemEvents((prev) => [
        {
          id: Date.now() + Math.random(),
          type: "task_completed",
          message: `Task ${event.taskId?.substring(0, 8)} completed (+${event.reward} credits settled)`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        liveNodes,
        liveTelemetry,
        systemEvents,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
