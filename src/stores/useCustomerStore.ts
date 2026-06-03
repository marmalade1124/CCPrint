import { create } from 'zustand';
import type { Customer } from '../components/CustomerManager';
import { getDb } from '../lib/database';
import { isTauri } from '../utils/api';

const saveToLocal = (customers: Customer[]) => {
  try {
    localStorage.setItem('printflow_customers_store', JSON.stringify(customers));
  } catch (e) {
    console.error("Failed to save customers to localStorage:", e);
  }
};

interface CustomerStore {
  customers: Customer[];
  init: () => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updated: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],

  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        let customers: Customer[] = [];
        let loaded = false;

        if (isTauri()) {
          try {
            const db = await getDb();
            const rows = await db.select<any[]>("SELECT * FROM customers ORDER BY name ASC");
            customers = rows.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email || '',
              phone: r.phone || '',
              company: r.company || '',
              notes: r.notes || '',
              dateAdded: r.date_added,
            }));
            if (customers.length > 0) {
              loaded = true;
            }
          } catch (e) {
            console.error("Failed to initialize CustomerStore from SQLite, falling back to localStorage:", e);
          }
        }

        if (!loaded) {
          try {
            const stored = localStorage.getItem('printflow_customers_store');
            if (stored) {
              customers = JSON.parse(stored);

              if (isTauri() && customers.length > 0) {
                try {
                  const db = await getDb();
                  for (const c of customers) {
                    await db.execute(
                      "INSERT OR REPLACE INTO customers (id, name, email, phone, company, notes, date_added) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                      [
                        c.id,
                        c.name,
                        c.email || '',
                        c.phone || '',
                        c.company || '',
                        c.notes || '',
                        c.dateAdded,
                      ]
                    );
                  }
                } catch (sqle) {
                  console.error("Failed to sync loaded localStorage customers to SQLite:", sqle);
                }
              }
            }
          } catch (e) {
            console.error("Failed to load customers from localStorage:", e);
          }
        }

        set({ customers });
      })();
    }
    return initPromise;
  },

  addCustomer: async (customer) => {
    set((state) => {
      const nextCustomers = [...state.customers, customer];
      saveToLocal(nextCustomers);
      return { customers: nextCustomers };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO customers (id, name, email, phone, company, notes, date_added) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            customer.id,
            customer.name,
            customer.email || '',
            customer.phone || '',
            customer.company || '',
            customer.notes || '',
            customer.dateAdded,
          ]
        );
      } catch (e) {
        console.error("Failed to add customer in SQLite:", e);
      }
    }
  },

  updateCustomer: async (id, updated) => {
    set((state) => {
      const nextCustomers = state.customers.map((c) => (c.id === id ? { ...c, ...updated } : c));
      saveToLocal(nextCustomers);
      return { customers: nextCustomers };
    });
    if (isTauri()) {
      try {
        const current = get().customers.find((c) => c.id === id);
        if (!current) return;
        const db = await getDb();
        await db.execute(
          "UPDATE customers SET name = $1, email = $2, phone = $3, company = $4, notes = $5, date_added = $6 WHERE id = $7",
          [
            current.name,
            current.email || '',
            current.phone || '',
            current.company || '',
            current.notes || '',
            current.dateAdded,
            id,
          ]
        );
      } catch (e) {
        console.error("Failed to update customer in SQLite:", e);
      }
    }
  },

  deleteCustomer: async (id) => {
    set((state) => {
      const nextCustomers = state.customers.filter((c) => c.id !== id);
      saveToLocal(nextCustomers);
      return { customers: nextCustomers };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM customers WHERE id = $1", [id]);
      } catch (e) {
        console.error("Failed to delete customer in SQLite:", e);
      }
    }
  },
}));

