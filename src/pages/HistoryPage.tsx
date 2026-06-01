import React from 'react';
import PrintHistory from '../components/PrintHistory';
import { useJobStore } from '../stores/useJobStore';
import { useFilamentStore } from '../stores/useFilamentStore';

export default function HistoryPage() {
  const { historyLog, failuresLog } = useJobStore();
  const { spools } = useFilamentStore();

  return <PrintHistory historyLog={historyLog} failures={failuresLog} spools={spools} />;
}
