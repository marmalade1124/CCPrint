import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { normalizeFilename } from '../utils/api';


export function useTelemetrySync() {
  const telemetryMap = usePrinterStore((s) => s.telemetryMap);
  const jobs = useJobStore((s) => s.jobs);

  useEffect(() => {
    const currentJobs = useJobStore.getState().jobs;
    let stateChanged = false;

    const updatedJobs = currentJobs.map((job) => {
      // Ignore completed or ready for pickup jobs for live telemetry updates
      if (job.status === 'Completed' || job.status === 'Ready for Pickup') {
        return job;
      }

      for (const [serial, telemetry] of Object.entries(telemetryMap)) {
        if (!telemetry || !telemetry.print) continue;

        // If the job already has a printer assigned, only match telemetry from that printer
        if (job.printerSerial && job.printerSerial !== serial) {
          continue;
        }

        const printState = telemetry.print;
        const gcodeState = printState.gcode_state || 'IDLE';
        const activeFile = printState.subtask_name || '';
        const percent = printState.mc_percent !== undefined ? printState.mc_percent : 0;
        const remaining = printState.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;

        if (!activeFile) continue;

        const cleanJobFile = normalizeFilename(job.filename);
        const cleanActiveFile = normalizeFilename(activeFile);

        const matches = cleanJobFile !== '' && cleanActiveFile !== '' && cleanJobFile === cleanActiveFile;

        if (matches) {
          if (gcodeState === 'RUNNING' && job.status !== 'Printing') {
            stateChanged = true;
            const printers = usePrinterStore.getState().printers;
            const printerName = printers.find(p => p.serial === serial)?.name || serial;
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
            if (job.progress !== percent || job.remainingTimeMinutes !== remaining || !job.printerSerial) {
              stateChanged = true;
              const printers = usePrinterStore.getState().printers;
              const printerName = printers.find(p => p.serial === serial)?.name || serial;
              return { 
                ...job, 
                progress: percent, 
                remainingTimeMinutes: remaining,
                printerSerial: job.printerSerial || serial,
                printerName: job.printerName || printerName
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
              const matchingSpool = spools.find(s => s.material === 'PLA') || spools[0];
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
      }
      return job;
    });

    if (stateChanged) {
      useJobStore.getState().batchUpdateJobs(() => updatedJobs);
    }
  }, [telemetryMap]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
}
