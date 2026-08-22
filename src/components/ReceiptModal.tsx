import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Download, Copy, Check, RefreshCw, FileText, Edit3, RotateCcw, 
  Save, Sparkles, DollarSign, User, 
  Scale, ChevronDown, ChevronUp, Tag
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { useCustomerStore } from '../stores/useCustomerStore';
import { useJobStore } from '../stores/useJobStore';
import { useToastStore } from '../stores/useToastStore';

export interface ReceiptJobData {
  id: string;
  title: string;
  client: string;
  weight: number;
  printTimeMinutes: number;
  price: number;
  filename: string;
  dateCreated?: string;
  spoolId?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: ReceiptJobData | null;
}

export default function ReceiptModal({ isOpen, onClose, job }: ReceiptModalProps) {
  const { pricingVars, shopName } = useSettingsStore();
  const { spools } = useFilamentStore();
  const { customers } = useCustomerStore();
  const { jobs, updateJob } = useJobStore();
  const { addToast } = useToastStore();

  // Export statuses
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // View tabs on mobile
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('preview');

  // Accordion toggles in editor
  const [showBrandingOptions, setShowBrandingOptions] = useState(false);

  // Editable Form State
  const [quoteId, setQuoteId] = useState('');
  const [date, setDate] = useState('');
  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [filename, setFilename] = useState('');
  const [weight, setWeight] = useState<number>(0);
  const [timeHours, setTimeHours] = useState<number>(0);
  const [timeMins, setTimeMins] = useState<number>(0);
  const [spoolId, setSpoolId] = useState<string>('');
  
  // Pricing variables state (per-receipt overrides)
  const [currencySymbol, setCurrencySymbol] = useState('₱');
  const [pricePerGram, setPricePerGram] = useState<number>(3.0);
  const [pricePerHour, setPricePerHour] = useState<number>(50.0);
  const [serviceFeePercent, setServiceFeePercent] = useState<number>(5.0);
  const [flatMarkup, setFlatMarkup] = useState<number>(0.0);
  
  // Manual Total Override
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState<number>(0);

  // Custom text branding overrides
  const [shopTitle, setShopTitle] = useState('CCprint Quotes');
  const [subHeader, setSubHeader] = useState('3D Printing Service Invoice Proposal');
  const [customNote, setCustomNote] = useState('Subject to final slicing parameters');

  const receiptRef = useRef<HTMLDivElement>(null);

  // Initialize/reset form state when job or isOpen changes
  useEffect(() => {
    if (job && isOpen) {
      const qId = `Q-${(job.id || Math.random().toString(36).substring(2, 8)).substring(0, 6).toUpperCase()}`;
      setQuoteId(qId);

      const d = job.dateCreated 
        ? new Date(job.dateCreated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      setDate(d);

      setClient(job.client || 'Walk-in Client');
      setTitle(job.title || 'Custom Print Job');
      setFilename(job.filename || '');
      setWeight(job.weight || 0);

      const minsTotal = job.printTimeMinutes || 0;
      setTimeHours(Math.floor(minsTotal / 60));
      setTimeMins(minsTotal % 60);

      // Spool assignment
      if (job.spoolId) {
        setSpoolId(job.spoolId);
      } else if (spools.length > 0) {
        const matchingSpool = spools.find(s => s.material === 'PLA') || spools[0];
        setSpoolId(matchingSpool.id);
      } else {
        setSpoolId('');
      }

      // Pricing defaults from settings
      const curr = pricingVars?.currencySymbol || '₱';
      const pGram = pricingVars?.pricePerGram ?? 3.0;
      const pHour = pricingVars?.pricePerHour ?? 50.0;
      const sFee = pricingVars?.serviceFeePercent ?? 5.0;
      const fMarkup = pricingVars?.flatMarkup ?? 0.0;

      setCurrencySymbol(curr);
      setPricePerGram(pGram);
      setPricePerHour(pHour);
      setServiceFeePercent(sFee);
      setFlatMarkup(fMarkup);

      // Check if job price was customized
      const hoursDec = minsTotal / 60;
      const calcTotal = Math.round(((job.weight * pGram) + (hoursDec * pHour)) * (1 + sFee / 100) + fMarkup);
      if (job.price > 0 && Math.abs(job.price - calcTotal) > 2) {
        setIsManualPrice(true);
        setManualPrice(job.price);
      } else {
        setIsManualPrice(false);
        setManualPrice(job.price || calcTotal);
      }

      setShopTitle(shopName || 'CCprint Quotes');
      setSubHeader('3D Printing Service Invoice Proposal');
      setCustomNote('Subject to final slicing parameters');
      setMobileTab('preview');
    }
  }, [job, isOpen, pricingVars, shopName, spools]);

  if (!isOpen || !job) return null;

  // Check if job exists in the active Kanban board store
  const isBoardJob = jobs.some(j => j.id === job.id);

  // Dynamic calculations
  const totalMinutes = (Number(timeHours) || 0) * 60 + (Number(timeMins) || 0);
  const hoursDecimal = totalMinutes / 60;
  const currentWeight = Number(weight) || 0;
  const currentPricePerGram = Number(pricePerGram) || 0;
  const currentPricePerHour = Number(pricePerHour) || 0;
  const currentServiceFeePercent = Number(serviceFeePercent) || 0;
  const currentFlatMarkup = Number(flatMarkup) || 0;

  const filamentCost = currentWeight * currentPricePerGram;
  const timeCost = hoursDecimal * currentPricePerHour;
  const subtotal = filamentCost + timeCost;
  const serviceFee = subtotal * (currentServiceFeePercent / 100);
  const formulaTotal = subtotal + serviceFee + currentFlatMarkup;

  const effectiveTotal = isManualPrice ? (Number(manualPrice) || 0) : formulaTotal;

  // Spool name
  const selectedSpool = spools.find(s => s.id === spoolId);
  const spoolDisplayName = selectedSpool 
    ? `${selectedSpool.name} (${selectedSpool.material})` 
    : 'Default Spool (PLA)';

  // Ratio calculations for cost breakdown bar
  const baseTotal = effectiveTotal > 0 ? effectiveTotal : (formulaTotal > 0 ? formulaTotal : 1);
  const materialRatio = Math.min(100, Math.max(0, (filamentCost / baseTotal) * 100));
  const machineRatio = Math.min(100 - materialRatio, Math.max(0, (timeCost / baseTotal) * 100));
  const serviceRatio = Math.min(100 - materialRatio - machineRatio, Math.max(0, ((serviceFee + currentFlatMarkup) / baseTotal) * 100));

  // Reset to initial original values
  const handleResetToOriginal = () => {
    if (!job) return;
    const qId = `Q-${(job.id || Math.random().toString(36).substring(2, 8)).substring(0, 6).toUpperCase()}`;
    setQuoteId(qId);
    setDate(job.dateCreated 
      ? new Date(job.dateCreated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
    setClient(job.client || 'Walk-in Client');
    setTitle(job.title || 'Custom Print Job');
    setFilename(job.filename || '');
    setWeight(job.weight || 0);

    const minsTotal = job.printTimeMinutes || 0;
    setTimeHours(Math.floor(minsTotal / 60));
    setTimeMins(minsTotal % 60);

    setSpoolId(job.spoolId || (spools[0]?.id || ''));
    setCurrencySymbol(pricingVars?.currencySymbol || '₱');
    setPricePerGram(pricingVars?.pricePerGram ?? 3.0);
    setPricePerHour(pricingVars?.pricePerHour ?? 50.0);
    setServiceFeePercent(pricingVars?.serviceFeePercent ?? 5.0);
    setFlatMarkup(pricingVars?.flatMarkup ?? 0.0);
    setIsManualPrice(false);
    setManualPrice(job.price || 0);
    setShopTitle(shopName || 'CCprint Quotes');
    setSubHeader('3D Printing Service Invoice Proposal');
    setCustomNote('Subject to final slicing parameters');
    addToast('Reset receipt details to original specifications.', 'info');
  };

  // Save changes to active job card
  const handleSaveToJob = async () => {
    if (!job.id || !isBoardJob) return;
    setSaveStatus('loading');
    try {
      await updateJob(job.id, {
        title,
        client,
        weight: currentWeight,
        printTimeMinutes: totalMinutes,
        price: Math.round(effectiveTotal * 100) / 100,
        spoolId: spoolId || undefined,
        filename,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Failed to save edited receipt to job:", e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Helper to copy receipt PNG to clipboard
  const handleCopyReceipt = async () => {
    if (!receiptRef.current) return;
    setCopyStatus('loading');
    
    try {
      const blob = await toBlob(receiptRef.current, {
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          borderRadius: '0',
        },
        pixelRatio: 2,
      });

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        setCopyStatus('success');
        addToast('Receipt image copied to clipboard!', 'success');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } else {
        throw new Error('Image blob generation returned null');
      }
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      setCopyStatus('error');
      addToast('Failed to copy image. Please try downloading PNG instead.', 'error');
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
          addToast('Receipt PNG saved successfully!', 'success');
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

      const link = document.createElement('a');
      link.download = `CCprint_Quote_${quoteId || 'Receipt'}.png`;
      link.href = dataUrl;
      link.click();
      
      setDownloadStatus('success');
      addToast('Receipt PNG downloaded!', 'success');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to download image:', err);
      setDownloadStatus('error');
      addToast('Failed to generate PNG image.', 'error');
      setTimeout(() => setDownloadStatus('idle'), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-50 text-brand-orange rounded-xl border border-orange-100/60 shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-800 text-base tracking-tight">
                  Quotation Receipt Studio
                </h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                  <Sparkles className="w-3 h-3 mr-1" /> Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Customize quote details, pricing formulas, and specifications in real-time
              </p>
            </div>
          </div>

          {/* Action Buttons in Header */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetToOriginal}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl text-xs font-bold transition-colors flex items-center shadow-xs"
              title="Reset fields to original values"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Reset
            </button>

            {isBoardJob && (
              <button
                onClick={handleSaveToJob}
                disabled={saveStatus === 'loading'}
                className="px-3.5 py-1.5 bg-brand-navy hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center shadow-sm"
                title="Save edited specs directly to the Kanban job card"
              >
                {saveStatus === 'loading' ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-orange-300" />
                ) : saveStatus === 'success' ? (
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
                )}
                {saveStatus === 'loading' ? 'Saving...' : saveStatus === 'success' ? 'Saved to Job!' : 'Save to Job Card'}
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher (Visible on small screens) */}
        <div className="flex lg:hidden border-b border-slate-200 bg-white">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center ${
              mobileTab === 'editor' ? 'border-brand-orange text-brand-orange bg-orange-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Customize Details
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center ${
              mobileTab === 'preview' ? 'border-brand-orange text-brand-orange bg-orange-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Preview &amp; Export
          </button>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto">
            
            {/* LEFT COLUMN: EDIT CONTROLS */}
            <div className={`lg:col-span-6 xl:col-span-7 space-y-4 ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}>
              
              {/* Card 1: Job & Client Information */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <User className="w-4 h-4 mr-2 text-brand-orange" />
                    Quote &amp; Client Details
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Editable Fields</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Quote ID */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Quote Reference #</label>
                    <div className="flex space-x-1.5">
                      <input 
                        type="text" 
                        value={quoteId}
                        onChange={(e) => setQuoteId(e.target.value)}
                        placeholder="e.g. Q-8A2F1C"
                        className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setQuoteId('Q-' + Math.random().toString(36).substring(2, 8).toUpperCase())}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors shrink-0"
                        title="Generate random quote reference"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Invoice / Quote Date</label>
                    <input 
                      type="text" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      placeholder="e.g. Aug 22, 2026"
                      className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                    />
                  </div>

                  {/* Client Name */}
                  <div className="sm:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-600">Client / Customer Name</label>
                      {customers.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) setClient(e.target.value);
                          }}
                          value=""
                          className="text-[10px] font-semibold text-brand-orange bg-orange-50/60 border border-orange-200 rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="" disabled>Select from Directory</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      placeholder="e.g. Walk-in Client or Acme Corp"
                      className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                    />
                  </div>

                  {/* Job Title */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Job / Model Title</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Custom Mechanical Housing"
                      className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                    />
                  </div>

                  {/* Filename / Subtitle */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Underlying File / Slicer Ref (Optional)</label>
                    <input 
                      type="text" 
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="e.g. housing_plate1.gcode.3mf"
                      className="w-full text-xs font-mono text-slate-600 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Print Specifications & Spool */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <Scale className="w-4 h-4 mr-2 text-blue-500" />
                    Print Specifications &amp; Material
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Live Recalculation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Weight */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Filament Weight (g)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        step="0.1"
                        value={weight || ''}
                        onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                        className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">grams</span>
                    </div>
                  </div>

                  {/* Print Hours */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Print Hours</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        value={timeHours || ''}
                        onChange={(e) => setTimeHours(parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">hrs</span>
                    </div>
                  </div>

                  {/* Print Mins */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Print Minutes</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        max="59"
                        value={timeMins || ''}
                        onChange={(e) => setTimeMins(parseInt(e.target.value) || 0)}
                        className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">mins</span>
                    </div>
                  </div>

                  {/* Spool / Material Selector */}
                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Material / Spool Tag</label>
                    <select
                      value={spoolId}
                      onChange={(e) => setSpoolId(e.target.value)}
                      className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Default Spool (Generic PLA)</option>
                      {spools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} • {s.material} ({s.color}) — {Math.round(s.weightLeft)}g left
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 3: Pricing Rates & Manual Total Override */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Pricing &amp; Cost Breakdown
                    </h4>
                  </div>
                  
                  {/* Manual Total Price Override Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsManualPrice(!isManualPrice)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                      isManualPrice 
                        ? 'bg-amber-500 border-amber-600 text-white shadow-xs' 
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isManualPrice ? 'Manual Price: ON' : 'Formula Mode: ON'}
                  </button>
                </div>

                {isManualPrice ? (
                  <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">Direct Total Price Override</span>
                        <span className="text-[10px] text-amber-700">Type the exact final quote price directly</span>
                      </div>
                      <span className="text-lg font-black text-amber-600">{currencySymbol}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-500">{currencySymbol}</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualPrice || ''}
                        onChange={(e) => setManualPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full text-base font-black pl-8 pr-4 py-2.5 bg-white border border-amber-300 rounded-xl focus:border-brand-orange focus:ring-2 focus:ring-orange-200 outline-none transition-all text-slate-900"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Rate per Gram */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Rate / Gram</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-[11px] font-bold text-slate-400">{currencySymbol}</span>
                        <input 
                          type="number" 
                          min="0"
                          step="0.1"
                          value={pricePerGram || ''}
                          onChange={(e) => setPricePerGram(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Rate per Hour */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Rate / Hour</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-[11px] font-bold text-slate-400">{currencySymbol}</span>
                        <input 
                          type="number" 
                          min="0"
                          step="1"
                          value={pricePerHour || ''}
                          onChange={(e) => setPricePerHour(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Service Fee % */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Service Fee %</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          min="0"
                          step="0.5"
                          value={serviceFeePercent || ''}
                          onChange={(e) => setServiceFeePercent(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">%</span>
                      </div>
                    </div>

                    {/* Flat Markup */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Setup / Markup</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-[11px] font-bold text-slate-400">{currencySymbol}</span>
                        <input 
                          type="number" 
                          min="0"
                          step="5"
                          value={flatMarkup || ''}
                          onChange={(e) => setFlatMarkup(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtotal Preview Badges */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-[10px]">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block font-medium">Material ({currentWeight}g)</span>
                    <span className="font-bold text-slate-800">{currencySymbol}{filamentCost.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block font-medium">Time ({hoursDecimal.toFixed(2)}h)</span>
                    <span className="font-bold text-slate-800">{currencySymbol}{timeCost.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block font-medium">Fees &amp; Markup</span>
                    <span className="font-bold text-slate-800">{currencySymbol}{(serviceFee + currentFlatMarkup).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Custom Branding & Header / Footer Notes (Collapsible) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBrandingOptions(!showBrandingOptions)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left"
                >
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Custom Header &amp; Footer Notes
                    </span>
                  </div>
                  {showBrandingOptions ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showBrandingOptions && (
                  <div className="p-5 border-t border-slate-100 space-y-3.5 bg-slate-50/20">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Receipt Main Title</label>
                      <input 
                        type="text" 
                        value={shopTitle}
                        onChange={(e) => setShopTitle(e.target.value)}
                        placeholder="e.g. CCprint Quotes"
                        className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Subtitle / Purpose</label>
                      <input 
                        type="text" 
                        value={subHeader}
                        onChange={(e) => setSubHeader(e.target.value)}
                        placeholder="e.g. 3D Printing Service Invoice Proposal"
                        className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Footer Disclaimer Note</label>
                      <input 
                        type="text" 
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        placeholder="e.g. Subject to final slicing parameters"
                        className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: HIGH-FIDELITY LIVE RECEIPT PREVIEW */}
            <div className={`lg:col-span-6 xl:col-span-5 flex flex-col items-center space-y-4 ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
              
              <div className="w-full flex items-center justify-between px-1">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-brand-orange" />
                  Live Generated Receipt
                </span>
                <span className="text-[10px] text-slate-400 font-bold">2x Retina Ready</span>
              </div>

              {/* Receipt Preview Canvas Container */}
              <div className="w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-inner overflow-hidden">
                <div 
                  ref={receiptRef}
                  className="w-[380px] bg-white p-6 shadow-xl relative border-t-8 border-brand-orange font-sans text-slate-800 flex flex-col shrink-0 rounded-b-lg"
                  style={{ boxSizing: 'border-box' }}
                >
                  {/* Header branding */}
                  <div className="text-center pb-4 border-b border-dashed border-slate-200">
                    <div className="inline-flex items-center justify-center mb-2">
                      <svg viewBox="0 0 96 64" className="w-12 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path 
                          d="M 46 16 A 16 16 0 1 0 46 48" 
                          fill="none" 
                          stroke="#FF8025" 
                          strokeWidth="7.5" 
                          strokeLinecap="round"
                        />
                        <path 
                          d="M 68 16 A 16 16 0 1 0 68 48" 
                          fill="none" 
                          stroke="#003B5C" 
                          strokeWidth="7.5" 
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <h4 className="font-black text-lg text-slate-900 tracking-tight">{shopTitle || 'CCprint Quotes'}</h4>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{subHeader || '3D Printing Service Invoice Proposal'}</p>
                  </div>

                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] py-4 border-b border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-medium">QUOTE ID</span>
                      <span className="font-bold text-slate-850">{quoteId || 'Q-N/A'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block font-medium">DATE</span>
                      <span className="font-bold text-slate-850">{date || 'Today'}</span>
                    </div>
                    <div className="mt-1 col-span-2">
                      <span className="text-slate-400 block font-medium">CLIENT</span>
                      <span className="font-bold text-slate-900 text-xs truncate block">{client || 'Walk-in Client'}</span>
                    </div>
                  </div>

                  {/* Print details */}
                  <div className="py-4 space-y-3 border-b border-slate-100">
                    <div className="flex items-start">
                      <FileText className="w-4 h-4 mr-2 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 text-[10px] block font-medium">JOB / MODEL</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">{title || 'Custom Print Job'}</span>
                        {filename && (
                          <span className="text-[9px] text-slate-400 truncate block max-w-[280px] font-mono mt-0.5">{filename}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100/50">
                        <span className="text-slate-400 text-[9px] block font-medium">WEIGHT</span>
                        <span className="font-bold text-slate-800 text-xs">{currentWeight} g</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100/50">
                        <span className="text-slate-400 text-[9px] block font-medium">DURATION</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {timeHours}h {timeMins}m
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100/50">
                        <span className="text-slate-400 text-[9px] block font-medium">SPOOL</span>
                        <span className="font-bold text-slate-800 text-[10px] truncate block" title={spoolDisplayName}>
                          {spoolDisplayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price Calculations */}
                  <div className="py-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-650">
                      <span>Material Cost ({currentWeight}g @ {currencySymbol}{currentPricePerGram}/g)</span>
                      <span className="font-semibold">{currencySymbol}{filamentCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-650">
                      <span>Machine Time ({hoursDecimal.toFixed(2)}h @ {currencySymbol}{currentPricePerHour}/hr)</span>
                      <span className="font-semibold">{currencySymbol}{timeCost.toFixed(2)}</span>
                    </div>
                    {currentServiceFeePercent > 0 && (
                      <div className="flex justify-between items-center text-slate-650">
                        <span>Service fee &amp; prep ({currentServiceFeePercent}%)</span>
                        <span className="font-semibold">{currencySymbol}{serviceFee.toFixed(2)}</span>
                      </div>
                    )}
                    {currentFlatMarkup > 0 && (
                      <div className="flex justify-between items-center text-slate-650">
                        <span>Setup / post-processing</span>
                        <span className="font-semibold">{currencySymbol}{currentFlatMarkup.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Cost Breakdown Progress Bar */}
                  <div className="py-3 border-t border-slate-100 space-y-1.5">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Cost breakdown ratio</span>
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
                      {materialRatio > 0 && (
                        <div 
                          className="bg-brand-orange h-full transition-all duration-300" 
                          style={{ width: `${materialRatio}%` }}
                        />
                      )}
                      {machineRatio > 0 && (
                        <div 
                          className="bg-blue-500 h-full transition-all duration-300" 
                          style={{ width: `${machineRatio}%` }}
                        />
                      )}
                      {serviceRatio > 0 && (
                        <div 
                          className="bg-amber-500 h-full transition-all duration-300" 
                          style={{ width: `${serviceRatio}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[8px] text-slate-450 font-bold">
                      <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-brand-orange mr-1" />Material ({materialRatio.toFixed(0)}%)</span>
                      <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />Machine ({machineRatio.toFixed(0)}%)</span>
                      <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />Service ({serviceRatio.toFixed(0)}%)</span>
                    </div>
                  </div>

                  {/* Footer Total */}
                  <div className="pt-4 border-t-2 border-dashed border-slate-200 mt-auto flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 text-[9px] block font-bold uppercase tracking-wider">Estimated Total</span>
                      <span className="text-slate-400 text-[8px] block italic leading-tight">{customNote || 'Subject to final slicing parameters'}</span>
                    </div>
                    <span className="text-2xl font-black text-brand-orange">
                      {currencySymbol}{effectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  {/* Tiny brand stamp */}
                  <div className="text-center pt-4 text-[8px] text-slate-350 select-none">
                    Generated via CCprint Dashboard • local-first quote compiler
                  </div>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="w-full flex space-x-3 pt-1">
                <button
                  onClick={handleCopyReceipt}
                  disabled={copyStatus === 'loading'}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-sm"
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
                  className="bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center transition-all shadow-sm shrink-0"
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
        </div>

      </div>
    </div>
  );
}
