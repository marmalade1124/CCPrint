import { create } from 'zustand';
import type { PrinterProfile } from '../components/PrinterStatus';
import { getDb } from '../lib/database';
import { isTauri } from '../utils/api';

const saveToLocal = (printers: PrinterProfile[], activePrinterSerial: string | null) => {
  try {
    localStorage.setItem('printflow_printers_store', JSON.stringify({ printers, activePrinterSerial }));
  } catch (e) {
    console.error("Failed to save printers to localStorage:", e);
  }
};

interface PrinterStore {
  printers: PrinterProfile[];
  activePrinterSerial: string | null;
  telemetryMap: Record<string, any>;
  connectionStatusMap: Record<string, 'offline' | 'connecting' | 'online'>;

  init: () => Promise<void>;
  // CRUD
  addPrinter: (printer: PrinterProfile) => Promise<void>;
  updatePrinter: (id: string, updated: Partial<PrinterProfile>) => Promise<void>;
  deletePrinter: (id: string) => Promise<void>;
  setActivePrinter: (serial: string | null) => Promise<void>;

  // Telemetry (transient, not persisted)
  setTelemetryForSerial: (serial: string, data: any) => void;
  setConnectionStatus: (serial: string, status: 'offline' | 'connecting' | 'online') => void;
  setBulkStatus: (statuses: Record<string, 'offline' | 'connecting' | 'online'>, telemetries: Record<string, any>) => void;
  clearPrinterTelemetry: (serial: string) => void;
  resetAllConnections: () => void;
}

let initPromise: Promise<void> | null = null;

export const usePrinterStore = create<PrinterStore>((set, get) => ({
  printers: [],
  activePrinterSerial: null,
  telemetryMap: {},
  connectionStatusMap: {},

  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        let printers: PrinterProfile[] = [];
        let activePrinterSerial: string | null = null;
        let loaded = false;

    if (isTauri()) {
      try {
        const db = await getDb();
        const printerRows = await db.select<any[]>("SELECT * FROM printers ORDER BY name ASC");
        printers = printerRows.map((r) => ({
          id: r.id,
          name: r.name,
          ip: r.ip,
          serial: r.serial,
          accessCode: r.access_code,
        }));

        const activeRes = await db.select<{ value: string }[]>(
          "SELECT value FROM settings WHERE key = $1",
          ["activePrinterSerial"]
        );
        activePrinterSerial = activeRes.length > 0 ? activeRes[0].value : null;
        
        if (printers.length > 0) {
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to initialize PrinterStore from SQLite, falling back to localStorage:", e);
      }
    }

    if (!loaded) {
      try {
        const stored = localStorage.getItem('printflow_printers_store');
        if (stored) {
          const parsed = JSON.parse(stored);
          printers = parsed.printers || [];
          activePrinterSerial = parsed.activePrinterSerial || null;

          if (isTauri() && printers.length > 0) {
            try {
              const db = await getDb();
              for (const p of printers) {
                await db.execute(
                  "INSERT OR REPLACE INTO printers (id, name, ip, serial, access_code) VALUES ($1, $2, $3, $4, $5)",
                  [p.id, p.name, p.ip || '', p.serial || '', p.accessCode || '']
                );
              }
              if (activePrinterSerial) {
                await db.execute(
                  "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
                  ["activePrinterSerial", activePrinterSerial]
                );
              }
            } catch (sqle) {
              console.error("Failed to sync loaded localStorage printers to SQLite:", sqle);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load printers from localStorage:", e);
      }
    }

        set({ printers, activePrinterSerial });
      })();
    }
    return initPromise;
  },

  addPrinter: async (printer) => {
    set((state) => {
      const nextPrinters = [...state.printers, printer];
      saveToLocal(nextPrinters, state.activePrinterSerial);
      return { printers: nextPrinters };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO printers (id, name, ip, serial, access_code) VALUES ($1, $2, $3, $4, $5)",
          [printer.id, printer.name, printer.ip || '', printer.serial || '', printer.accessCode || '']
        );
      } catch (e) {
        console.error("Failed to add printer to SQLite:", e);
      }
    }
  },

  updatePrinter: async (id, updated) => {
    set((state) => {
      const nextPrinters = state.printers.map((p) => (p.id === id ? { ...p, ...updated } : p));
      saveToLocal(nextPrinters, state.activePrinterSerial);
      return { printers: nextPrinters };
    });
    if (isTauri()) {
      try {
        const current = get().printers.find((p) => p.id === id);
        if (!current) return;
        const db = await getDb();
        await db.execute(
          "UPDATE printers SET name = $1, ip = $2, serial = $3, access_code = $4 WHERE id = $5",
          [current.name, current.ip || '', current.serial || '', current.accessCode || '', id]
        );
      } catch (e) {
        console.error("Failed to update printer in SQLite:", e);
      }
    }
  },

  deletePrinter: async (id) => {
    let nextActiveSerial = get().activePrinterSerial;
    set((state) => {
      const printer = state.printers.find((p) => p.id === id);
      const newActive =
        printer && state.activePrinterSerial === printer.serial
          ? null
          : state.activePrinterSerial;
      nextActiveSerial = newActive;
      const nextPrinters = state.printers.filter((p) => p.id !== id);
      saveToLocal(nextPrinters, newActive);
      return {
        printers: nextPrinters,
        activePrinterSerial: newActive,
      };
    });

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM printers WHERE id = $1", [id]);
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["activePrinterSerial", nextActiveSerial || '']
        );
      } catch (e) {
        console.error("Failed to delete printer in SQLite:", e);
      }
    }
  },

  setActivePrinter: async (serial) => {
    set((state) => {
      saveToLocal(state.printers, serial);
      return { activePrinterSerial: serial };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["activePrinterSerial", serial || '']
        );
      } catch (e) {
        console.error("Failed to set active printer in SQLite:", e);
      }
    }
  },


  setTelemetryForSerial: (serial, data) =>
    set((state) => ({
      telemetryMap: {
        ...state.telemetryMap,
        [serial]: {
          ...(state.telemetryMap[serial] || {}),
          ...data,
          print: {
            ...((state.telemetryMap[serial] || {}).print || {}),
            ...(data?.print || {}),
          },
        },
      },
      connectionStatusMap: {
        ...state.connectionStatusMap,
        [serial]: 'online' as const,
      },
    })),

  setConnectionStatus: (serial, status) =>
    set((state) => ({
      connectionStatusMap: { ...state.connectionStatusMap, [serial]: status },
    })),

  setBulkStatus: (statuses, telemetries) =>
    set({ connectionStatusMap: statuses, telemetryMap: telemetries }),

  clearPrinterTelemetry: (serial) =>
    set((state) => {
      const next = { ...state.telemetryMap };
      delete next[serial];
      return {
        telemetryMap: next,
        connectionStatusMap: { ...state.connectionStatusMap, [serial]: 'offline' as const },
      };
    }),

  resetAllConnections: () => set({ connectionStatusMap: {}, telemetryMap: {} }),
}));
