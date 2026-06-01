import { create } from 'zustand';
import type { Job } from '../components/KanbanBoard';
import type { FailureRecord } from '../components/AnalyticsDashboard';
import type { ParsedMetadata } from '../utils/parser';
import type { PrintHistoryRecord } from '../types';
import { useFilamentStore } from './useFilamentStore';
import { useToastStore } from './useToastStore';
import { usePrinterStore } from './usePrinterStore';
import { getApiBase, isTauri } from '../utils/api';
import { getDb } from '../lib/database';

const saveJobsToLocal = (jobs: Job[]) => {
  try {
    localStorage.setItem('printflow_jobs', JSON.stringify(jobs));
  } catch (e) {
    console.error("Failed to save jobs to localStorage:", e);
  }
};

const saveFailuresToLocal = (failures: FailureRecord[]) => {
  try {
    localStorage.setItem('printflow_failures', JSON.stringify(failures));
  } catch (e) {
    console.error("Failed to save failures to localStorage:", e);
  }
};

const saveHistoryToLocal = (history: PrintHistoryRecord[]) => {
  try {
    localStorage.setItem('printflow_history', JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save print history to localStorage:", e);
  }
};

interface JobStore {
  jobs: Job[];
  failuresLog: FailureRecord[];
  historyLog: PrintHistoryRecord[];
  parsedFile: ParsedMetadata | null;
  incomingSlicerJob: ParsedMetadata | null;
  isParsing: boolean;
  dragActive: boolean;

  init: () => Promise<void>;
  // Job CRUD
  addJob: (newJob: Omit<Job, 'id' | 'dateCreated'>) => Promise<void>;
  updateJobStatus: (id: string, newStatus: Job['status']) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  setJobs: (jobs: Job[]) => void;

  // Failure management
  failPrint: (jobId: string, failurePercent: number) => Promise<void>;

  // Parser state
  setParsedFile: (file: ParsedMetadata | null) => void;
  setIncomingSlicerJob: (job: ParsedMetadata | null) => void;
  setIsParsing: (v: boolean) => void;
  setDragActive: (v: boolean) => void;

  // Print execution
  triggerPrint: (jobId: string, filename: string) => Promise<void>;

  // Batch update for telemetry sync (updates database and state)
  batchUpdateJobs: (updater: (jobs: Job[]) => Job[]) => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  failuresLog: [],
  historyLog: [],
  parsedFile: null,
  incomingSlicerJob: null,
  isParsing: false,
  dragActive: false,

  init: async () => {
    let jobs: Job[] = [];
    let failuresLog: FailureRecord[] = [];
    let historyLog: PrintHistoryRecord[] = [];
    let loaded = false;

    if (isTauri()) {
      try {
        const db = await getDb();
        const jobRows = await db.select<any[]>("SELECT * FROM jobs ORDER BY date_created DESC");
        const failureRows = await db.select<any[]>("SELECT * FROM failures ORDER BY date DESC");
        const historyRows = await db.select<any[]>("SELECT * FROM print_history ORDER BY completed_at DESC");

        jobs = jobRows.map((r) => ({
          id: r.id,
          title: r.title,
          client: r.client,
          weight: r.weight,
          printTimeMinutes: r.print_time_minutes,
          price: r.price,
          filename: r.filename,
          status: r.status,
          progress: r.progress !== null ? r.progress : undefined,
          remainingTimeMinutes: r.remaining_time_minutes !== null ? r.remaining_time_minutes : undefined,
          dateCreated: r.date_created,
          spoolId: r.spool_id || undefined,
          filamentDeducted: r.filament_deducted === 1,
          plateIndex: r.plate_index !== null ? r.plate_index : undefined,
          plateName: r.plate_name || undefined,
          completedAt: r.completed_at || undefined,
          printerSerial: r.printer_serial || undefined,
          printerName: r.printer_name || undefined,
          startedAt: r.started_at || undefined,
        }));

        failuresLog = failureRows.map((r) => ({
          id: r.id,
          jobTitle: r.job_title,
          client: r.client,
          spoolId: r.spool_id || undefined,
          spoolName: r.spool_name,
          wastedGrams: r.wasted_grams,
          wastedCost: r.wasted_cost,
          wastedTimeMinutes: r.wasted_time_minutes,
          failurePercent: r.failure_percent,
          date: r.date,
        }));

        historyLog = historyRows.map((r) => ({
          id: r.id,
          jobId: r.job_id,
          jobTitle: r.job_title,
          client: r.client,
          filename: r.filename,
          weightGrams: r.weight_grams,
          printTimeMinutes: r.print_time_minutes,
          price: r.price,
          spoolId: r.spool_id || undefined,
          spoolName: r.spool_name || undefined,
          printerSerial: r.printer_serial || undefined,
          printerName: r.printer_name || undefined,
          status: r.status,
          startedAt: r.started_at || undefined,
          completedAt: r.completed_at || undefined,
          plateIndex: r.plate_index !== null ? r.plate_index : undefined,
          plateName: r.plate_name || undefined,
        }));
        if (jobs.length > 0) {
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to initialize JobStore from SQLite, falling back to localStorage:", e);
      }
    }

    if (!loaded) {
      try {
        const storedJobs = localStorage.getItem('printflow_jobs');
        if (storedJobs) {
          jobs = JSON.parse(storedJobs);
        }
        const storedFailures = localStorage.getItem('printflow_failures');
        if (storedFailures) {
          failuresLog = JSON.parse(storedFailures);
        }
        const storedHistory = localStorage.getItem('printflow_history');
        if (storedHistory) {
          historyLog = JSON.parse(storedHistory);
        }

        if (isTauri() && jobs.length > 0) {
          try {
            const db = await getDb();
            for (const finalJob of jobs) {
              await db.execute(
                `INSERT OR REPLACE INTO jobs (
                  id, title, client, weight, print_time_minutes, price, filename, status, 
                  progress, remaining_time_minutes, date_created, spool_id, filament_deducted,
                  plate_index, plate_name, completed_at, printer_serial, printer_name, started_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
                [
                  finalJob.id,
                  finalJob.title,
                  finalJob.client || '',
                  finalJob.weight || 0,
                  finalJob.printTimeMinutes || 0,
                  finalJob.price || 0,
                  finalJob.filename || '',
                  finalJob.status,
                  finalJob.progress !== undefined ? finalJob.progress : null,
                  finalJob.remainingTimeMinutes !== undefined ? finalJob.remainingTimeMinutes : null,
                  finalJob.dateCreated,
                  finalJob.spoolId || null,
                  finalJob.filamentDeducted ? 1 : 0,
                  finalJob.plateIndex !== undefined ? finalJob.plateIndex : null,
                  finalJob.plateName || null,
                  finalJob.completedAt || null,
                  finalJob.printerSerial || null,
                  finalJob.printerName || null,
                  finalJob.startedAt || null,
                ]
              );
            }
            for (const f of failuresLog) {
              await db.execute(
                `INSERT INTO failures (id, job_title, client, spool_id, spool_name, wasted_grams, wasted_cost, wasted_time_minutes, failure_percent, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [f.id, f.jobTitle, f.client || '', f.spoolId || null, f.spoolName, f.wastedGrams, f.wastedCost, f.wastedTimeMinutes, f.failurePercent, f.date]
              );
            }
            for (const h of historyLog) {
              await db.execute(
                `INSERT INTO print_history (
                  id, job_id, job_title, client, filename, weight_grams, print_time_minutes, 
                  price, spool_id, spool_name, printer_serial, printer_name, status, 
                  started_at, completed_at, plate_index, plate_name
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                [h.id, h.jobId, h.jobTitle, h.client, h.filename, h.weightGrams, h.printTimeMinutes, h.price, h.spoolId || null, h.spoolName || null, h.printerSerial || null, h.printerName || null, h.status, h.startedAt || null, h.completedAt || null, h.plateIndex !== undefined ? h.plateIndex : null, h.plateName || null]
              );
            }
          } catch (sqle) {
            console.error("Failed to sync loaded localStorage jobs/history to SQLite:", sqle);
          }
        }
      } catch (e) {
        console.error("Failed to load jobs from localStorage:", e);
      }
    }

    set({ jobs, failuresLog, historyLog });
  },

  addJob: async (newJob) => {
    const { jobs } = get();
    const existingIndex = jobs.findIndex(
      (j) => j.filename && j.filename.toLowerCase() === newJob.filename.toLowerCase()
    );

    let finalJob: Job;

    if (existingIndex !== -1) {
      const updatedJobs = [...jobs];
      finalJob = {
        ...updatedJobs[existingIndex],
        status: newJob.status,
        price: newJob.price,
        weight: newJob.weight,
        printTimeMinutes: newJob.printTimeMinutes,
        plateIndex: newJob.plateIndex,
        plateName: newJob.plateName,
        spoolId: newJob.spoolId,
      };
      updatedJobs[existingIndex] = finalJob;
      set({ jobs: updatedJobs, parsedFile: null });
      saveJobsToLocal(updatedJobs);
      useToastStore.getState().addToast(`Updated status of "${newJob.title}" to: ${newJob.status}`, 'success');
    } else {
      finalJob = {
        ...newJob,
        id: 'job-' + Math.random().toString(36).substring(2, 9),
        dateCreated: new Date().toLocaleDateString(),
      };
      const nextJobs = [...jobs, finalJob];
      set({ jobs: nextJobs, parsedFile: null });
      saveJobsToLocal(nextJobs);
      useToastStore.getState().addToast(`Added job "${finalJob.title}" to board.`, 'success');
    }

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          `INSERT OR REPLACE INTO jobs (
            id, title, client, weight, print_time_minutes, price, filename, status, 
            progress, remaining_time_minutes, date_created, spool_id, filament_deducted,
            plate_index, plate_name, completed_at, printer_serial, printer_name, started_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            finalJob.id,
            finalJob.title,
            finalJob.client || '',
            finalJob.weight || 0,
            finalJob.printTimeMinutes || 0,
            finalJob.price || 0,
            finalJob.filename || '',
            finalJob.status,
            finalJob.progress !== undefined ? finalJob.progress : null,
            finalJob.remainingTimeMinutes !== undefined ? finalJob.remainingTimeMinutes : null,
            finalJob.dateCreated,
            finalJob.spoolId || null,
            finalJob.filamentDeducted ? 1 : 0,
            finalJob.plateIndex !== undefined ? finalJob.plateIndex : null,
            finalJob.plateName || null,
            finalJob.completedAt || null,
            finalJob.printerSerial || null,
            finalJob.printerName || null,
            finalJob.startedAt || null,
          ]
        );
      } catch (e) {
        console.error("Failed to save job to SQLite:", e);
      }
    }
  },

  updateJobStatus: async (id, newStatus) => {
    const { jobs } = get();
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    const jobName = job.title;
    let isDeducted = job.filamentDeducted || false;
    let startedAt = job.startedAt;
    let completedAt = job.completedAt;
    let printerSerial = job.printerSerial;
    let printerName = job.printerName;

    if (newStatus === 'Printing' && job.status !== 'Printing') {
      startedAt = new Date().toISOString();
      const activeSerial = usePrinterStore.getState().activePrinterSerial;
      if (activeSerial) {
        printerSerial = activeSerial;
        printerName = usePrinterStore.getState().printers.find(p => p.serial === activeSerial)?.name || activeSerial;
      }
    }

    if ((newStatus === 'Ready for Pickup' || newStatus === 'Completed') && !isDeducted) {
      if (job.spoolId) {
        await useFilamentStore.getState().deductFilament(job.spoolId, job.weight, job.title, 'deduction');
        isDeducted = true;
      }
    }

    // Print History Auto-logging when Completed
    if (newStatus === 'Completed' && job.status !== 'Completed') {
      completedAt = new Date().toISOString();
      const historyId = 'hist-' + Math.random().toString(36).substring(2, 9);
      const spool = useFilamentStore.getState().spools.find(s => s.id === job.spoolId);
      const spoolName = spool ? spool.name : '';

      const newRecord: PrintHistoryRecord = {
        id: historyId,
        jobId: job.id,
        jobTitle: job.title,
        client: job.client,
        filename: job.filename,
        weightGrams: job.weight,
        printTimeMinutes: job.printTimeMinutes,
        price: job.price,
        spoolId: job.spoolId || undefined,
        spoolName: spoolName || undefined,
        printerSerial: printerSerial || undefined,
        printerName: printerName || undefined,
        status: 'Completed',
        startedAt: startedAt || undefined,
        completedAt,
        plateIndex: job.plateIndex,
        plateName: job.plateName,
      };

      set((state) => {
        const nextHistory = [newRecord, ...state.historyLog];
        saveHistoryToLocal(nextHistory);
        return { historyLog: nextHistory };
      });

      if (isTauri()) {
        try {
          const db = await getDb();
          await db.execute(
            `INSERT INTO print_history (
              id, job_id, job_title, client, filename, weight_grams, print_time_minutes, 
              price, spool_id, spool_name, printer_serial, printer_name, status, 
              started_at, completed_at, plate_index, plate_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              historyId,
              job.id,
              job.title,
              job.client,
              job.filename,
              job.weight,
              job.printTimeMinutes,
              job.price,
              job.spoolId || null,
              spoolName || null,
              printerSerial || null,
              printerName || null,
              'Completed',
              startedAt || null,
              completedAt,
              job.plateIndex !== undefined ? job.plateIndex : null,
              job.plateName || null,
            ]
          );
          useToastStore.getState().addToast(`Logged "${job.title}" to print history.`, 'success');
        } catch (e) {
          console.error("Failed to write to print_history:", e);
        }
      } else {
        useToastStore.getState().addToast(`Logged "${job.title}" to print history.`, 'success');
      }
    }

    const updated = jobs.map((j) => {
      if (j.id === id) {
        const updates: Partial<Job> = {
          status: newStatus,
          filamentDeducted: isDeducted,
          startedAt,
          completedAt,
          printerSerial,
          printerName,
        };
        if (newStatus !== 'Printing') {
          updates.progress = undefined;
          updates.remainingTimeMinutes = undefined;
        } else if (newStatus === 'Printing') {
          updates.progress = 0;
        }
        return { ...j, ...updates };
      }
      return j;
    });

    set({ jobs: updated });
    saveJobsToLocal(updated);

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          `UPDATE jobs SET 
            status = $1, filament_deducted = $2, progress = $3, remaining_time_minutes = $4, 
            started_at = $5, completed_at = $6, printer_serial = $7, printer_name = $8 
          WHERE id = $9`,
          [
            newStatus,
            isDeducted ? 1 : 0,
            newStatus === 'Printing' ? 0 : null,
            null,
            startedAt || null,
            completedAt || null,
            printerSerial || null,
            printerName || null,
            id,
          ]
        );
      } catch (e) {
        console.error("Failed to update job status in SQLite:", e);
      }
    }

    useToastStore.getState().addToast(`Updated "${jobName}" status to: ${newStatus}`, 'info');
  },

  deleteJob: async (id) => {
    const { jobs } = get();
    const jobName = jobs.find((j) => j.id === id)?.title || 'Job';
    const filtered = jobs.filter((job) => job.id !== id);
    set({ jobs: filtered });
    saveJobsToLocal(filtered);
    useToastStore.getState().addToast(`Deleted job "${jobName}".`, 'warning');

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM jobs WHERE id = $1", [id]);
      } catch (e) {
        console.error("Failed to delete job from SQLite:", e);
      }
    }
  },

  setJobs: (jobs) => {
    set({ jobs });
    saveJobsToLocal(jobs);
  },

  failPrint: async (jobId, failurePercent) => {
    const { jobs, failuresLog } = get();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const wastedGrams = Math.round(job.weight * (failurePercent / 100) * 10) / 10;
    const filamentStore = useFilamentStore.getState();
    const spool = filamentStore.spools.find((s) => s.id === job.spoolId);
    const spoolName = spool ? spool.name : 'Default Spool';
    const wastedCost = spool ? Math.round(wastedGrams * (spool.cost / spool.initialWeight) * 100) / 100 : 0;

    if (job.spoolId) {
      await filamentStore.deductFilament(job.spoolId, wastedGrams, job.title, 'waste');
    }

    const wastedTimeMinutes = Math.round(job.printTimeMinutes * (failurePercent / 100));
    const newFailure: FailureRecord = {
      id: 'fail-' + Math.random().toString(36).substring(2, 9),
      jobTitle: job.title,
      client: job.client,
      spoolId: job.spoolId,
      spoolName,
      wastedGrams,
      wastedCost,
      wastedTimeMinutes,
      failurePercent,
      date: new Date().toLocaleDateString(),
    };

    const updatedJobs = jobs.map((j) => {
      if (j.id === jobId) {
        return {
          ...j,
          status: 'Pending Quote' as const,
          progress: undefined,
          remainingTimeMinutes: undefined,
          filamentDeducted: false,
        };
      }
      return j;
    });

    const nextFailures = [newFailure, ...failuresLog];
    set({
      jobs: updatedJobs,
      failuresLog: nextFailures,
    });
    saveJobsToLocal(updatedJobs);
    saveFailuresToLocal(nextFailures);
    useToastStore.getState().addToast(
      `Failure recorded: ${wastedGrams}g filament logged. "${job.title}" moved to Pending Quote.`,
      'error'
    );

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          `INSERT INTO failures (id, job_title, client, spool_id, spool_name, wasted_grams, wasted_cost, wasted_time_minutes, failure_percent, date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            newFailure.id,
            newFailure.jobTitle,
            newFailure.client || '',
            newFailure.spoolId || null,
            newFailure.spoolName,
            newFailure.wastedGrams,
            newFailure.wastedCost,
            newFailure.wastedTimeMinutes,
            newFailure.failurePercent,
            newFailure.date,
          ]
        );
        await db.execute(
          "UPDATE jobs SET status = 'Pending Quote', progress = NULL, remaining_time_minutes = NULL, filament_deducted = 0 WHERE id = $1",
          [jobId]
        );
      } catch (e) {
        console.error("Failed to log failure in SQLite:", e);
      }
    }
  },

  setParsedFile: (file) => set({ parsedFile: file }),
  setIncomingSlicerJob: (job) => set({ incomingSlicerJob: job }),
  setIsParsing: (v) => set({ isParsing: v }),
  setDragActive: (v) => set({ dragActive: v }),

  triggerPrint: async (jobId, filename) => {
    const printerStore = usePrinterStore.getState();
    const toast = useToastStore.getState();
    const { activePrinterSerial, printers } = printerStore;

    if (!activePrinterSerial) {
      toast.addToast('Please select and connect an active printer first.', 'warning');
      return;
    }

    const printerName = printers.find((p) => p.serial === activePrinterSerial)?.name || activePrinterSerial;
    toast.addToast(`Sending "${filename}" to printer "${printerName}"...`, 'info');
    const apiBase = getApiBase();

    try {
      const response = await fetch(`${apiBase}/api/printer/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: activePrinterSerial, filename }),
      });

      if (response.ok) {
        await get().updateJobStatus(jobId, 'Printing');
        toast.addToast('Print job sent successfully to physical printer!', 'success');
      } else {
        const data = await response.json();
        const errorMsg = data.error || 'Unknown network error';
        if (confirm(`Failed to send to physical printer: ${errorMsg}\n\nWould you like to start a mock simulation instead?`)) {
          const mockResponse = await fetch(`${apiBase}/api/printer/mock/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: activePrinterSerial, filename }),
          });
          if (mockResponse.ok) {
            await get().updateJobStatus(jobId, 'Printing');
            toast.addToast('Print simulation started.', 'info');
          } else {
            toast.addToast('Failed to start mock simulation.', 'error');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (confirm(`Connection error starting print: ${err.message || err}\n\nWould you like to start a mock simulation instead?`)) {
        try {
          await fetch(`${apiBase}/api/printer/mock/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: activePrinterSerial, filename }),
          });
          await get().updateJobStatus(jobId, 'Printing');
          toast.addToast('Print simulation started.', 'info');
        } catch (mockErr) {
          console.error(mockErr);
          toast.addToast('Failed to start mock simulation.', 'error');
        }
      }
    }
  },

  batchUpdateJobs: async (updater) => {
    const nextJobs = updater(get().jobs);
    set({ jobs: nextJobs });
    saveJobsToLocal(nextJobs);

    if (isTauri()) {
      try {
        const db = await getDb();
        for (const job of nextJobs) {
          await db.execute(
            `UPDATE jobs SET 
              status = $1, progress = $2, remaining_time_minutes = $3, filament_deducted = $4, 
              completed_at = $5, printer_serial = $6, printer_name = $7, started_at = $8 
            WHERE id = $9`,
            [
              job.status,
              job.progress !== undefined ? job.progress : null,
              job.remainingTimeMinutes !== undefined ? job.remainingTimeMinutes : null,
              job.filamentDeducted ? 1 : 0,
              job.completedAt || null,
              job.printerSerial || null,
              job.printerName || null,
              job.startedAt || null,
              job.id,
            ]
          );
        }
      } catch (e) {
        console.error("Failed to batch update jobs in SQLite:", e);
      }
    }
  },
}));
