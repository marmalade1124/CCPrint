import { useEffect, useRef, useState, useCallback } from 'react';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useJobStore } from '../stores/useJobStore';
import { useToastStore } from '../stores/useToastStore';
import { getWsUrl } from '../utils/api';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const attemptRef = useRef(0);

  const getReconnectDelay = (attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  };

  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS Connection to PrintCC backend established');
      setIsConnected(true);
      attemptRef.current = 0;
      setReconnectAttempt(0);
      useToastStore.getState().addToast('Connected to local printer bridge.', 'success');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const printerStore = usePrinterStore.getState();

        if (payload.type === 'status') {
          printerStore.setConnectionStatus(payload.serial, payload.status);
          const printerName = printerStore.printers.find((p) => p.serial === payload.serial)?.name || payload.serial;
          const toast = useToastStore.getState();
          if (payload.status === 'online') {
            toast.addToast(`Printer "${printerName}" is now online!`, 'success');
          } else if (payload.status === 'offline') {
            if (payload.error) {
              toast.addToast(`Printer "${printerName}" connection error: ${payload.error}`, 'error');
            } else {
              toast.addToast(`Printer "${printerName}" went offline.`, 'warning');
            }
          } else if (payload.status === 'connecting') {
            toast.addToast(`Printer "${printerName}" is connecting...`, 'info');
          }
        } else if (payload.type === 'telemetry') {
          printerStore.setTelemetryForSerial(payload.serial, payload.data);
        } else if (payload.type === 'bulk_status') {
          const statuses: Record<string, 'offline' | 'connecting' | 'online'> = {};
          const telemetries: Record<string, any> = {};
          payload.printers.forEach((p: any) => {
            statuses[p.serial] = p.status;
            if (p.lastTelemetry) {
              telemetries[p.serial] = p.lastTelemetry;
            }
          });
          printerStore.setBulkStatus(statuses, telemetries);
        } else if (payload.type === 'slicer_upload') {
          console.log('Received G-code upload from slicer:', payload.metadata);
          useJobStore.getState().setIncomingSlicerJob(payload.metadata);
          useToastStore.getState().addToast(`New print file received from slicer: ${payload.metadata.filename}`, 'success');
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS Connection closed.');
      setIsConnected(false);
      usePrinterStore.getState().resetAllConnections();

      const delay = getReconnectDelay(attemptRef.current);
      console.log(`Attempting reconnect in ${delay / 1000}s... (attempt ${attemptRef.current + 1})`);
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptRef.current += 1;
        setReconnectAttempt(attemptRef.current);
        connect();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { isConnected, reconnectAttempt };
}
