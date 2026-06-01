import React from 'react';
import QuotingEngine from '../components/QuotingEngine';
import { useJobStore } from '../stores/useJobStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useFilamentStore } from '../stores/useFilamentStore';
import { useCustomerStore } from '../stores/useCustomerStore';

export default function QuotesPage() {
  const { parsedFile, addJob } = useJobStore();
  const { pricingVars, setPricingVars } = useSettingsStore();
  const { spools } = useFilamentStore();
  const { customers } = useCustomerStore();

  return (
    <QuotingEngine
      parsedFile={parsedFile}
      spools={spools}
      customers={customers}
      onAddJob={addJob}
      savedVariables={pricingVars}
      onSaveVariables={setPricingVars}
    />
  );
}
