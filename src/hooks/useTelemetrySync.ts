import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { normalizeFilename, getStringSimilarity } from '../utils/api';


export function useTelemetrySync() {
  const telemetryMap = usePrinterStore((s) => s.telemetryMap);
  const jobs = useJobStore((s) => s.jobs);

  useEffect(() => {
    const currentJobs = useJobStore.getState().jobs;
    let stateChanged = false;

    const activePrinters = Object.entries(telemetryMap).filter(
      ([_, tele]) => tele && tele.print && tele.print.subtask_name
    );

    // Track which job IDs have already been matched in this pass to prevent collision
    const matchedJobIds = new Set<string>();
    let nextJobs = [...currentJobs];

    for (const [serial, telemetry] of activePrinters) {
      const printState = telemetry.print;
      const gcodeState = printState.gcode_state || 'IDLE';
      const activeFile = printState.subtask_name || '';
      const percent = printState.mc_percent !== undefined ? printState.mc_percent : 0;
      const remaining = printState.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;

      if (!activeFile) continue;

      let bestJobId: string | null = null;
      let highestScore = 0;

      const candidateJobs = nextJobs.filter(
        (j) => j.status !== 'Completed' && j.status !== 'Ready for Pickup'
      );

      for (const job of candidateJobs) {
        if (matchedJobIds.has(job.id)) {
          continue;
        }

        // If the job is already locked to a different printer, skip
        if (job.printerSerial && job.printerSerial !== serial) {
          continue;
        }

        // Perfect match if serial matches
        if (job.printerSerial === serial) {
          bestJobId = job.id;
          highestScore = 1.0;
          break;
        }

        // Otherwise check string similarity
        const score = getStringSimilarity(job.filename, activeFile);
        if (score > highestScore && score >= 0.6) {
          highestScore = score;
          bestJobId = job.id;
        }
      }

      if (bestJobId) {
        matchedJobIds.add(bestJobId);
        
        nextJobs = nextJobs.map((job) => {
          if (job.id === bestJobId) {
            const printers = usePrinterStore.getState().printers;
            const printerName = printers.find((p) => p.serial === serial)?.name || serial;

            if (gcodeState === 'RUNNING' && job.status !== 'Printing') {
              stateChanged = true;
              return { 
                ...job, 
                status: 'Printing' as const, 
                progress: percent, 
                remainingTimeMinutes: remaining,
                printerSerial: serial,
                printerName: printerName,
                startedAt: job.startedAt || new Date().toISOString()
              };
            }

            if (gcodeState === 'RUNNING' && job.status === 'Printing') {
              if (job.progress !== percent || job.remainingTimeMinutes !== remaining || job.printerSerial !== serial) {
                stateChanged = true;
                return { 
                  ...job, 
                  progress: percent, 
                  remainingTimeMinutes: remaining,
                  printerSerial: serial,
                  printerName: printerName
                };
              }
            }

            if ((gcodeState === 'FINISH' || percent >= 100) && job.status === 'Printing') {
              stateChanged = true;

              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Print Completed!', {
                  body: `"${job.title}" is done and ready for client pickup.`,
                });
              }

              let finalSpoolId = job.spoolId;
              if (!finalSpoolId) {
                const spools = useFilamentStore.getState().spools;
                const matchingSpool = spools.find((s) => s.material === 'PLA') || spools[0];
                if (matchingSpool) {
                  finalSpoolId = matchingSpool.id;
                }
              }

              if (finalSpoolId && !job.filamentDeducted) {
                useFilamentStore.getState().deductFilament(finalSpoolId, job.weight, job.title, 'deduction');
              }

              return {
                ...job,
                status: 'Ready for Pickup' as const,
                progress: 100,
                remainingTimeMinutes: 0,
                filamentDeducted: true,
                spoolId: finalSpoolId,
                completedAt: job.completedAt || new Date().toISOString()
              };
            }
          }
          return job;
        });
      }
    }

    if (stateChanged) {
      useJobStore.getState().batchUpdateJobs(() => nextJobs);
    }
  }, [telemetryMap]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
}
