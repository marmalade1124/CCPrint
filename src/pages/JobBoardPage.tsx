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
  const { jobs, updateJobStatus, deleteJob, failPrint, triggerPrint, setParsedFile, linkJobToActivePrint } = useJobStore();
  const { activePrinterSerial, telemetryMap, connectionStatusMap } = usePrinterStore();
  const { addToast } = useToastStore();

  // Find if there is any active print on any printer
  let targetPrinterSerial = activePrinterSerial || undefined;
  let activePrintFilename = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.subtask_name : undefined;
  let activePrintProgress = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.mc_percent : undefined;
  let activePrintRemaining = activePrinterSerial ? telemetryMap[activePrinterSerial]?.print?.mc_remaining_time : undefined;

  // If the currently selected active printer doesn't have an active print,
  // scan telemetryMap for any other online printer that has an active print.
  if (!activePrintFilename || activePrintFilename === '') {
    // 1. Look for a printer that is online and actively printing/paused/preparing (not IDLE/FINISH)
    let printingPrinter = Object.entries(telemetryMap).find(([serial, tele]) => {
      const hasPrint = tele?.print?.subtask_name;
      const isOnline = connectionStatusMap[serial] === 'online';
      const gcodeState = tele?.print?.gcode_state;
      return hasPrint && isOnline && gcodeState !== 'IDLE' && gcodeState !== 'FINISH';
    });

    // 2. Fall back to any online printer that has a subtask_name
    if (!printingPrinter) {
      printingPrinter = Object.entries(telemetryMap).find(([serial, tele]) => {
        const hasPrint = tele?.print?.subtask_name;
        const isOnline = connectionStatusMap[serial] === 'online';
        return hasPrint && isOnline;
      });
    }

    if (printingPrinter) {
      const [serial, tele] = printingPrinter;
      targetPrinterSerial = serial;
      activePrintFilename = tele.print.subtask_name;
      activePrintProgress = tele.print.mc_percent;
      activePrintRemaining = tele.print.mc_remaining_time;
    }
  }

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
        if (targetPrinterSerial) {
          const apiBase = getApiBase();
          fetch(`${apiBase}/api/printer/mock/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: targetPrinterSerial, filename }),
          });
        } else {
          addToast('Please select and connect an active printer first.', 'warning');
        }
      }}
      activePrintFilename={activePrintFilename}
      activePrintProgress={activePrintProgress}
      activePrintRemaining={activePrintRemaining}
      onMarkFailed={failPrint}
      onLinkActivePrint={linkJobToActivePrint}
      activePrinterSerial={targetPrinterSerial}
    />
  );
}
