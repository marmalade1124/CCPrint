import React from 'react';
import KanbanBoard from '../components/KanbanBoard';
import { useJobStore } from '../stores/useJobStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useToastStore } from '../stores/useToastStore';
import { getApiBase } from '../utils/api';

interface JobBoardPageProps {
  onNavigate: (tab: string) => void;
}

export default function JobBoardPage({ onNavigate }: JobBoardPageProps) {
  const { jobs, updateJobStatus, deleteJob, failPrint, triggerPrint, setParsedFile } = useJobStore();
  const { activePrinterSerial, telemetryMap } = usePrinterStore();
  const { addToast } = useToastStore();

  const activePrintFilename = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.subtask_name : undefined;
  const activePrintProgress = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.mc_percent : undefined;
  const activePrintRemaining = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.mc_remaining_time : undefined;

  const handleSelectJobForQuote = (job: any) => {
    setParsedFile({
      filename: job.filename, fileSize: 0, printTimeMinutes: job.printTimeMinutes,
      printTimeString: '', filamentWeightGrams: job.weight, layerHeightMm: 0.2,
      filamentDensity: 1.24, filamentDiameter: 1.75, filamentChanges: 0, modifiedDate: '',
    });
    onNavigate('quotes');
  };

  return (
    <KanbanBoard
      jobs={jobs}
      onUpdateJobStatus={updateJobStatus}
      onDeleteJob={deleteJob}
      onSelectJobForQuote={handleSelectJobForQuote}
      onTriggerPrint={triggerPrint}
      onTriggerPrintMock={(filename) => {
        if (activePrinterSerial) {
          const apiBase = getApiBase();
          fetch(`${apiBase}/api/printer/mock/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: activePrinterSerial, filename }),
          });
        } else {
          addToast('Please select and connect an active printer first.', 'warning');
        }
      }}
      activePrintFilename={activePrintFilename}
      activePrintProgress={activePrintProgress}
      activePrintRemaining={activePrintRemaining}
      onMarkFailed={failPrint}
    />
  );
}
