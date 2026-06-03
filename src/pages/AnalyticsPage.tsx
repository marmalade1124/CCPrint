import React from 'react';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { useJobStore } from '../stores/useJobStore';
import { useFilamentStore } from '../stores/useFilamentStore';

export default function AnalyticsPage() {
  const { jobs, failuresLog, historyLog } = useJobStore();
  const { spools } = useFilamentStore();

  return <AnalyticsDashboard jobs={jobs} spools={spools} failures={failuresLog} historyLog={historyLog} />;
}
