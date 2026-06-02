import { useEffect, useRef } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useFilamentStore } from '../stores/useFilamentStore';

export function useTelemetrySync() {
  const telemetryMap = usePrinterStore((s) => s.telemetryMap);
  const jobs = useJobStore((s) => s.jobs);
  const prevJobsRef = useRef(jobs);

  useEffect(() => {
    const currentJobs = useJobStore.getState().jobs;
    let stateChanged = false;

    const updatedJobs = currentJobs.map((job) => {
      for (const [, telemetry] of Object.entries(telemetryMap)) {
        if (!telemetry || !telemetry.print) continue;

        const printState = telemetry.print;
        const gcodeState = printState.gcode_state || 'IDLE';
        const activeFile = printState.subtask_name || '';
        const percent = printState.mc_percent !== undefined ? printState.mc_percent : 0;
        const remaining = printState.mc_remaining_time !== undefined ? printState.mc_remaining_time : 0;

        if (!activeFile) continue;

        const cleanJobFile = job.filename.replace(/\s*\(Plate\s+\d+\)\s*$/i, '').toLowerCase();
        const cleanActiveFile = activeFile.replace(/\s*\(Plate\s+\d+\)\s*$/i, '').toLowerCase();

        // Check for direct match, substring containment, or keyword overlap of significant words (length > 4)
        const getSignificantWords = (s: string) => 
          s.split(/[^a-z0-9]/).filter(word => word.length > 4);
        
        const jobWords = getSignificantWords(cleanJobFile);
        const activeWords = getSignificantWords(cleanActiveFile);
        const hasKeywordOverlap = jobWords.some(word => activeWords.includes(word));

        const matches =
          cleanJobFile === cleanActiveFile ||
          cleanActiveFile.includes(cleanJobFile) ||
          cleanJobFile.includes(cleanActiveFile) ||
          hasKeywordOverlap;

        if (matches) {
          if (gcodeState === 'RUNNING' && job.status !== 'Printing') {
            stateChanged = true;
            return { ...job, status: 'Printing' as const, progress: percent, remainingTimeMinutes: remaining };
          }

          if (gcodeState === 'RUNNING' && job.status === 'Printing') {
            if (job.progress !== percent || job.remainingTimeMinutes !== remaining) {
              stateChanged = true;
              return { ...job, progress: percent, remainingTimeMinutes: remaining };
            }
          }

          if ((gcodeState === 'FINISH' || percent >= 100) && job.status === 'Printing') {
            stateChanged = true;

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Print Completed!', {
                body: `"${job.title}" is done and ready for client pickup.`,
              });
            }

            if (job.spoolId && !job.filamentDeducted) {
              useFilamentStore.getState().deductFilament(job.spoolId, job.weight, job.title, 'deduction');
            }

            return {
              ...job,
              status: 'Ready for Pickup' as const,
              progress: 100,
              remainingTimeMinutes: 0,
              filamentDeducted: true,
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
