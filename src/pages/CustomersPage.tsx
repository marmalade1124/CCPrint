import React from 'react';
import CustomerManager from '../components/CustomerManager';
import { useCustomerStore } from '../stores/useCustomerStore';
import { useJobStore } from '../stores/useJobStore';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();
  const { jobs } = useJobStore();

  return (
    <CustomerManager
      customers={customers}
      jobs={jobs}
      onAddCustomer={addCustomer}
      onUpdateCustomer={updateCustomer}
      onDeleteCustomer={deleteCustomer}
    />
  );
}
