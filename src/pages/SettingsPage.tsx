import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useJobStore } from '../stores/useJobStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useToastStore } from '../stores/useToastStore';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SettingsPage() {
  const { pricingVars, shopName, updatePricingVars, updateShopName } = useSettingsStore();
  const { jobs, failuresLog, setJobs } = useJobStore();
  const { setActivePrinter, resetAllConnections } = usePrinterStore();
  const { addToast } = useToastStore();

  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = async () => {
    try {
      const { resetDb } = await import('../lib/database');
      await resetDb();
      setJobs([]);
      useFilamentStore.setState({ spools: [], logs: [] });
      usePrinterStore.setState({ printers: [], activePrinterSerial: null, telemetryMap: {}, connectionStatusMap: {} });
      useJobStore.setState({ failuresLog: [], historyLog: [] });
      resetAllConnections();
      addToast('Application database reset successfully.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to reset database.', 'error');
    }
    setConfirmReset(false);
  };

  return (
    <>
      <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-800 text-lg flex items-center">
          <Sliders className="w-5 h-5 mr-2 text-brand-orange" />
          Global Configurations
        </h3>

        <div className="space-y-5">
          <div className="space-y-4">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Default Pricing Formula</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Filament Rate (PHP/g)</label>
                <input type="number" step="0.1" value={pricingVars.pricePerGram}
                  onChange={(e) => updatePricingVars({ pricePerGram: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Printer Time Rate (PHP/hr)</label>
                <input type="number" value={pricingVars.pricePerHour}
                  onChange={(e) => updatePricingVars({ pricePerHour: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Service Fee &amp; Prep (%)</label>
                <input type="number" step="0.5" value={pricingVars.serviceFeePercent}
                  onChange={(e) => updatePricingVars({ serviceFeePercent: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Flat Rate Setup Fee (PHP)</label>
                <input type="number" value={pricingVars.flatMarkup}
                  onChange={(e) => updatePricingVars({ flatMarkup: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2" />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Shop Settings</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Shop Name / Operator Name</label>
              <input type="text" value={shopName} onChange={(e) => updateShopName(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2" />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-2">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Database Diagnostics</h4>
            <div className="flex flex-col space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100/50">
              <div className="flex justify-between items-center">
                <span>Active Workflow Jobs count: <span className="font-bold text-slate-800">{jobs.length}</span></span>
                <span>Filament Spools count: <span className="font-bold text-slate-800">{spools.length}</span></span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                <span>Recorded failures: <span className="font-bold text-slate-800">{failuresLog.length}</span></span>
                <button onClick={() => setConfirmReset(true)} className="text-red-500 hover:text-red-700 font-bold hover:underline">
                  Reset Application Database
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => addToast('Global configurations saved successfully.', 'success')}
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmReset}
        title="Reset Application Database"
        message="Are you sure you want to restore default empty lists? This will clear all current jobs, filaments, failures and printers."
        confirmLabel="Reset Everything"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
        variant="danger"
      />
    </>
  );
}
