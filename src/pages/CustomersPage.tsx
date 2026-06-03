import React from 'react';
import CustomerManager from '../components/CustomerManager';
import { useCustomerStore } from '../stores/useCustomerStore';
import { useJobStore } from '../stores/useJobStore';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();
  const { jobs, historyLog, failuresLog } = useJobStore();

  return (
    <CustomerManager
      customers={customers}
      jobs={jobs}
      historyLog={historyLog}
      failures={failuresLog}
      onAddCustomer={addCustomer}
      onUpdateCustomer={updateCustomer}
      onDeleteCustomer={deleteCustomer}
    />
  );
}
