import React, { useState, useEffect } from 'react';
import { Check, LayoutDashboard, Briefcase, FileSignature, Settings as SettingsIcon, Tag, Cpu, TrendingUp, X, Info, AlertCircle, AlertTriangle, User, History, Plus, FileText } from 'lucide-react';
import { useToastStore } from './stores/useToastStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { usePrinterStore } from './stores/usePrinterStore';
import { useJobStore } from './stores/useJobStore';
import { useFilamentStore } from './stores/useFilamentStore';
import { useCustomerStore } from './stores/useCustomerStore';
import { getApiBase } from './utils/api';
import { useWebSocket } from './hooks/useWebSocket';
import { useTelemetrySync } from './hooks/useTelemetrySync';

// Pages
import DashboardPage from './pages/DashboardPage';
import JobBoardPage from './pages/JobBoardPage';
import QuotesPage from './pages/QuotesPage';
import PrintersPage from './pages/PrintersPage';
import FilamentsPage from './pages/FilamentsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';

// Components
import PrinterStatus from './components/PrinterStatus';
import ReconnectionBanner from './components/ReconnectionBanner';
import NotificationCenter from './components/NotificationCenter';

export interface FilamentLog {
  id: string;
  spoolId: string;
  spoolName: string;
  jobTitle: string;
  grams: number;
  type: 'deduction' | 'waste' | 'refill';
  date: string;
}

