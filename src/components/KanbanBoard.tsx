import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Check, Trash2, Clock, Scale, User, FileText, Calculator, ShieldAlert } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

export interface Job {
  id: string;
  title: string;
  client: string;
  weight: number;
  printTimeMinutes: number;
  price: number;
  filename: string;
  status: 'Pending Quote' | 'Awaiting Approval' | 'Printing' | 'Ready for Pickup' | 'Completed';
  progress?: number; // 0 - 100, live updated from printer
  remainingTimeMinutes?: number; // live updated from printer
  dateCreated: string;
  spoolId?: string;
  filamentDeducted?: boolean;
  plateIndex?: number;
  plateName?: string;
  completedAt?: string;
  printerSerial?: string;
  printerName?: string;
  startedAt?: string;
}

interface KanbanBoardProps {
  jobs: Job[];
  onUpdateJobStatus: (id: string, newStatus: Job['status']) => void;
  onDeleteJob: (id: string) => void;
  onSelectJobForQuote: (job: Job) => void;
  onTriggerPrint: (jobId: string, filename: string) => void;
  onTriggerPrintMock: (filename: string) => void;
  activePrintFilename?: string;
  activePrintProgress?: number;
  activePrintRemaining?: number;
  onMarkFailed?: (jobId: string, failurePercent: number) => void;
}

const COLUMNS: { id: Job['status']; name: string; colorClass: string; borderClass: string; bgLight: string }[] = [
  { id: 'Pending Quote', name: 'Pending Quote', colorClass: 'text-slate-400', borderClass: 'border-slate-100 hover:border-slate-350', bgLight: 'bg-slate-50/50' },
  { id: 'Awaiting Approval', name: 'Awaiting Approval', colorClass: 'text-orange-400', borderClass: 'border-orange-100 hover:border-orange-300', bgLight: 'bg-orange-50/20' },
  { id: 'Printing', name: 'Printing', colorClass: 'text-blue-500', borderClass: 'border-blue-100 hover:border-blue-300', bgLight: 'bg-blue-50/20' },
  { id: 'Ready for Pickup', name: 'Ready for Pickup', colorClass: 'text-emerald-500', borderClass: 'border-emerald-100 hover:border-emerald-300', bgLight: 'bg-emerald-50/20' },
  { id: 'Completed', name: 'Completed', colorClass: 'text-slate-400', borderClass: 'border-slate-100 hover:border-slate-200', bgLight: 'bg-slate-50/30' },
];

