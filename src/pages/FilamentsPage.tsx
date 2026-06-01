import React from 'react';
import FilamentInventory from '../components/FilamentInventory';
import { useFilamentStore } from '../stores/useFilamentStore';

export default function FilamentsPage() {
  const { spools, logs, addSpool, updateSpool, deleteSpool } = useFilamentStore();

  return (
    <FilamentInventory
      spools={spools}
      logs={logs}
      onAddSpool={addSpool}
      onUpdateSpool={updateSpool}
      onDeleteSpool={deleteSpool}
    />
  );
}
