import React, { useState, useEffect } from 'react';
import { Power, ShieldCheck, Compass, Play, Square, WifiOff, RefreshCw, Plus, Edit2, Trash2, Check } from 'lucide-react';

export interface PrinterProfile {
  id: string;
  name: string;
  ip: string;
  serial: string;
  accessCode: string;
}

interface PrinterStatusProps {
  printers: PrinterProfile[];
  activePrinterSerial: string | null;
  telemetryMap: Record<string, any>;
  connectionStatusMap: Record<string, 'offline' | 'connecting' | 'online'>;
  onSelectActivePrinter: (serial: string | null) => void;
  onAddPrinter: (printer: PrinterProfile) => void;
  onUpdatePrinter: (id: string, updated: Partial<PrinterProfile>) => void;
  onDeletePrinter: (id: string) => void;
  onConnectPrinter: (printer: PrinterProfile) => void;
  onDisconnectPrinter: (serial: string) => void;
  onStartMock: (serial: string, filename: string) => void;
  onStopMock: (serial: string) => void;
  viewMode?: 'sidebar' | 'full';
}

export default function PrinterStatus({
  printers,
  activePrinterSerial,
  telemetryMap,
  connectionStatusMap,
  onSelectActivePrinter,
  onAddPrinter,
  onUpdatePrinter,
  onDeletePrinter,
  onConnectPrinter,
  onDisconnectPrinter,
  onStartMock,
  onStopMock,
  viewMode = 'full',
}: PrinterStatusProps) {
  // Form visibility and inputs state
  const [showForm, setShowForm] = useState(false);
  const [tempHistoryMap, setTempHistoryMap] = useState<Record<string, { nozzle: number; bed: number }[]>>({});

  useEffect(() => {
    if (!activePrinterSerial) return;
    setTempHistoryMap(prev => {
      if (!prev[activePrinterSerial]) {
        // Pre-fill with 30 ambient temperature readings (25°C) to seed the chart nicely
        const initial = Array.from({ length: 30 }, () => ({ nozzle: 25, bed: 25 }));
        return {
          ...prev,
          [activePrinterSerial]: initial
        };
      }
      return prev;
    });
  }, [activePrinterSerial]);

  useEffect(() => {
    if (!activePrinterSerial) return;
    const telemetry = telemetryMap[activePrinterSerial];
    if (!telemetry || !telemetry.print) return;

    const nTemp = telemetry.print.nozzle_temper !== undefined ? telemetry.print.nozzle_temper : 0;
    const bTemp = telemetry.print.bed_temper !== undefined ? telemetry.print.bed_temper : 0;

    setTempHistoryMap(prev => {
      const history = prev[activePrinterSerial] || [];
      const last = history[history.length - 1];
      
      // Skip duplicate entries to keep chart smooth
      if (last && last.nozzle === nTemp && last.bed === bTemp) {
        return prev;
      }

      const updated = [...history, { nozzle: nTemp, bed: bTemp }].slice(-30);
      return {
        ...prev,
        [activePrinterSerial]: updated
      };
    });
  }, [telemetryMap, activePrinterSerial]);

  const activeHistory = activePrinterSerial ? (tempHistoryMap[activePrinterSerial] || []) : [];
  
  let nozzleLineD = '';
  let nozzleAreaD = '';
  let bedLineD = '';
  let bedAreaD = '';
  let yMin = 0;
  let yMax = 100;
  let yMid = 50;

  if (activeHistory.length > 0) {
    const allTemps = activeHistory.flatMap(pt => [pt.nozzle, pt.bed]);
    const dataMin = Math.min(...allTemps);
    const dataMax = Math.max(...allTemps);
    const range = dataMax - dataMin;
    const padding = Math.max(10, range * 0.25);
    yMin = Math.max(0, Math.floor(dataMin - padding));
    yMax = Math.ceil(dataMax + padding);
    yMid = Math.round((yMin + yMax) / 2);

    const chartTop = 10;
    const chartBottom = 190;
    const chartHeight = chartBottom - chartTop;

    const mapY = (temp: number) => {
      const clamped = Math.max(yMin, Math.min(yMax, temp));
      return chartBottom - ((clamped - yMin) / (yMax - yMin)) * chartHeight;
    };

    const mapX = (index: number) => {
      return 40 + (index / (activeHistory.length - 1)) * 450;
    };

    const pointsNozzle = activeHistory.map((pt, idx) => `${mapX(idx)},${mapY(pt.nozzle)}`);
    nozzleLineD = `M ${pointsNozzle.join(' L ')}`;
    nozzleAreaD = `M ${mapX(0)},${chartBottom} L ${pointsNozzle.join(' L ')} L ${mapX(activeHistory.length - 1)},${chartBottom} Z`;

    const pointsBed = activeHistory.map((pt, idx) => `${mapX(idx)},${mapY(pt.bed)}`);
    bedLineD = `M ${pointsBed.join(' L ')}`;
    bedAreaD = `M ${mapX(0)},${chartBottom} L ${pointsBed.join(' L ')} L ${mapX(activeHistory.length - 1)},${chartBottom} Z`;
  }
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [serial, setSerial] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const formatRemainingTime = (mins: number) => {
    if (mins <= 0) return 'Complete';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  const resetForm = () => {
    setName('');
    setIp('');
    setSerial('');
    setAccessCode('');
    setShowForm(false);
    setEditingPrinterId(null);
  };

  const handleEdit = (printer: PrinterProfile) => {
    setEditingPrinterId(printer.id);
    setName(printer.name);
    setIp(printer.ip);
    setSerial(printer.serial);
    setAccessCode(printer.accessCode);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ip || !serial || !accessCode) {
      alert('Please fill in all printer fields.');
      return;
    }

    if (editingPrinterId) {
      onUpdatePrinter(editingPrinterId, { name, ip, serial, accessCode });
    } else {
      const newPrinter: PrinterProfile = {
        id: 'printer-' + Math.random().toString(36).substring(2, 9),
        name,
        ip,
        serial,
        accessCode,
      };
      onAddPrinter(newPrinter);
      // Auto select if first printer
      if (printers.length === 0) {
        onSelectActivePrinter(newPrinter.serial);
      }
    }
    resetForm();
  };

  // 1. Sidebar list rendering
  if (viewMode === 'sidebar') {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Printers Online</h4>
        {printers.length === 0 ? (
          <div className="bg-[#1f2937] rounded-xl p-3 text-center text-xs text-slate-500 border border-slate-700/30">
            No Printers Added
          </div>
        ) : (
          printers.map((printer) => {
            const status = connectionStatusMap[printer.serial] || 'offline';
            const telemetry = telemetryMap[printer.serial];
            const printState = telemetry?.print || {};
            const mcPercent = printState.mc_percent !== undefined ? printState.mc_percent : 0;
            const mcRemaining = printState.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;
            const activeFile = printState.subtask_name || '';
            const isActive = activePrinterSerial === printer.serial;

            return (
              <div 
                key={printer.serial}
                onClick={() => onSelectActivePrinter(printer.serial)}
                className={`rounded-xl p-3 space-y-2 border transition-all cursor-pointer hover:bg-slate-700/20 ${
                  isActive ? 'border-emerald-500 bg-slate-750 text-white' : 'border-slate-700/30 bg-[#1f2937]'
                }`}
              >
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center truncate pr-1">
                    <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${
                      status === 'online' ? 'bg-emerald-500' :
                      status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <span className="truncate text-slate-200">{printer.name}</span>
                  </span>
                  {status === 'online' && mcPercent > 0 && (
                    <span className="text-[10px] text-emerald-400 font-bold shrink-0">{mcPercent}%</span>
                  )}
                </div>

                {status === 'online' && activeFile && (
                  <div className="text-[9px] text-slate-400 truncate pt-1.5 border-t border-slate-700/40">
                    <div className="truncate text-slate-350">File: {activeFile}</div>
                    <div className="mt-0.5">Remaining: <span className="text-white font-bold">{formatRemainingTime(mcRemaining)}</span></div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // Active Printer details
  const activePrinter = printers.find(p => p.serial === activePrinterSerial) || null;
  const activeStatus = activePrinter ? (connectionStatusMap[activePrinter.serial] || 'offline') : 'offline';
  const activeTelemetry = activePrinter ? telemetryMap[activePrinter.serial] : null;

  const printState = activeTelemetry?.print || {};
  const gcodeState = printState.gcode_state || 'IDLE';
  const mcPercent = printState.mc_percent !== undefined ? printState.mc_percent : 0;
  const mcRemaining = printState.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;
  const nozzleTemp = printState.nozzle_temper !== undefined ? printState.nozzle_temper : 0;
  const nozzleTarget = printState.nozzle_target_temper !== undefined ? printState.nozzle_target_temper : 0;
  const bedTemp = printState.bed_temper !== undefined ? printState.bed_temper : 0;
  const bedTarget = printState.bed_target_temper !== undefined ? printState.bed_target_temper : 0;
  const chamberTemp = printState.chamber_temper !== undefined ? printState.chamber_temper : 0;
  const activeFile = printState.subtask_name || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Printers Management</h2>
          <p className="text-xs text-slate-400 font-medium">Link multi-printer profiles over MQTT local network and simulate workflows</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl text-sm font-semibold flex items-center transition-colors shadow-sm"
        >
          {showForm ? 'Cancel' : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Printer
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md space-y-4 max-w-xl animate-fadeIn">
          <h3 className="font-bold text-slate-800 text-sm">
            {editingPrinterId ? 'Edit Printer Profile' : 'Add New Printer Profile'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Friendly Name</label>
              <input
                type="text"
                placeholder="e.g. Bambu Carbon X1-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">IP Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.18"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Serial Number</label>
              <input
                type="text"
                placeholder="e.g. 01S00A12345678"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Access Code</label>
              <input
                type="password"
                placeholder="MQTT Access Code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-100 hover:bg-slate-200 text-slate-650 py-2 px-4 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg text-xs font-semibold flex items-center shadow-sm"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {editingPrinterId ? 'Update Printer' : 'Add Printer'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Printers List Panel */}
        <div className="space-y-4 lg:col-span-1">
          <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider px-1">Integrated Printers</h3>
          
          {printers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400 text-xs italic">
              No printer profiles configured. Add a printer to begin.
            </div>
          ) : (
            printers.map((printer) => {
              const status = connectionStatusMap[printer.serial] || 'offline';
              const isSelected = activePrinterSerial === printer.serial;
              const telemetry = telemetryMap[printer.serial];
              const isSimulating = telemetry?.source === 'mock' && telemetry?.print?.gcode_state === 'RUNNING';

              return (
                <div 
                  key={printer.id}
                  className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between space-y-4 transition-all relative ${
                    isSelected ? 'ring-2 ring-emerald-500 border-transparent shadow-md' : 'border-slate-150 hover:border-slate-250'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => onSelectActivePrinter(printer.serial)}
                    >
                      <h4 className="font-black text-slate-800 text-sm leading-tight flex items-center">
                        <span className={`w-2.5 h-2.5 rounded-full mr-2 ${
                          status === 'online' ? 'bg-emerald-500 animate-pulse' :
                          status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                        }`} />
                        {printer.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold block mt-1">SN: {printer.serial}</span>
                      <span className="text-[10px] text-slate-400 font-bold block">IP: {printer.ip}</span>
                    </div>

                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleEdit(printer)}
                        className="p-1 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Delete printer "${printer.name}"?`)) onDeletePrinter(printer.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded"
                        title="Delete profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col space-y-2">
                    {status === 'online' ? (
                      <button 
                        onClick={() => onDisconnectPrinter(printer.serial)}
                        className="w-full bg-red-50 hover:bg-red-100 border border-red-100 text-red-655 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors"
                      >
                        <Power className="w-3 h-3 mr-1" />
                        Disconnect
                      </button>
                    ) : (
                      <button 
                        onClick={() => onConnectPrinter(printer)}
                        disabled={status === 'connecting'}
                        className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 disabled:bg-slate-550 disabled:text-white py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors"
                      >
                        {status === 'connecting' ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" />
                            Connect MQTT
                          </>
                        )}
                      </button>
                    )}

                    {isSimulating ? (
                      <button 
                        onClick={() => onStopMock(printer.serial)}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors shadow-sm"
                      >
                        <Square className="w-3 h-3 mr-1" />
                        Stop Simulation
                      </button>
                    ) : (
                      <button 
                        onClick={() => onStartMock(printer.serial, 'phone_stand_foldable.gcode')}
                        className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors"
                      >
                        <Play className="w-3 h-3 mr-1 text-emerald-500" />
                        Start Simulation
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Telemetry Visualizer Panel */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider px-1">
            Telemetry Dashboard: {activePrinter ? activePrinter.name : 'Select a Printer'}
          </h3>

          {!activePrinter ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center space-y-3">
              <WifiOff className="w-12 h-12 text-slate-300 stroke-1" />
              <div>
                <h4 className="font-bold text-slate-700">No Printer Active</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs">
                  Select a printer card from the left panel to active live telemetry streaming.
                </p>
              </div>
            </div>
          ) : activeStatus !== 'online' ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
              <WifiOff className="w-12 h-12 text-slate-300 stroke-1" />
              <div>
                <h4 className="font-bold text-slate-700">Printer Telemetry Offline</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs">
                  Printer "{activePrinter.name}" is offline. Connect the printer or run a simulation to see active telemetry.
                </p>
              </div>
              <button 
                onClick={() => onConnectPrinter(activePrinter)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-5 rounded-xl shadow-xs transition-colors"
              >
                Connect Now
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Circle Dial */}
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-95">
                      <circle
                        cx="88"
                        cy="88"
                        r="76"
                        stroke="#f1f5f9"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="88"
                        cy="88"
                        r="76"
                        stroke="#10b981"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 76}
                        strokeDashoffset={2 * Math.PI * 76 * (1 - mcPercent / 100)}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-slate-800">{mcPercent}%</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{gcodeState}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 truncate max-w-[280px]">
                      {activeFile || 'Idle (Ready to Print)'}
                    </h4>
                    {gcodeState === 'RUNNING' && (
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Est. Remaining: <span className="text-slate-800 font-bold">{formatRemainingTime(mcRemaining)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Temperatures Panel */}
                <div className="space-y-4">
                  {/* Nozzle */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Nozzle Temp</span>
                      <span className="text-slate-800">
                        {nozzleTemp}°C <span className="text-slate-400 font-normal">/ {nozzleTarget || 0}°C</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-red-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, nozzleTarget > 0 ? (nozzleTemp / nozzleTarget) * 100 : (nozzleTemp / 300) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Bed */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Heated Bed Temp</span>
                      <span className="text-slate-800">
                        {bedTemp}°C <span className="text-slate-400 font-normal">/ {bedTarget || 0}°C</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, bedTarget > 0 ? (bedTemp / bedTarget) * 100 : (bedTemp / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Chamber */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">Chamber Temp</span>
                      <span className="text-slate-800">{chamberTemp}°C</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-400 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (chamberTemp / 80) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="border border-slate-150 p-2.5 rounded-xl flex items-center space-x-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold leading-tight">FAN SPEED</span>
                        <span className="text-[11px] text-slate-700 font-extrabold leading-tight">100% (Active)</span>
                      </div>
                    </div>
                    <div className="border border-slate-150 p-2.5 rounded-xl flex items-center space-x-2.5">
                      <Compass className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold leading-tight">AMS SLOTS</span>
                        <span className="text-[11px] text-slate-700 font-extrabold leading-tight">4 / 4 Loaded</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Temperature Trend Graph */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time Temperature Trends</h4>
                  <div className="flex space-x-4 text-[10px] font-bold">
                    <span className="flex items-center text-red-500">
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                      Nozzle: {Math.round(nozzleTemp * 10) / 10}°C
                    </span>
                    <span className="flex items-center text-amber-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
                      Bed: {Math.round(bedTemp * 10) / 10}°C
                    </span>
                  </div>
                </div>
                <div className="h-52 w-full bg-slate-50/50 rounded-xl p-4 border border-slate-150 relative">
                  {activeHistory.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                      Awaiting telemetry stream...
                    </div>
                  ) : (
                    <svg viewBox="0 0 500 200" className="w-full h-full">
                      <defs>
                        <linearGradient id="nozzleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02"/>
                        </linearGradient>
                        <linearGradient id="bedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18"/>
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02"/>
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      <line x1="40" y1="10" x2="490" y2="10" stroke="#e2e8f0" strokeDasharray="4,4" strokeWidth="0.5"/>
                      <line x1="40" y1="100" x2="490" y2="100" stroke="#e2e8f0" strokeDasharray="4,4" strokeWidth="0.5"/>
                      <line x1="40" y1="190" x2="490" y2="190" stroke="#cbd5e1" strokeWidth="0.5"/>

                      {/* Y-axis labels */}
                      <text x="2" y="14" fill="#94a3b8" fontSize="8" fontWeight="600">{yMax}°C</text>
                      <text x="2" y="104" fill="#94a3b8" fontSize="8" fontWeight="600">{yMid}°C</text>
                      <text x="2" y="194" fill="#94a3b8" fontSize="8" fontWeight="600">{yMin}°C</text>

                      {/* Nozzle Area & Line */}
                      <path d={nozzleAreaD} fill="url(#nozzleGrad)"/>
                      <path d={nozzleLineD} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

                      {/* Bed Area & Line */}
                      <path d={bedAreaD} fill="url(#bedGrad)"/>
                      <path d={bedLineD} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

                      {/* Current value dots */}
                      {activeHistory.length > 1 && (
                        <>
                          <circle cx={40 + ((activeHistory.length - 1) / (activeHistory.length - 1)) * 450} cy={190 - ((Math.max(yMin, Math.min(yMax, activeHistory[activeHistory.length - 1].nozzle)) - yMin) / (yMax - yMin)) * 180} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
                          <circle cx={40 + ((activeHistory.length - 1) / (activeHistory.length - 1)) * 450} cy={190 - ((Math.max(yMin, Math.min(yMax, activeHistory[activeHistory.length - 1].bed)) - yMin) / (yMax - yMin)) * 180} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1.5"/>
                        </>
                      )}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
