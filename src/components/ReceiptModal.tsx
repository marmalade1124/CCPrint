import React, { useState, useRef } from 'react';
import { X, Download, Copy, Check, RefreshCw, FileText } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useFilamentStore } from '../stores/useFilamentStore';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    title: string;
    client: string;
    weight: number;
    printTimeMinutes: number;
    price: number;
    filename: string;
    dateCreated?: string;
    spoolId?: string;
  } | null;
}

export default function ReceiptModal({ isOpen, onClose, job }: ReceiptModalProps) {
  const { pricingVars } = useSettingsStore();
  const { spools } = useFilamentStore();

  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !job) return null;

  // Pricing calculations based on job specs and pricing variables
  const weight = job.weight;
  const timeHours = Math.floor(job.printTimeMinutes / 60);
  const timeMins = job.printTimeMinutes % 60;
  const hoursDecimal = job.printTimeMinutes / 60;

  const currencySymbol = pricingVars.currencySymbol || '₱';
  const pricePerGram = pricingVars.pricePerGram || 3.0;
  const pricePerHour = pricingVars.pricePerHour || 50.0;
  const serviceFeePercent = pricingVars.serviceFeePercent || 5.0;
  const flatMarkup = pricingVars.flatMarkup || 0.0;

  const filamentCost = weight * pricePerGram;
  const timeCost = hoursDecimal * pricePerHour;
  const subtotal = filamentCost + timeCost;
  const serviceFee = subtotal * (serviceFeePercent / 100);
  
  // Use the job's stored price as the absolute truth, or fallback to calculated if it matches 0
  const total = job.price > 0 ? job.price : (subtotal + serviceFee + flatMarkup);

  const selectedSpool = spools.find(s => s.id === job.spoolId);
  const spoolName = selectedSpool ? `${selectedSpool.name} (${selectedSpool.material})` : 'Default Spool';

  // Generate Quote ID based on job ID (e.g. Q-A1B2C3)
  const quoteId = `Q-${job.id.substring(0, 6).toUpperCase()}`;
  
  const formattedDate = job.dateCreated 
    ? new Date(job.dateCreated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

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

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `CCprint_Quote_${quoteId}.png`,
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

      const link = document.createElement('a');
      link.download = `CCprint_Quote_${quoteId}.png`;
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 relative flex flex-col space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-scaleUp">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base flex items-center">
            <FileText className="w-5 h-5 mr-2 text-brand-orange" />
            Job Quote Receipt
          </h3>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Receipt Card Wrapper */}
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 rounded-xl border border-slate-200/50 overflow-hidden">
          <div 
            ref={receiptRef}
            className="w-[380px] bg-white p-6 shadow-md relative border-t-8 border-brand-orange font-sans text-slate-800 flex flex-col shrink-0"
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
              <h4 className="font-black text-lg text-slate-900 tracking-tight">CCprint Quotes</h4>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">3D Printing Service Invoice Proposal</p>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-2 text-[10px] py-4 border-b border-slate-100">
              <div>
                <span className="text-slate-400 block font-medium">QUOTE ID</span>
                <span className="font-bold text-slate-850">{quoteId}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-medium">DATE</span>
                <span className="font-bold text-slate-850">{formattedDate}</span>
              </div>
              <div className="mt-1 col-span-2">
                <span className="text-slate-400 block font-medium">CLIENT</span>
                <span className="font-bold text-slate-900 text-xs">{job.client || 'Walk-in Client'}</span>
              </div>
            </div>

            {/* Print details */}
            <div className="py-4 space-y-3 border-b border-slate-100">
              <div className="flex items-start">
                <FileText className="w-4 h-4 mr-2 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block font-medium">JOB / MODEL</span>
                  <span className="font-bold text-slate-900 text-xs truncate block">{job.title || 'Custom Print Job'}</span>
                  {job.filename && (
                    <span className="text-[9px] text-slate-400 truncate block max-w-[200px]">{job.filename}</span>
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
                  <span className="text-slate-400 text-[9px] block font-medium">SPOOL</span>
                  <span className="font-bold text-slate-800 text-[10px] truncate block" title={spoolName}>
                    {spoolName}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="py-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-650">
                <span>Material Cost ({weight}g @ {currencySymbol}{pricePerGram}/g)</span>
                <span className="font-semibold">{currencySymbol}{filamentCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-650">
                <span>Machine Time ({hoursDecimal.toFixed(2)}h @ {currencySymbol}{pricePerHour}/hr)</span>
                <span className="font-semibold">{currencySymbol}{timeCost.toFixed(2)}</span>
              </div>
              {serviceFeePercent > 0 && (
                <div className="flex justify-between items-center text-slate-650">
                  <span>Service fee & prep ({serviceFeePercent}%)</span>
                  <span className="font-semibold">{currencySymbol}{serviceFee.toFixed(2)}</span>
                </div>
              )}
              {flatMarkup > 0 && (
                <div className="flex justify-between items-center text-slate-650">
                  <span>Setup / post-processing</span>
                  <span className="font-semibold">{currencySymbol}{flatMarkup.toFixed(2)}</span>
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
                {(serviceFee + flatMarkup) > 0 && (
                  <div 
                    className="bg-amber-500 h-full" 
                    style={{ width: `${((serviceFee + flatMarkup) / (total > 0 ? total : 1)) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between items-center text-[8px] text-slate-450 font-bold">
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-brand-orange mr-1" />Material ({((filamentCost / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />Machine ({((timeCost / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
                <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />Service ({(((serviceFee + flatMarkup) / (total > 0 ? total : 1)) * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* Footer Total */}
            <div className="pt-4 border-t-2 border-dashed border-slate-200 mt-auto flex justify-between items-center">
              <div>
                <span className="text-slate-400 text-[9px] block font-bold uppercase tracking-wider">Estimated Total</span>
                <span className="text-slate-400 text-[8px] block italic leading-tight">Subject to final slicing parameters</span>
              </div>
              <span className="text-2xl font-black text-brand-orange">{currencySymbol}{total.toFixed(2)}</span>
            </div>
            
            {/* Tiny brand stamp */}
            <div className="text-center pt-4 text-[8px] text-slate-350 select-none">
              Generated via CCprint Dashboard • local-first quote compiler
            </div>
          </div>
        </div>

        {/* Buttons for copying / downloading */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleCopyReceipt}
            disabled={copyStatus === 'loading'}
            className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center transition-all shadow-sm"
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
            className="bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center transition-all shadow-sm"
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
