import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Tag, ShieldAlert, Check, ExternalLink, Clock } from 'lucide-react';

export interface FilamentSpool {
  id: string;
  name: string;       // Brand / Label, e.g. "eSUN PLA+"
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'ASA' | 'Other';
  colorName: string;  // e.g. "Charcoal Black"
  colorHex: string;   // e.g. "#1e293b"
  cost: number;       // e.g. 800 PHP
  initialWeight: number; // e.g. 1000 g
  weightLeft: number;    // e.g. 650 g
  lowWeightThreshold: number; // customizable threshold, e.g. 150 g
}

export interface FilamentLog {
  id: string;
  spoolId: string;
  spoolName: string;
  jobTitle: string;
  grams: number;
  type: 'deduction' | 'waste' | 'refill';
  date: string;
}

interface FilamentInventoryProps {
  spools: FilamentSpool[];
  logs?: FilamentLog[];
  onAddSpool: (spool: FilamentSpool) => void;
  onUpdateSpool: (id: string, updated: Partial<FilamentSpool>) => void;
  onDeleteSpool: (id: string) => void;
}

const MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Other'] as const;

const PRESET_COLORS = [
  { name: 'Black', hex: '#1e293b' },
  { name: 'White', hex: '#f8fafc' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Grey', hex: '#64748b' },
  { name: 'Purple', hex: '#a855f7' },
];

export default function FilamentInventory({
  spools,
  logs = [],
  onAddSpool,
  onUpdateSpool,
  onDeleteSpool,
}: FilamentInventoryProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSpoolId, setEditingSpoolId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [material, setMaterial] = useState<FilamentSpool['material']>('PLA');
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#1e293b');
  const [cost, setCost] = useState<number>(800);
  const [initialWeight, setInitialWeight] = useState<number>(1000);
  const [weightLeft, setWeightLeft] = useState<number>(1000);
  const [lowWeightThreshold, setLowWeightThreshold] = useState<number>(150);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !colorName) {
      alert('Please fill in spool brand and color name.');
      return;
    }

    if (editingSpoolId) {
      // Edit mode
      onUpdateSpool(editingSpoolId, {
        name,
        material,
        colorName,
        colorHex,
        cost,
        initialWeight,
        weightLeft,
        lowWeightThreshold,
      });
      setEditingSpoolId(null);
    } else {
      // Add mode
      const newSpool: FilamentSpool = {
        id: 'spool-' + Math.random().toString(36).substring(2, 9),
        name,
        material,
        colorName,
        colorHex,
        cost,
        initialWeight,
        weightLeft,
        lowWeightThreshold,
      };
      onAddSpool(newSpool);
    }

    // Reset Form
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setMaterial('PLA');
    setColorName('');
    setColorHex('#1e293b');
    setCost(800);
    setInitialWeight(1000);
    setWeightLeft(1000);
    setLowWeightThreshold(150);
    setShowAddForm(false);
    setEditingSpoolId(null);
  };

  const handleEdit = (spool: FilamentSpool) => {
    setEditingSpoolId(spool.id);
    setName(spool.name);
    setMaterial(spool.material);
    setColorName(spool.colorName);
    setColorHex(spool.colorHex);
    setCost(spool.cost);
    setInitialWeight(spool.initialWeight);
    setWeightLeft(spool.weightLeft);
    setLowWeightThreshold(spool.lowWeightThreshold !== undefined ? spool.lowWeightThreshold : 150);
    setShowAddForm(true);
  };

  const handleQuickAddWeight = (spool: FilamentSpool, grams: number) => {
    const newWeight = Math.max(0, Math.min(spool.initialWeight, spool.weightLeft + grams));
    onUpdateSpool(spool.id, { weightLeft: newWeight });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Filament Inventory</h2>
          <p className="text-xs text-slate-400 font-medium">Monitor physical spools and update remaining weights</p>
        </div>
        <button
          onClick={() => {
            if (showAddForm) resetForm();
            else setShowAddForm(true);
          }}
          className="bg-brand-orange hover:bg-brand-orange/90 text-white py-2 px-4 rounded-xl text-sm font-semibold flex items-center transition-colors shadow-sm"
        >
          {showAddForm ? 'Cancel' : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Spool
            </>
          )}
        </button>
      </div>

      {/* Add / Edit Form Modal/Drawer */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md space-y-4 max-w-xl animate-fadeIn">
          <h3 className="font-bold text-slate-800 text-sm">
            {editingSpoolId ? 'Edit Filament Spool' : 'Add New Filament Spool'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Brand / Filament Name</label>
              <input
                type="text"
                placeholder="e.g. eSUN PLA+"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Material Type</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as FilamentSpool['material'])}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              >
                {MATERIALS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Color Name</label>
              <input
                type="text"
                placeholder="e.g. Pine Green"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Spool Purchase Cost (PHP)</label>
              <input
                type="number"
                placeholder="e.g. 800"
                value={cost}
                onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total Spool Weight (g)</label>
              <input
                type="number"
                value={initialWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setInitialWeight(val);
                  if (!editingSpoolId) setWeightLeft(val); // default weight left to match total
                }}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Weight Remaining (g)</label>
              <input
                type="number"
                value={weightLeft}
                onChange={(e) => setWeightLeft(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Low Weight Alert Threshold (g)</label>
              <input
                type="number"
                value={lowWeightThreshold}
                onChange={(e) => setLowWeightThreshold(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Hex Color Preview</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
              />
              <div className="flex-1 flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setColorHex(c.hex);
                      if (!colorName) setColorName(c.name);
                    }}
                    className="w-6 h-6 rounded-full border border-slate-350 shadow-sm relative focus:ring-2 focus:ring-brand-orange"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
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
              className="bg-brand-orange hover:bg-brand-orange/90 text-white py-2 px-4 rounded-lg text-xs font-semibold flex items-center shadow-sm"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {editingSpoolId ? 'Update Spool' : 'Add Spool'}
            </button>
          </div>
        </form>
      )}

      {/* Spools Grid */}
      {spools.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-150 text-center space-y-4">
          <Tag className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <div>
            <h3 className="font-bold text-slate-700">No Spools Tracked</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-sm mx-auto">
              Add your physical 3D printer filament spools here to automatically link them to quotes and deduct weight upon completion.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {spools.map((spool) => {
            const percentRemaining = Math.round((spool.weightLeft / spool.initialWeight) * 100);
            const threshold = spool.lowWeightThreshold !== undefined ? spool.lowWeightThreshold : 150;
            const isLow = spool.weightLeft < threshold;
            const isEmpty = spool.weightLeft <= 0;

            return (
              <div
                key={spool.id}
                className={`bg-white p-5 rounded-2xl border shadow-sm relative group flex flex-col justify-between ${
                  isEmpty ? 'border-red-100 bg-red-50/5' :
                  isLow ? 'border-orange-100 bg-orange-50/5' : 'border-slate-100'
                }`}
              >
                {/* Spool Info Header */}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-5 h-5 rounded-full border border-slate-300/50 shadow-sm"
                        style={{ backgroundColor: spool.colorHex }}
                      />
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{spool.name}</h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{spool.material} • {spool.colorName}</span>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(spool)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                        title="Edit spool"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${spool.name}?`)) onDeleteSpool(spool.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"
                        title="Delete spool"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="mb-4">
                    {isEmpty ? (
                      <span className="inline-flex items-center bg-red-50 text-red-650 text-[9px] px-2 py-0.5 rounded-full font-bold">
                        <ShieldAlert className="w-2.5 h-2.5 mr-1" /> Empty Spool
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center bg-orange-50 text-orange-650 text-[9px] px-2 py-0.5 rounded-full font-bold">
                        <ShieldAlert className="w-2.5 h-2.5 mr-1" /> Low Filament ({spool.weightLeft}g left)
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-brand-orange/10 text-brand-orange text-[9px] px-2 py-0.5 rounded-full font-bold border border-brand-orange/20">
                        Spool Good ({spool.weightLeft}g left)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mt-auto">
                  <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Remaining Weight</span>
                    <span className={isLow ? 'text-orange-600 font-bold' : 'text-slate-800 font-bold'}>
                      {spool.weightLeft}g / {spool.initialWeight}g ({percentRemaining}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isEmpty ? 'bg-red-500' :
                        isLow ? 'bg-orange-500' : 'bg-brand-orange'
                      }`}
                      style={{ width: `${percentRemaining}%` }}
                    />
                  </div>
                  
                  {/* Spool Cost tag */}
                  <div className="pt-2 flex justify-between items-center text-[10px] text-slate-450 border-t border-slate-50 mt-2">
                    <span>Buy Cost: ₱{spool.cost.toFixed(2)}</span>
                    <span className="font-semibold text-slate-600">Unit: ₱{(spool.cost / spool.initialWeight).toFixed(2)}/g</span>
                  </div>

                  {/* Quick Adjust Buttons */}
                  <div className="pt-3 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleQuickAddWeight(spool, -50)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 py-1 rounded text-[9px] font-bold"
                    >
                      -50g
                    </button>
                    <button
                      onClick={() => handleQuickAddWeight(spool, -10)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 py-1 rounded text-[9px] font-bold"
                    >
                      -10g
                    </button>
                    <button
                      onClick={() => handleQuickAddWeight(spool, 100)}
                      className="bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/30 text-brand-orange py-1 rounded text-[9px] font-bold"
                    >
                      +100g Refill
                    </button>
                  </div>

                  {/* Reorder Spool Links */}
                  {isLow && (
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-orange-655">Reorder:</span>
                      <div className="flex space-x-1">
                        <a
                          href={`https://shopee.ph/search?keyword=${encodeURIComponent(spool.name + ' ' + spool.material + ' filament')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded font-bold transition-all shadow-xs flex items-center"
                        >
                          Shopee
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 shrink-0" />
                        </a>
                        <a
                          href={`https://www.lazada.com.ph/catalog/?q=${encodeURIComponent(spool.name + ' ' + spool.material + ' filament')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-bold transition-all shadow-xs flex items-center"
                        >
                          Lazada
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 shrink-0" />
                        </a>
                        <a
                          href={`https://store.bambulab.com/search?q=${encodeURIComponent(spool.name + ' ' + spool.material + ' filament')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-slate-800 hover:bg-slate-900 text-white px-2 py-1 rounded font-bold transition-all shadow-xs flex items-center"
                        >
                          Bambu
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 shrink-0" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filament Deduction Log */}
      {logs && logs.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-8 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm flex items-center">
              <Clock className="w-4 h-4 mr-2 text-brand-orange" />
              Filament Ledger &amp; Usage Logs
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">Total Entries: {logs.length}</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 bg-slate-50/20 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-800">{log.spoolName}</span>
                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold ${
                      log.type === 'deduction' ? 'bg-blue-50 text-blue-600' :
                      log.type === 'waste' ? 'bg-red-50 text-red-650' : 'bg-brand-orange/10 text-brand-orange'
                    }`}>
                      {log.type === 'deduction' ? 'Deduction' : log.type === 'waste' ? 'Waste' : 'Refill'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-450 font-semibold">
                    Job: <span className="text-slate-700">{log.jobTitle}</span> • {log.date}
                  </div>
                </div>
                <div className="text-right font-black text-xs text-slate-750">
                  <span className={log.type === 'waste' ? 'text-red-500' : log.type === 'deduction' ? 'text-slate-650' : 'text-brand-orange'}>
                    {log.type === 'refill' ? '+' : '-'}{log.grams}g
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