export default function KanbanBoard({
  jobs,
  onUpdateJobStatus,
  onDeleteJob,
  onSelectJobForQuote,
  onTriggerPrint,
  onTriggerPrintMock,
  activePrintFilename,
  activePrintProgress,
  activePrintRemaining,
  onMarkFailed,
}: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [isDraggingOverCol, setIsDraggingOverCol] = useState<string | null>(null);
  const [failModalJob, setFailModalJob] = useState<Job | null>(null);
  const [failPercent, setFailPercent] = useState<number>(50);
  const [selectedReceiptJob, setSelectedReceiptJob] = useState<Job | null>(null);

  // Filter jobs based on search query
  const filteredJobs = jobs.filter(
    (job) =>
      (job.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.client || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group jobs by column
  const jobsByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredJobs.filter((job) => job.status === col.id);
    return acc;
  }, {} as Record<Job['status'], Job[]>);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedJobId(id);
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setIsDraggingOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setIsDraggingOverCol(columnId);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Job['status']) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (jobId) {
      onUpdateJobStatus(jobId, targetStatus);
    }
    setDraggedJobId(null);
    setIsDraggingOverCol(null);
  };

  // Format time (e.g. 250 minutes -> 4h 10m)
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Board Header / Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Job Board</h2>
          <p className="text-xs text-slate-400 font-medium">Drag cards to update state or trigger printer tasks</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by title, client, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm border-slate-200 rounded-xl py-2 pl-10 pr-4 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 overflow-x-auto pb-4 custom-scrollbar">
        {COLUMNS.map((col) => {
          const colJobs = jobsByColumn[col.id] || [];
          const isDraggingOver = isDraggingOverCol === col.id;
          
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragLeave={() => setIsDraggingOverCol(null)}
              className={`flex flex-col space-y-4 min-w-[250px] p-3 rounded-2xl transition-all duration-200 ${
                isDraggingOver ? 'bg-emerald-50/40 ring-2 ring-dashed ring-emerald-300' : col.bgLight
              }`}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center px-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    col.id === 'Pending Quote' ? 'bg-slate-400' :
                    col.id === 'Awaiting Approval' ? 'bg-orange-450' :
                    col.id === 'Printing' ? 'bg-blue-500' :
                    col.id === 'Ready for Pickup' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`} />
                  {col.name}
                </h4>
                <span className="text-[11px] font-bold bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-full">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 min-h-[400px] overflow-y-auto custom-scrollbar">
                {colJobs.length === 0 && (
                  <div className="h-28 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-450 italic p-4 text-center">
                    Drag jobs here to transition status
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {colJobs.map((job) => {
                    // Check if this job matches the active print filename for progress injection
                    const isCurrentlyPrinting = 
                      col.id === 'Printing' &&
                      activePrintFilename && 
                      (job.filename.toLowerCase() === activePrintFilename.toLowerCase() ||
                       activePrintFilename.toLowerCase().includes(job.filename.toLowerCase()) ||
                       job.filename.toLowerCase().includes(activePrintFilename.toLowerCase()));

                    const progress = isCurrentlyPrinting ? activePrintProgress : job.progress;
                    const remainingTime = isCurrentlyPrinting ? activePrintRemaining : job.remainingTimeMinutes;

                    return (
                      <motion.div
                        key={job.id}
                        layout
                        layoutId={job.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, layout: { duration: 0.3 } }}
                        whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}
                        draggable
                        onDragStart={(e) => handleDragStart(e as any, job.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white p-4 rounded-xl border shadow-sm relative group cursor-grab active:cursor-grabbing transition-colors ${
                          draggedJobId === job.id ? 'opacity-40' : ''
                        } ${
                          col.id === 'Pending Quote' ? 'border-slate-100 hover:border-slate-300' :
                          col.id === 'Awaiting Approval' ? 'border-orange-100 hover:border-orange-350' :
                          col.id === 'Printing' ? 'border-blue-100 hover:border-blue-350' :
                          col.id === 'Ready for Pickup' ? 'border-emerald-100 hover:border-emerald-350' :
                          'border-slate-100 hover:border-slate-250'
                        }`}
                      >
                        {/* Title and Settings Menu */}
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h5 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight pr-1">
                            {job.title}
                          </h5>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => setSelectedReceiptJob(job)}
                              className="text-slate-350 hover:text-brand-orange p-0.5 rounded transition-colors"
                              title="View Quote Receipt"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteJob(job.id)}
                              className="text-slate-350 hover:text-red-500 p-0.5 rounded transition-colors"
                              title="Delete Job"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Client details */}
                        <div className="flex items-center text-[10px] text-slate-400 mb-3">
                          <User className="w-3 h-3 mr-1 shrink-0" />
                          <span className="font-medium truncate">{job.client}</span>
                        </div>

                        {/* Specs */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                          <div className="flex items-center">
                            <Scale className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                            <span>{job.weight} g</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                            <span>{formatTime(job.printTimeMinutes)}</span>
                          </div>
                        </div>

                        {/* File detail */}
                        <div className="flex items-center text-[9px] text-slate-400 mb-4 bg-slate-50/50 p-1 rounded border border-slate-100 truncate">
                          <FileText className="w-2.5 h-2.5 mr-1 shrink-0 text-slate-400" />
                          <span className="truncate" title={job.filename}>{job.filename}</span>
                        </div>

                        {/* Live progress if printing */}
                        {col.id === 'Printing' && (
                          <div className="space-y-2 mb-3 bg-blue-50/30 p-2 rounded-lg border border-blue-50">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-blue-600 font-bold">Progress</span>
                              <span className="text-blue-700 font-bold">{progress !== undefined ? `${progress}%` : '0%'}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${progress || 0}%` }}
                              />
                            </div>
                            {remainingTime !== undefined && (
                              <div className="text-[9px] text-slate-500 font-medium italic">
                                {remainingTime > 0 ? `${remainingTime} mins remaining` : 'Completing print...'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pricing display */}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400">{job.dateCreated}</span>
                          <span className="font-extrabold text-sm text-slate-800">
                            ₱{job.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>                        {/* Context-aware buttons */}
                        <div className="mt-3 space-y-1.5">
                          {col.id === 'Pending Quote' && (
                            <>
                              <button
                                onClick={() => onSelectJobForQuote(job)}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center"
                              >
                                <Calculator className="w-3.5 h-3.5 mr-1" />
                                Compile Price Quote
                              </button>
                              <button
                                onClick={() => onTriggerPrint(job.id, job.filename)}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center shadow-sm"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Send to Printer
                              </button>
                            </>
                          )}
                          
                          {col.id === 'Awaiting Approval' && (
                            <>
                              <button
                                onClick={() => onTriggerPrint(job.id, job.filename)}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center shadow-sm"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Approve &amp; Send to Print
                              </button>
                              <button
                                onClick={() => onTriggerPrintMock(job.filename)}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1 rounded text-[9px] font-bold transition-colors flex items-center justify-center"
                              >
                                <Play className="w-3 h-3 mr-1 text-slate-450" />
                                Simulate Print Cycle
                              </button>
                            </>
                          )}

                          {col.id === 'Ready for Pickup' && (
                            <button
                              onClick={() => onUpdateJobStatus(job.id, 'Completed')}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Mark Picked Up
                            </button>
                          )}

                          {col.id === 'Printing' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => onUpdateJobStatus(job.id, 'Ready for Pickup')}
                                className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Mark Completed
                              </button>
                              <button
                                onClick={() => {
                                  setFailModalJob(job);
                                  setFailPercent(progress !== undefined ? progress : 50);
                                }}
                                className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center shadow-sm"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                                Mark Failed
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fail Percent Modal */}
      {failModalJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-red-650">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Mark Print as Failed</h3>
                <p className="text-xs text-slate-400 font-medium">Record material waste for "{failModalJob.title}"</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-650 space-y-1">
              <div>Total Filament Weight: <span className="font-bold text-slate-800">{failModalJob.weight} g</span></div>
              <div>Estimated Job Price: <span className="font-bold text-slate-800">₱{failModalJob.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-650">
                <span>Failure Point (Progress)</span>
                <span className="text-red-600 font-black">{failPercent}%</span>
              </div>
              
              <input
                type="range"
                min="0"
                max="100"
                value={failPercent}
                onChange={(e) => setFailPercent(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>0% (Start)</span>
                <span>50% (Midway)</span>
                <span>100% (Completed)</span>
              </div>
            </div>

            <div className="bg-red-50/50 border border-red-100/50 p-3 rounded-lg text-[11px] text-red-700 space-y-1">
              <div className="font-bold">Calculated Waste:</div>
              <div>Estimated Wasted Grams: <span className="font-bold">{(failModalJob.weight * (failPercent / 100)).toFixed(1)} g</span></div>
              <div className="italic text-red-500 mt-1">This will deduct the wasted grams from the spool and move the job back to "Pending Quote" for reprint.</div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setFailModalJob(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-650 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onMarkFailed) {
                    onMarkFailed(failModalJob.id, failPercent);
                  }
                  setFailModalJob(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Confirm Failure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal Recovery */}
      <ReceiptModal 
        isOpen={!!selectedReceiptJob} 
        onClose={() => setSelectedReceiptJob(null)} 
        job={selectedReceiptJob} 
      />
    </div>
  );
}