type TabType = 'dashboard' | 'jobs' | 'quotes' | 'printers' | 'settings' | 'filaments' | 'analytics' | 'history' | 'customers';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  // Connect hooks
  const { isConnected, reconnectAttempt } = useWebSocket();
  useTelemetrySync();

  // Initialize Database, Migrations, and Stores
  useEffect(() => {
    async function setupDb() {
      try {
        const { initDb } = await import('./lib/database');
        const { runMigration } = await import('./lib/migrate');
        
        await initDb();
        await runMigration();
      } catch (e) {
        console.error("Error setting up SQLite database and migrations:", e);
      }

      // Initialize stores in isolation (so one failure doesn't block the rest)
      const storeInits = [
        { name: 'SettingsStore', action: () => useSettingsStore.getState().init() },
        { name: 'PrinterStore', action: () => usePrinterStore.getState().init() },
        { name: 'FilamentStore', action: () => useFilamentStore.getState().init() },
        { name: 'CustomerStore', action: () => useCustomerStore.getState().init() },
        { name: 'JobStore', action: () => useJobStore.getState().init() },
      ];

      for (const item of storeInits) {
        try {
          await item.action();
        } catch (e) {
          console.error(`Error initializing ${item.name}:`, e);
        }
      }

      try {
        const { useNotificationStore } = await import('./stores/useNotificationStore');
        await useNotificationStore.getState().init();
      } catch (e) {
        console.error("Error initializing NotificationStore:", e);
      }
    }
    setupDb();
  }, []);

  // Stores
  const { toasts, removeToast } = useToastStore();
  const { shopName, pricingVars } = useSettingsStore();
  const { printers, activePrinterSerial, telemetryMap, connectionStatusMap, setActivePrinter, addPrinter, updatePrinter, deletePrinter, setConnectionStatus, clearPrinterTelemetry } = usePrinterStore();
  const { incomingSlicerJob, setIncomingSlicerJob, addJob, setParsedFile } = useJobStore();
  const { addToast } = useToastStore();

  const handleTabChange = (tab: TabType) => {
    setIsLoading(true);
    setActiveTab(tab);
    setTimeout(() => setIsLoading(false), 250);
  };

  // Sync printer profiles with backend
  useEffect(() => {
    const apiBase = getApiBase();
    fetch(`${apiBase}/api/printers/sync`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printers }),
    }).catch(() => {});
  }, [printers]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Header computed values
  const activePrinterObj = printers.find(p => p.serial === activePrinterSerial);
  const activePrinterName = activePrinterObj ? activePrinterObj.name : 'No Printer Configured';
  const activePrinterStatus = activePrinterSerial ? (connectionStatusMap[activePrinterSerial] || 'offline') : 'offline';
  const getInitials = (nameStr: string) => nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Printer action handlers for sidebar widget
  const apiBase = getApiBase();
  const handleConnectPrinter = async (printer: any) => {
    setConnectionStatus(printer.serial, 'connecting');
    addToast(`Connecting to "${printer.name}"...`, 'info');
    try {
      const response = await fetch(`${apiBase}/api/printer/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(printer) });
      if (!response.ok) { const data = await response.json(); addToast(`Connect failed: ${data.error || 'Unknown error'}`, 'error'); setConnectionStatus(printer.serial, 'offline'); }
    } catch { setConnectionStatus(printer.serial, 'offline'); addToast('Network error.', 'error'); }
  };
  const handleDisconnectPrinter = async (serial: string) => {
    addToast(`Disconnecting...`, 'info');
    try { await fetch(`${apiBase}/api/printer/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial }) }); } catch {}
    clearPrinterTelemetry(serial);
  };
  const handleStartMock = async (serial: string, filename: string) => {
    try { const r = await fetch(`${apiBase}/api/printer/mock/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial, filename }) }); if (r.ok) addToast('Simulation started', 'success'); } catch {}
  };
  const handleStopMock = async (serial: string) => {
    try { await fetch(`${apiBase}/api/printer/mock/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial }) }); } catch {}
    clearPrinterTelemetry(serial);
  };

  const TAB_TITLES: Record<TabType, string> = {
    dashboard: 'Dashboard Overview', jobs: 'Job Board Kanban', quotes: 'Pricing Engine',
    printers: 'Printers Integration', filaments: 'Filament Inventory', customers: 'Client Directory',
    history: 'Print History Ledger', analytics: 'Financial Analytics', settings: 'Global Configurations',
  };

  const NAV_ITEMS: { tab: TabType; icon: any; label: string }[] = [
    { tab: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { tab: 'jobs', icon: Briefcase, label: 'Job Board' },
    { tab: 'quotes', icon: FileSignature, label: 'Pricing Engine' },
    { tab: 'printers', icon: Cpu, label: 'Printers' },
    { tab: 'filaments', icon: Tag, label: 'Filament Inventory' },
    { tab: 'customers', icon: User, label: 'Client Directory' },
    { tab: 'history', icon: History, label: 'Print History' },
    { tab: 'analytics', icon: TrendingUp, label: 'Analytics' },
    { tab: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden text-slate-700 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-brand-navy text-gray-200 flex flex-col flex-shrink-0 border-r border-brand-navy/20">
        <div className="p-6 flex items-center space-x-3">
          <div className="bg-white p-1 rounded-xl shadow-inner flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 96 64" className="w-11 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 46 16 A 16 16 0 1 0 46 48" fill="none" stroke="#FF8025" strokeWidth="7" strokeLinecap="round"/>
              <path d="M 68 16 A 16 16 0 1 0 68 48" fill="none" stroke="#003B5C" strokeWidth="7" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-white font-black text-xl tracking-tight">CCprint</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map(({ tab, icon: Icon, label }) => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab ? 'sidebar-active' : 'hover:bg-white/10 hover:text-white'
              }`}>
              <Icon className="w-5 h-5 mr-3 shrink-0" />{label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10">
          <PrinterStatus
            printers={printers} activePrinterSerial={activePrinterSerial}
            telemetryMap={telemetryMap} connectionStatusMap={connectionStatusMap}
            onSelectActivePrinter={setActivePrinter}
            onAddPrinter={addPrinter}
            onUpdatePrinter={updatePrinter}
            onDeletePrinter={(id) => deletePrinter(id)}
            onConnectPrinter={handleConnectPrinter}
            onDisconnectPrinter={handleDisconnectPrinter}
            onStartMock={handleStartMock}
            onStopMock={handleStopMock}
            viewMode="sidebar"
          />
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        {/* Reconnection Banner */}
        <ReconnectionBanner isConnected={isConnected} reconnectAttempt={reconnectAttempt} />

        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="font-bold text-slate-800 text-lg uppercase tracking-wider">{TAB_TITLES[activeTab]}</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <span className={`w-2.5 h-2.5 rounded-full ${
                activePrinterStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                activePrinterStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
              }`} />
              <span className="text-slate-650 truncate max-w-[120px]">{activePrinterName}</span>
              <span className={activePrinterStatus === 'online' ? 'text-emerald-600' : 'text-slate-400'}>
                • {activePrinterStatus === 'online' ? 'Online' : activePrinterStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <NotificationCenter />
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center text-xs font-black text-white shadow-sm">
                {getInitials(shopName)}
              </div>
              <span className="text-sm font-semibold text-slate-700">{shopName}</span>
            </div>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="space-y-2"><div className="h-6 w-48 bg-slate-200 rounded-lg"></div><div className="h-3 w-72 bg-slate-150 rounded-md"></div></div>
                <div className="h-9 w-32 bg-slate-200 rounded-xl"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(n => (
                  <div key={n} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-24 space-y-3">
                    <div className="h-3 w-16 bg-slate-150 rounded"></div><div className="h-5 w-28 bg-slate-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
              {activeTab === 'jobs' && <JobBoardPage onNavigate={handleTabChange} />}
              {activeTab === 'quotes' && <QuotesPage />}
              {activeTab === 'printers' && <PrintersPage />}
              {activeTab === 'filaments' && <FilamentsPage />}
              {activeTab === 'analytics' && <AnalyticsPage />}
              {activeTab === 'settings' && <SettingsPage />}
              {activeTab === 'customers' && <CustomersPage />}
              {activeTab === 'history' && <HistoryPage />}
            </>
          )}
        </main>
      </div>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
          let bgColor = 'bg-blue-50/90 text-blue-800 border-blue-200';
          let Icon = Info;
          if (toast.type === 'success') { bgColor = 'bg-emerald-50/90 text-emerald-800 border-emerald-200'; Icon = Check; }
          else if (toast.type === 'error') { bgColor = 'bg-red-50/90 text-red-800 border-red-200'; Icon = AlertCircle; }
          else if (toast.type === 'warning') { bgColor = 'bg-amber-50/90 text-amber-800 border-amber-200'; Icon = AlertTriangle; }
          return (
            <div key={toast.id} className={`pointer-events-auto flex items-start p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-slideIn ${bgColor}`}>
              <Icon className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-semibold leading-relaxed">{toast.message}</div>
              <button onClick={() => removeToast(toast.id)} className="ml-3 shrink-0 text-slate-450 hover:text-slate-650 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Incoming Slicer Job Modal */}
      {incomingSlicerJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-6 transform scale-100 animate-slideIn">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-brand-orange/10 text-brand-orange text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Slicer upload received</span>
                <h3 className="font-extrabold text-slate-800 text-lg mt-1.5 truncate max-w-[320px]" title={incomingSlicerJob.filename}>{incomingSlicerJob.filename}</h3>
              </div>
              <button onClick={() => setIncomingSlicerJob(null)} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-50 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl space-y-3.5 border border-slate-100/50">
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-650">
                <div><span className="text-slate-400 text-[10px] block font-bold uppercase">Weight</span><span className="text-slate-800 font-extrabold text-sm">{incomingSlicerJob.filamentWeightGrams} g</span></div>
                <div><span className="text-slate-400 text-[10px] block font-bold uppercase">Estimated Time</span><span className="text-slate-800 font-extrabold text-sm">{incomingSlicerJob.printTimeString}</span></div>
                <div><span className="text-slate-400 text-[10px] block font-bold uppercase">Layer Height</span><span className="text-slate-850 font-extrabold">{incomingSlicerJob.layerHeightMm.toFixed(2)} mm</span></div>
                <div><span className="text-slate-400 text-[10px] block font-bold uppercase">Estimated Price</span><span className="text-brand-orange font-black text-sm">{pricingVars.currencySymbol}{Math.round((incomingSlicerJob.filamentWeightGrams * pricingVars.pricePerGram + (incomingSlicerJob.printTimeMinutes / 60) * pricingVars.pricePerHour) * (1 + pricingVars.serviceFeePercent / 100) + pricingVars.flatMarkup).toFixed(2)}</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setParsedFile(incomingSlicerJob); setIncomingSlicerJob(null); handleTabChange('quotes'); }}
                className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-sm">
                <FileSignature className="w-4 h-4 mr-2" /> Configure Quote in Pricing Engine
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => {
                  addJob({ title: incomingSlicerJob.filename.replace(/\.gcode(\.3mf)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), client: 'Walk-in Client', weight: incomingSlicerJob.filamentWeightGrams, printTimeMinutes: incomingSlicerJob.printTimeMinutes, price: Math.round(((incomingSlicerJob.filamentWeightGrams * pricingVars.pricePerGram + (incomingSlicerJob.printTimeMinutes / 60) * pricingVars.pricePerHour) * (1 + pricingVars.serviceFeePercent / 100) + pricingVars.flatMarkup) * 100) / 100, filename: incomingSlicerJob.filename, status: 'Pending Quote' });
                  setIncomingSlicerJob(null);
                }} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-colors shadow-sm">
                  <Plus className="w-3.5 h-3.5 mr-1 text-slate-400" /> Add to Kanban
                </button>
                <button disabled={!activePrinterSerial || activePrinterStatus !== 'online'}
                  onClick={async () => {
                    if (!activePrinterSerial) return;
                    try {
                      const response = await fetch(`${apiBase}/api/printer/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial: activePrinterSerial, filename: incomingSlicerJob.filename }) });
                      if (response.ok) {
                        addJob({ title: incomingSlicerJob.filename.replace(/\.gcode(\.3mf)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), client: 'Walk-in Client', weight: incomingSlicerJob.filamentWeightGrams, printTimeMinutes: incomingSlicerJob.printTimeMinutes, price: Math.round(((incomingSlicerJob.filamentWeightGrams * pricingVars.pricePerGram + (incomingSlicerJob.printTimeMinutes / 60) * pricingVars.pricePerHour) * (1 + pricingVars.serviceFeePercent / 100) + pricingVars.flatMarkup) * 100) / 100, filename: incomingSlicerJob.filename, status: 'Printing' });
                        addToast('Print job sent successfully!', 'success');
                      } else {
                        addToast('Failed to send to printer.', 'error');
                      }
                    } catch { addToast('Connection error.', 'error'); }
                    setIncomingSlicerJob(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-colors shadow-sm"
                  title={!activePrinterSerial ? "Connect printer in sidebar first" : ""}>
                  <Cpu className="w-3.5 h-3.5 mr-1 text-slate-400" /> Send to Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
