import React from 'react';
import PrinterStatus from '../components/PrinterStatus';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useToastStore } from '../stores/useToastStore';
import { getApiBase } from '../utils/api';

export default function PrintersPage() {
  const {
    printers, activePrinterSerial, telemetryMap, connectionStatusMap,
    setActivePrinter, addPrinter, updatePrinter, deletePrinter,
    setConnectionStatus, clearPrinterTelemetry,
  } = usePrinterStore();
  const { addToast } = useToastStore();
  const apiBase = getApiBase();

  const handleConnectPrinter = async (printer: any) => {
    setConnectionStatus(printer.serial, 'connecting');
    addToast(`Connecting to "${printer.name}"...`, 'info');
    try {
      const response = await fetch(`${apiBase}/api/printer/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printer),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(`Connect failed: ${data.error || 'Unknown error'}`, 'error');
        setConnectionStatus(printer.serial, 'offline');
      }
    } catch {
      setConnectionStatus(printer.serial, 'offline');
      addToast('Network error: cannot communicate with local backend server.', 'error');
    }
  };

  const handleDisconnectPrinter = async (serial: string) => {
    const printerName = printers.find(p => p.serial === serial)?.name || serial;
    addToast(`Disconnecting "${printerName}"...`, 'info');
    try {
      const response = await fetch(`${apiBase}/api/printer/disconnect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });
      if (response.ok) addToast(`Disconnected "${printerName}"`, 'success');
      else { const data = await response.json(); addToast(`Disconnect failed: ${data.error || 'Unknown error'}`, 'error'); }
    } catch { addToast('Network error: failed to disconnect.', 'error'); }
    clearPrinterTelemetry(serial);
  };

  const handleStartMock = async (serial: string, filename: string) => {
    const printerName = printers.find(p => p.serial === serial)?.name || serial;
    try {
      const response = await fetch(`${apiBase}/api/printer/mock/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, filename }),
      });
      if (response.ok) addToast(`Started print simulation on "${printerName}"`, 'success');
      else { const data = await response.json(); addToast(`Failed to start simulation: ${data.error || 'Unknown error'}`, 'error'); }
    } catch { addToast('Network error: failed to start simulation.', 'error'); }
  };

  const handleStopMock = async (serial: string) => {
    const printerName = printers.find(p => p.serial === serial)?.name || serial;
    try {
      const response = await fetch(`${apiBase}/api/printer/mock/stop`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });
      if (response.ok) addToast(`Stopped simulation on "${printerName}"`, 'info');
      else { const data = await response.json(); addToast(`Failed to stop simulation: ${data.error || 'Unknown error'}`, 'error'); }
    } catch { addToast('Network error: failed to stop simulation.', 'error'); }
    clearPrinterTelemetry(serial);
  };

  return (
    <PrinterStatus
      printers={printers}
      activePrinterSerial={activePrinterSerial}
      telemetryMap={telemetryMap}
      connectionStatusMap={connectionStatusMap}
      onSelectActivePrinter={setActivePrinter}
      onAddPrinter={addPrinter}
      onUpdatePrinter={updatePrinter}
      onDeletePrinter={(id) => deletePrinter(id)}
      onConnectPrinter={handleConnectPrinter}
      onDisconnectPrinter={handleDisconnectPrinter}
      onStartMock={handleStartMock}
      onStopMock={handleStopMock}
      viewMode="full"
    />
  );
}
