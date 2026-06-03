import React, { useRef, useState } from 'react';
import { Check, FileText, Briefcase, FileSignature, Tag, Cpu, RefreshCw, Plus } from 'lucide-react';
import { parsePrintFile } from '../utils/parser';
import { useJobStore } from '../stores/useJobStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { useToastStore } from '../stores/useToastStore';
import type { ParsedMetadata } from '../utils/parser';
import PlateSelector from '../components/PlateSelector';
import { normalizeFilename, getStringSimilarity } from '../utils/api';


interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { jobs, parsedFile, isParsing, dragActive, addJob, updateJobStatus, setParsedFile, setIsParsing, setDragActive } = useJobStore();
  const { printers, activePrinterSerial, telemetryMap, connectionStatusMap } = usePrinterStore();
  const { pricingVars } = useSettingsStore();
  const { spools } = useFilamentStore();
  const { addToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-plate support state
  const [multiPlates, setMultiPlates] = useState<ParsedMetadata[]>([]);
  const [showPlateSelector, setShowPlateSelector] = useState(false);

  // Computed values
  const activeJobsCount = jobs.filter(j => j.status !== 'Completed').length;
  const onlinePrintersCount = printers.filter(p => connectionStatusMap[p.serial] === 'online').length;
  const totalFilamentStock = Math.round(spools.reduce((sum, s) => sum + s.weightLeft, 0));
  const awaitingApprovalCount = jobs.filter(j => j.status === 'Awaiting Approval').length;
  const printingJobs = jobs.filter(j => j.status === 'Printing');

  // Active printer telemetry
  const activePrinterObj = printers.find(p => p.serial === activePrinterSerial);
  const activeTelemetry = activePrinterSerial ? telemetryMap[activePrinterSerial] : null;
  const printState = activeTelemetry?.print;
  const isPrinting = printState?.gcode_state === 'RUNNING';
  const printPercent = printState?.mc_percent !== undefined ? printState.mc_percent : 0;
  const printRemaining = printState?.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;
  const nozzleTemp = printState?.nozzle_temper || 0;
  const nozzleTarget = printState?.nozzle_target_temper || 0;
  const bedTemp = printState?.bed_temper || 0;
  const bedTarget = printState?.bed_target_temper || 0;
  const activePrinterStatus = activePrinterSerial ? (connectionStatusMap[activePrinterSerial] || 'offline') : 'offline';

  const processUploadedFile = async (file: File) => {
    setIsParsing(true);
    setParsedFile(null);
    addToast(`Parsing print file "${file.name}"...`, 'info');
    try {
      const plates = await parsePrintFile(file);
      if (plates.length === 1) {
        setParsedFile(plates[0]);
        addToast(`Successfully parsed "${file.name}"`, 'success');
      } else if (plates.length > 1) {
        setMultiPlates(plates);
        setShowPlateSelector(true);
        addToast(`Parsed ${plates.length} plates. Please select which to import.`, 'info');
      }
    } catch (err: any) {
      addToast(`Parsing Error: ${err.message || 'The file could not be parsed.'}`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePlateSelectorConfirm = (selectedPlates: ParsedMetadata[]) => {
    setShowPlateSelector(false);
    if (selectedPlates.length === 0) return;
    
    if (selectedPlates.length === 1) {
      setParsedFile(selectedPlates[0]);
      addToast(`Selected "${selectedPlates[0].filename}" for quoting.`, 'success');
    } else {
      // Add all to Kanban board directly
      selectedPlates.forEach((plate) => {
        addJob({
          title: plate.filename.replace(/\.gcode(\.3mf)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          client: 'Walk-in Client',
          weight: plate.filamentWeightGrams,
          printTimeMinutes: plate.printTimeMinutes,
          price: Math.round((plate.filamentWeightGrams * pricingVars.pricePerGram + (plate.printTimeMinutes / 60) * pricingVars.pricePerHour) * (1 + pricingVars.serviceFeePercent / 100) + pricingVars.flatMarkup),
          filename: plate.filename,
          status: 'Pending Quote',
          plateIndex: plate.plateIndex,
          plateName: plate.plateName,
        });
      });
      addToast(`Successfully added ${selectedPlates.length} plate jobs to board.`, 'success');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processUploadedFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processUploadedFile(e.target.files[0]);
  };

  return (
    <div className="space-y-6">
      {/* Active Printer Live Monitor Banner */}
      {activePrinterSerial && activePrinterStatus === 'online' && isPrinting && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700/50 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 animate-slideIn">
          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Live Printer Telemetry Stream</span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-300 font-bold">{activePrinterObj?.name}</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight truncate max-w-lg">{printState?.subtask_name || 'Active Print Job'}</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">
                Est. Remaining time: <span className="text-white font-black">{printRemaining} mins</span> ({Math.round(printRemaining / 6 * 10) / 100} hrs)
              </p>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>COMPLETION RATE</span>
                <span className="text-white font-black text-xs">{printPercent}%</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden border border-slate-650/30">
                <div className="bg-brand-orange h-full rounded-full transition-all duration-1000" style={{ width: `${printPercent}%` }} />
              </div>
            </div>
          </div>
          <div className="flex space-x-4 shrink-0 w-full md:w-auto justify-end">
            <div className="bg-slate-800/80 border border-slate-700/40 p-4 rounded-xl text-center w-28 shadow-inner">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Nozzle temp</span>
              <span className="text-sm font-black text-red-400 mt-1 block">{Math.round(nozzleTemp)}°C</span>
              <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Target: {nozzleTarget}°C</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/40 p-4 rounded-xl text-center w-28 shadow-inner">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Heated bed</span>
              <span className="text-sm font-black text-amber-400 mt-1 block">{Math.round(bedTemp)}°C</span>
              <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Target: {bedTarget}°C</span>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slideIn">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-brand-orange/10 rounded-xl text-brand-orange"><Briefcase className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Active Jobs</span>
            <span className="text-xl font-black text-slate-800">{activeJobsCount}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Cpu className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Online Printers</span>
            <span className="text-xl font-black text-slate-800">{onlinePrintersCount} / {printers.length}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><Tag className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Filament Stock</span>
            <span className="text-xl font-black text-slate-800">{totalFilamentStock} g</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500"><FileSignature className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Awaiting Approval</span>
            <span className="text-xl font-black text-slate-800">{awaitingApprovalCount}</span>
          </div>
        </div>
      </div>

      {/* Parser Dropzone + Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full lg:col-span-1 min-h-[300px]">
          <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center">
            <svg className="w-4 h-4 mr-2 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            New Print File
          </h3>
          <div
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 space-y-4 cursor-pointer transition-all duration-200 ${
              dragActive ? 'border-brand-orange bg-brand-orange/5' : 'border-slate-200 hover:border-brand-orange/50 hover:bg-slate-50/50'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".gcode,.3mf" onChange={handleFileChange} className="hidden" />
            {isParsing ? (
              <div className="flex flex-col items-center space-y-3">
                <RefreshCw className="w-10 h-10 text-brand-orange animate-spin" />
                <p className="text-xs font-bold text-slate-650">Decompressing &amp; parsing...</p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                <p className="text-xs text-center text-slate-550 leading-relaxed font-semibold">
                  Drag &amp; drop .gcode or .3mf<br/>
                  <span className="text-slate-400 font-medium">or click to browse</span>
                </p>
              </>
            )}
            <p className="text-[10px] text-slate-400 font-medium pt-2">Supports Sliced Bambu / Orca Files</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full lg:col-span-3">
          {parsedFile ? (
            <div className="h-full flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-slate-800 truncate pr-2 text-base">{parsedFile.filename}</h3>
                <span className="bg-brand-orange/10 text-brand-orange text-[10px] px-3 py-1 rounded-full font-bold flex items-center shrink-0">
                  <Check className="w-3 h-3 mr-1" /> Metadata Extracted
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-center">
                <div className="aspect-video md:aspect-square bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center p-4 border border-slate-100 shadow-inner relative max-h-[220px]">
                  {parsedFile.thumbnailUrl ? (
                    <img alt="Print Preview" className="object-contain w-full h-full drop-shadow-md transform scale-110 hover:scale-125 transition-transform duration-300" src={parsedFile.thumbnailUrl} />
                  ) : (
                    <div className="text-center space-y-2 text-slate-350 p-6">
                      <FileText className="w-12 h-12 mx-auto stroke-1" />
                      <span className="text-xs block font-bold">No Embedded Preview</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs text-slate-650">
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Filament Weight</span><span className="text-slate-800 font-black text-sm">{parsedFile.filamentWeightGrams} g</span></div>
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Est. Printing Time</span><span className="text-slate-800 font-black text-sm">{parsedFile.printTimeString}</span></div>
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Layer Height</span><span className="text-slate-800 font-black text-sm">{parsedFile.layerHeightMm.toFixed(2)} mm</span></div>
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Color/Slot swaps</span><span className="text-slate-800 font-black text-sm">{parsedFile.filamentChanges} swaps</span></div>
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Raw File Size</span><span className="text-slate-800 font-black text-sm">{parsedFile.fileSize} MB</span></div>
                    <div><span className="text-slate-400 text-[10px] block font-bold leading-tight uppercase">Parsed On</span><span className="text-slate-850 font-bold">{parsedFile.modifiedDate}</span></div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <button onClick={() => onNavigate('quotes')} className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center transition-all shadow-sm">
                      <FileSignature className="w-3.5 h-3.5 mr-1.5" /> Configure Quote
                    </button>
                    <button
                      onClick={() => {
                        addJob({
                          title: parsedFile.filename.replace(/\.gcode(\.3mf)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                          client: 'Walk-in Client', weight: parsedFile.filamentWeightGrams,
                          printTimeMinutes: parsedFile.printTimeMinutes,
                          price: Math.round((parsedFile.filamentWeightGrams * pricingVars.pricePerGram + (parsedFile.printTimeMinutes / 60) * pricingVars.pricePerHour) * 1.05 * 100) / 100,
                          filename: parsedFile.filename, status: 'Pending Quote',
                        });
                      }}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Quick Add to Board
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-xl space-y-3">
              <FileText className="w-12 h-12 text-slate-200" />
              <div>
                <h4 className="font-bold text-slate-700">Awaiting File Drop</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                  Once you tweak settings in Bambu Studio, export your plate file and drag it here to instantly compute your service quote.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Live Printing Status */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Cpu className="w-5 h-5 mr-2 text-brand-orange" /> Live Printing Status
        </h3>
        {printingJobs.length > 0 ? (
          <div className="divide-y divide-slate-150">
            {printingJobs.map((job) => {
              const matchingPrinter = printers.find(p => {
                const tele = telemetryMap[p.serial];
                if (!tele || !tele.print) return false;
                const activeFile = tele.print.subtask_name || '';
                if (job.printerSerial && job.printerSerial === p.serial) {
                  return true;
                }
                if (job.printerSerial && job.printerSerial !== p.serial) {
                  return false;
                }
                return getStringSimilarity(job.filename, activeFile) >= 0.6;
              });
              const progress = job.progress !== undefined ? job.progress : 0;
              const remaining = job.remainingTimeMinutes !== undefined ? job.remainingTimeMinutes : 0;
              return (
                <div key={job.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{job.title}</h4>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      File: <span className="font-medium text-slate-650">{job.filename}</span>
                      {matchingPrinter && (<><span className="mx-2 text-slate-300">•</span>Printer: <span className="font-semibold text-brand-orange">{matchingPrinter.name}</span></>)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0 w-full md:w-auto">
                    <div className="w-full md:w-64 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>{remaining > 0 ? `${remaining} mins left` : 'Warming up...'}</span>
                        <span className="text-slate-850 font-extrabold">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                        <div className="bg-brand-orange h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <button
                      onClick={() => updateJobStatus(job.id, 'Ready for Pickup')}
                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 p-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center justify-center h-8 w-8"
                      title="Force Mark Print Completed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            No active print jobs are running currently. Start a simulation in the Job Board or connect your printer.
          </div>
        )}
      </div>

      <PlateSelector
        isOpen={showPlateSelector}
        plates={multiPlates}
        onConfirm={handlePlateSelectorConfirm}
        onCancel={() => setShowPlateSelector(false)}
      />
    </div>
  );
}
