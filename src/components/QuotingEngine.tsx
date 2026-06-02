import { useState, useRef, useEffect } from 'react';
import { Download, Copy, Plus, Calculator, Settings, Check, Image, RefreshCw, FileText } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { ParsedMetadata } from '../utils/parser';

export interface QuotingVariables {
  pricePerGram: number;     // e.g. 3 PHP
  pricePerHour: number;     // e.g. 50 PHP
  serviceFeePercent: number; // e.g. 5%
  flatMarkup: number;       // e.g. 50 PHP
  currencySymbol: string;   // e.g. ₱
}

import { FilamentSpool } from './FilamentInventory';
import { Customer } from './CustomerManager';

interface QuotingEngineProps {
  parsedFile: ParsedMetadata | null;
  spools: FilamentSpool[];
  customers?: Customer[];
  onAddJob: (job: {
    title: string;
    client: string;
    weight: number;
    printTimeMinutes: number;
    price: number;
    filename: string;
    status: 'Pending Quote' | 'Awaiting Approval' | 'Printing' | 'Ready for Pickup' | 'Completed';
    spoolId?: string;
  }) => void;
  savedVariables?: QuotingVariables;
  onSaveVariables?: (vars: QuotingVariables) => void;
}

export default function QuotingEngine({ parsedFile, spools, customers = [], onAddJob, savedVariables, onSaveVariables }: QuotingEngineProps) {
  // State for pricing variables
  const [vars, setVars] = useState<QuotingVariables>({
    pricePerGram: 3.0,
    pricePerHour: 50.0,
    serviceFeePercent: 5.0,
    flatMarkup: 0.0,
    currencySymbol: '₱',
  });

  // State for input overrides (for manual adjustments or if no file is parsed)
  const [jobTitle, setJobTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [weight, setWeight] = useState<number>(0);
  const [timeHours, setTimeHours] = useState<number>(0);
  const [timeMins, setTimeMins] = useState<number>(0);
  const [quoteId, setQuoteId] = useState('');
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>('');
  
  // Exporter statuses
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showConfig, setShowConfig] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Sync state when pricing variables load or save
  useEffect(() => {
    if (savedVariables) {
      setVars(savedVariables);
    }
  }, [savedVariables]);

  // Auto-detect matching spool when file is parsed
  useEffect(() => {
    if (parsedFile) {
      // Clean filename for job title
      const cleanTitle = parsedFile.filename
        .replace(/\.gcode(\.3mf)?$/i, '')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      setJobTitle(cleanTitle);
      setWeight(parsedFile.filamentWeightGrams);
      
      const hours = Math.floor(parsedFile.printTimeMinutes / 60);
      const mins = parsedFile.printTimeMinutes % 60;
      setTimeHours(hours);
      setTimeMins(mins);
      
      // Generate a random quote ID
      const randId = 'Q-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setQuoteId(randId);

      // Auto select a spool matching the material
      const matchingSpool = spools.find(
        (s) => s.weightLeft >= parsedFile.filamentWeightGrams && 
        (parsedFile.filename.toUpperCase().includes(s.material) || s.material === 'PLA')
      );
      if (matchingSpool) {
        setSelectedSpoolId(matchingSpool.id);
      } else if (spools.length > 0) {
        setSelectedSpoolId(spools[0].id);
      } else {
        setSelectedSpoolId('');
      }
    } else {
      setJobTitle('');
      setWeight(0);
      setTimeHours(0);
      setTimeMins(0);
      setQuoteId('Q-' + Math.random().toString(36).substring(2, 8).toUpperCase());
      
      if (spools.length > 0) {
        setSelectedSpoolId(spools[0].id);
      } else {
        setSelectedSpoolId('');
      }
    }
  }, [parsedFile, spools]);

  // Set first spool if none is selected
  useEffect(() => {
    if (!selectedSpoolId && spools.length > 0) {
      setSelectedSpoolId(spools[0].id);
    }
  }, [spools, selectedSpoolId]);

  // Pricing calculations
  const totalMinutes = timeHours * 60 + timeMins;
  const hoursDecimal = totalMinutes / 60;
  
  const selectedSpool = spools.find(s => s.id === selectedSpoolId);
  const isInsufficient = selectedSpool && selectedSpool.weightLeft < weight;
  
  const filamentCost = weight * vars.pricePerGram;
  const timeCost = hoursDecimal * vars.pricePerHour;
  const subtotal = filamentCost + timeCost;
  const serviceFee = subtotal * (vars.serviceFeePercent / 100);
  const total = subtotal + serviceFee + vars.flatMarkup;

  const handleSaveConfig = () => {
    if (onSaveVariables) {
      onSaveVariables(vars);
    }
    setShowConfig(false);
  };

  // Helper to copy receipt PNG to clipboard
  const handleCopyReceipt = async () => {
    if (!receiptRef.current) return;
    setCopyStatus('loading');
    
    try {
      // Adjust options for clean high-res render
      const blob = await toBlob(receiptRef.current, {
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          borderRadius: '0', // keep square edge for image
        },
        pixelRatio: 2, // Retains high resolution
      });

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } else {
        throw new Error('Image blob generation returned null');
      }
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  // Helper to download receipt PNG
  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    setDownloadStatus('loading');

    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      // Try using modern File System Access API for "Save As..." prompt
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `CCprint_Quote_${quoteId || 'Receipt'}.png`,
            types: [{
              description: 'PNG Image',
              accept: { 'image/png': ['.png'] },
            }],
          });
          const writable = await handle.createWritable();
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          await writable.write(blob);
          await writable.close();
          setDownloadStatus('success');
          setTimeout(() => setDownloadStatus('idle'), 2000);
          return;
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            setDownloadStatus('idle');
            return;
          }
          console.warn('showSaveFilePicker failed or cancelled, falling back to standard download:', pickerErr);
        }
      }

      // Standard fallback (silent download to system Downloads folder)
      const link = document.createElement('a');
      link.download = `CCprint_Quote_${quoteId || 'Receipt'}.png`;
      link.href = dataUrl;
      link.click();
      
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to download image:', err);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus('idle'), 3000);
    }
  };

  const handleAddToBoard = (status: 'Pending Quote' | 'Awaiting Approval' | 'Printing') => {
    if (!jobTitle) {
      alert('Please enter a job title first.');
      return;
    }
    
    onAddJob({
      title: jobTitle,
      client: clientName || 'Walk-in Client',
      weight: weight,
      printTimeMinutes: totalMinutes,
      price: Math.round(total * 100) / 100,
      filename: parsedFile?.filename || `${jobTitle.toLowerCase().replace(/\s+/g, '_')}.gcode`,
      status,
      spoolId: selectedSpoolId || undefined,
    });

    // Reset inputs
    setClientName('');
    // Generate new Quote ID for the next job
    setQuoteId('Q-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    alert(`Job "${jobTitle}" added to Board in column: ${status}`);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Parameters & Calculations Column */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-6 xl:col-span-1">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-brand-orange" />
            Pricing Engine
          </h3>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
            title="Adjust settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {showConfig ? (
          <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100 animate-fadeIn">
            <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Pricing Configuration</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Filament (PHP/g)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={vars.pricePerGram} 
                  onChange={(e) => setVars({ ...vars, pricePerGram: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Print Time (PHP/hr)</label>
                <input 
                  type="number" 
                  value={vars.pricePerHour} 
                  onChange={(e) => setVars({ ...vars, pricePerHour: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Service Fee (%)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={vars.serviceFeePercent} 
                  onChange={(e) => setVars({ ...vars, serviceFeePercent: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Flat Markup (PHP)</label>
                <input 
                  type="number" 
                  value={vars.flatMarkup} 
                  onChange={(e) => setVars({ ...vars, flatMarkup: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange p-2"
                />
              </div>
            </div>
            <button 
              onClick={handleSaveConfig}
              className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Save Variables
            </button>
          </div>
        ) : null}

        {/* Inputs override */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Job/Model Title</label>
            <input 
              type="text" 
              placeholder="e.g. Baby Yoda Planter"
              value={jobTitle} 
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Client Name</label>
            {customers.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={customers.some(c => c.name === clientName) ? clientName : (clientName ? '__NEW__' : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__NEW__') {
                      setClientName('');
                    } else {
                      setClientName(val);
                    }
                  }}
                  className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3 bg-white"
                >
                  <option value="">-- Select Existing Client --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                  <option value="__NEW__">+ Enter a new client name...</option>
                </select>
                {(!clientName || !customers.some(c => c.name === clientName)) && (
                  <input 
                    type="text" 
                    placeholder="Enter new client name..."
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3 animate-slideIn"
                  />
                )}
              </div>
            ) : (
              <input 
                type="text" 
                placeholder="e.g. Juan dela Cruz"
                value={clientName} 
                onChange={(e) => setClientName(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Target Filament Spool</label>
            <select
              value={selectedSpoolId}
              onChange={(e) => setSelectedSpoolId(e.target.value)}
              className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3"
            >
              <option value="">-- No spool selected (use defaults) --</option>
              {spools.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.material} • {s.colorName}) - {s.weightLeft}g remaining
                </option>
              ))}
            </select>
            {isInsufficient && selectedSpool && (
              <span className="block text-[10px] text-red-500 font-bold mt-1.5 animate-pulse bg-red-50 p-1.5 rounded border border-red-100">
                ⚠️ Insufficient filament left (needs {weight}g, only {selectedSpool.weightLeft}g left)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Filament Weight (g)</label>
              <input 
                type="number" 
                value={weight === 0 ? '' : weight} 
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Print Duration</label>
              <div className="flex space-x-1.5 items-center">
                <input 
                  type="number" 
                  value={timeHours === 0 ? '' : timeHours} 
                  onChange={(e) => setTimeHours(parseInt(e.target.value, 10) || 0)}
                  placeholder="H"
                  className="w-1/2 text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-2 text-center"
                />
                <span className="text-slate-400 text-xs">:</span>
                <input 
                  type="number" 
                  value={timeMins === 0 ? '' : timeMins} 
                  onChange={(e) => setTimeMins(parseInt(e.target.value, 10) || 0)}
                  placeholder="M"
                  className="w-1/2 text-sm rounded-lg border-slate-200 focus:ring-brand-orange focus:border-brand-orange py-2 px-2 text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Summary */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Filament ({weight}g)</span>
            <span className="font-medium text-slate-800">{vars.currencySymbol}{filamentCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Printing ({hoursDecimal.toFixed(2)}h)</span>
            <span className="font-medium text-slate-800">{vars.currencySymbol}{timeCost.toFixed(2)}</span>
          </div>
          {vars.serviceFeePercent > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Service Fee ({vars.serviceFeePercent}%)</span>
              <span className="font-medium text-slate-800">{vars.currencySymbol}{serviceFee.toFixed(2)}</span>
            </div>
          )}
          {vars.flatMarkup > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Flat Markup</span>
              <span className="font-medium text-slate-800">{vars.currencySymbol}{vars.flatMarkup.toFixed(2)}</span>
            </div>
          )}
          <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Quote</span>
            <span className="text-2xl font-black text-brand-orange">{vars.currencySymbol}{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Column Add Button */}
        <div className="pt-4 space-y-2 mt-auto">
          <button 
            onClick={() => handleAddToBoard('Awaiting Approval')}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add to Awaiting Approval
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => handleAddToBoard('Pending Quote')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Add as Pending
            </button>
            <button 
              onClick={() => handleAddToBoard('Printing')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Add as Printing
            </button>
          </div>
        </div>
      </div>

      {/* Visual Receipt Card Column */}
      <div className="xl:col-span-2 flex flex-col space-y-6 h-full justify-between">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg flex items-center">
            <Image className="w-5 h-5 mr-2 text-brand-orange" />
            Quotation Receipt Card
          </h3>
          <span className="text-xs text-slate-400 font-medium">Auto-generated card ready for sharing</span>
        </div>

        <div className="flex-1 flex items-center justify-center bg-slate-100 p-6 rounded-2xl border border-slate-200 shadow-inner overflow-hidden">
          {/* RECEIPT WRAPPER FOR HTML-TO-IMAGE */}
          {/* We set absolute sizing for optimal PNG resolution export */}
          <div 
            ref={receiptRef}
            className="w-[380px] bg-white p-6 shadow-xl relative border-t-8 border-brand-orange font-sans text-slate-800 flex flex-col shrink-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Header branding */}
            <div className="text-center pb-4 border-b border-dashed border-slate-200">
              <div className="inline-flex items-center justify-center mb-2">
                <svg viewBox="0 0 96 64" className="w-12 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Left C (Orange) */}
                  <path 
                    d="M 46 16 A 16 16 0 1 0 46 48" 
                    fill="none" 
                    stroke="#FF8025" 
                    strokeWidth="7.5" 
                    strokeLinecap="round"
                  />
                  {/* Right C (Navy) */}
                  <path 
                    d="M 68 16 A 16 16 0 1 0 68 48" 
                    fill="none" 
                    stroke="#003B5C" 
                    strokeWidth="7.5" 
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h4 className="font-black text-lg text-slate-900 tracking-tight">CCprint Quotes</h4>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">3D Printing Service Invoice Proposal</p>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-2 text-[10px] py-4 border-b border-slate-100">
              <div>
                <span className="text-slate-400 block font-medium">QUOTE ID</span>
                <span className="font-bold text-slate-850">{quoteId || 'Q-N/A'}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-medium">DATE</span>
                <span className="font-bold text-slate-850">{new Date().toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
              </div>
              <div className="mt-1 col-span-2">
                <span className="text-slate-400 block font-medium">CLIENT</span>
                <span className="font-bold text-slate-900 text-xs">{clientName || 'Walk-in Client'}</span>
              </div>
            </div>

            {/* Print details */}
            <div className="py-4 space-y-3 border-b border-slate-100">
              <div className="flex items-start">
                <FileText className="w-4 h-4 mr-2 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block font-medium">JOB / MODEL</span>
                  <span className="font-bold text-slate-900 text-xs truncate block">{jobTitle || 'Custom Print Job'}</span>
                  {parsedFile?.filename && (
                    <span className="text-[9px] text-slate-400 truncate block max-w-[200px]">{parsedFile.filename}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <span className="text-slate-400 text-[9px] block font-medium">WEIGHT</span>
                  <span className="font-bold text-slate-800 text-xs">{weight} g</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <span className="text-slate-400 text-[9px] block font-medium">DURATION</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {timeHours}h {timeMins}m
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <span className="text-slate-400 text-[9px] block font-medium">RESOLUTION</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {parsedFile?.layerHeightMm ? parsedFile.layerHeightMm.toFixed(2) : '0.20'} mm
                  </span>
                </div>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="py-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-650">
                <span>Material Cost ({weight}g @ {vars.currencySymbol}{vars.pricePerGram}/g)</span>
                <span className="font-semibold">{vars.currencySymbol}{filamentCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-650">
                <span>Machine Time ({hoursDecimal.toFixed(2)}h @ {vars.currencySymbol}{vars.pricePerHour}/hr)</span>
                <span className="font-semibold">{vars.currencySymbol}{timeCost.toFixed(2)}</span>
              </div>
              {vars.serviceFeePercent > 0 && (
                <div className="flex justify-between items-center text-slate-650">
                  <span>Service fee & prep ({vars.serviceFeePercent}%)</span>
                  <span className="font-semibold">{vars.currencySymbol}{serviceFee.toFixed(2)}</span>
                </div>
              )}
              {vars.flatMarkup > 0 && (
                <div className="flex justify-between items-center text-slate-650">
                  <span>Setup / post-processing</span>
                  <span className="font-semibold">{vars.currencySymbol}{vars.flatMarkup.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Cost Breakdown Progress Bar */}
            <div className="py-3 border-t border-slate-100 space-y-1.5">
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Cost breakdown ratio</span>
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
                {filamentCost > 0 && (
                  <div 
                    className="bg-brand-orange h-full" 
                    style={{ width: `${(filamentCost / (total > 0 ? total : 1)) * 100}%` }}
                  />
                )}
                {timeCost > 0 && (
                  <div 
                    className="bg-blue-500 h-full" 
                    style={{ width: `${(timeCost / (total > 0 ? total : 1)) * 100}%` }}
                  />
                )}
                {(serviceFee + vars.flatMarkup) > 0 && (
                  <div 
                    className="bg-amber-500 h-full" 
                    style={{ width: `${((serviceFee + vars.flatMarkup) / (total > 0 ? total : 1)) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between items-center text-[8px] text-slate-450 font-bold">
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-brand-orange mr-1" />Material ({((filamentCost / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />Machine ({((timeCost / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />Service ({(((serviceFee + vars.flatMarkup) / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* Footer Total */}
            <div className="pt-4 border-t-2 border-dashed border-slate-200 mt-auto flex justify-between items-center">
              <div>
                <span className="text-slate-400 text-[9px] block font-bold uppercase tracking-wider">Estimated Total</span>
                <span className="text-slate-400 text-[8px] block italic leading-tight">Subject to final slicing parameters</span>
              </div>
              <span className="text-2xl font-black text-brand-orange">{vars.currencySymbol}{total.toFixed(2)}</span>
            </div>
            
            {/* Tiny brand stamp */}
            <div className="text-center pt-4 text-[8px] text-slate-350 select-none">
              Generated via CCprint Dashboard • local-first quote compiler
            </div>
          </div>
        </div>

        {/* Buttons for copying / downloading */}
        <div className="flex space-x-3 mt-4">
          <button
            onClick={handleCopyReceipt}
            disabled={copyStatus === 'loading'}
            className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center transition-all shadow-sm"
          >
            {copyStatus === 'loading' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            {copyStatus === 'idle' && <Copy className="w-4 h-4 mr-2" />}
            {copyStatus === 'success' && <Check className="w-4 h-4 mr-2 text-emerald-400" />}
            {copyStatus === 'error' && <RefreshCw className="w-4 h-4 mr-2 text-red-400" />}
            {copyStatus === 'loading' ? 'Rendering...' : copyStatus === 'success' ? 'Copied to Clipboard!' : copyStatus === 'error' ? 'Copy Failed (Try Download)' : 'Copy Receipt Image'}
          </button>
          
          <button
            onClick={handleDownloadReceipt}
            disabled={downloadStatus === 'loading'}
            className="bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 py-3 px-6 rounded-xl text-sm font-bold flex items-center transition-all shadow-sm"
          >
            {downloadStatus === 'loading' ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : downloadStatus === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloadStatus === 'loading' ? 'Generating...' : downloadStatus === 'success' ? 'Saved!' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
