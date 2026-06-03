import { create } from 'zustand';
import type { FilamentSpool } from '../components/FilamentInventory';
import type { FilamentLog } from '../App';
import { getDb } from '../lib/database';
import { isTauri } from '../utils/api';

const saveSpoolsToLocal = (spools: FilamentSpool[]) => {
  try {
    localStorage.setItem('printflow_filaments', JSON.stringify(spools));
  } catch (e) {
    console.error("Failed to save spools to localStorage:", e);
  }
};

const saveLogsToLocal = (logs: FilamentLog[]) => {
  try {
    localStorage.setItem('printflow_filament_logs', JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to save filament logs to localStorage:", e);
  }
};

interface FilamentStore {
  spools: FilamentSpool[];
  logs: FilamentLog[];
  init: () => Promise<void>;
  addSpool: (spool: FilamentSpool) => Promise<void>;
  updateSpool: (id: string, updated: Partial<FilamentSpool>) => Promise<void>;
  deleteSpool: (id: string) => Promise<void>;
  deductFilament: (
    spoolId: string,
    grams: number,
    jobTitle?: string,
    type?: 'deduction' | 'waste' | 'refill'
  ) => Promise<void>;
  clearLogs: () => Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useFilamentStore = create<FilamentStore>((set, get) => ({
  spools: [],
  logs: [],

  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        let spools: FilamentSpool[] = [];
        let logs: FilamentLog[] = [];
        let loaded = false;

    if (isTauri()) {
      try {
        const db = await getDb();
        const spoolRows = await db.select<any[]>("SELECT * FROM spools ORDER BY name ASC");
        const logRows = await db.select<any[]>("SELECT * FROM filament_logs ORDER BY date DESC LIMIT 500");

        spools = spoolRows.map((r) => ({
          id: r.id,
          name: r.name,
          material: r.material,
          colorName: r.color_name,
          colorHex: r.color_hex,
          cost: r.cost,
          initialWeight: r.initial_weight,
          weightLeft: r.weight_left,
          lowWeightThreshold: r.low_weight_threshold,
        }));

        logs = logRows.map((r) => ({
          id: r.id,
          spoolId: r.spool_id,
          spoolName: r.spool_name,
          jobTitle: r.job_title,
          grams: r.grams,
          type: r.type,
          date: r.date,
        }));
        if (spools.length > 0) {
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to initialize FilamentStore from SQLite, falling back to localStorage:", e);
      }
    }

    if (!loaded) {
      try {
        const storedSpools = localStorage.getItem('printflow_filaments');
        if (storedSpools) {
          spools = JSON.parse(storedSpools);
        }
        const storedLogs = localStorage.getItem('printflow_filament_logs');
        if (storedLogs) {
          logs = JSON.parse(storedLogs);
        }

        if (isTauri() && spools.length > 0) {
          try {
            const db = await getDb();
            for (const s of spools) {
              await db.execute(
                "INSERT OR REPLACE INTO spools (id, name, material, color_name, color_hex, cost, initial_weight, weight_left, low_weight_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                [
                  s.id,
                  s.name,
                  s.material,
                  s.colorName || '',
                  s.colorHex || '',
                  s.cost || 0,
                  s.initialWeight || 0,
                  s.weightLeft || 0,
                  s.lowWeightThreshold || 50,
                ]
              );
            }
            for (const l of logs) {
              await db.execute(
                "INSERT OR REPLACE INTO filament_logs (id, spool_id, spool_name, job_title, grams, type, date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [l.id, l.spoolId, l.spoolName, l.jobTitle, l.grams, l.type, l.date]
              );
            }
          } catch (sqle) {
            console.error("Failed to sync loaded localStorage filaments to SQLite:", sqle);
          }
        }
      } catch (e) {
        console.error("Failed to load filaments from localStorage:", e);
      }
    }

        set({ spools, logs });
      })();
    }
    return initPromise;
  },

  addSpool: async (spool) => {
    set((state) => {
      const nextSpools = [...state.spools, spool];
      saveSpoolsToLocal(nextSpools);
      return { spools: nextSpools };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO spools (id, name, material, color_name, color_hex, cost, initial_weight, weight_left, low_weight_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [
            spool.id,
            spool.name,
            spool.material,
            spool.colorName || '',
            spool.colorHex || '',
            spool.cost || 0,
            spool.initialWeight || 0,
            spool.weightLeft || 0,
            spool.lowWeightThreshold || 50,
          ]
        );
      } catch (e) {
        console.error("Failed to add spool to SQLite:", e);
      }
    }
  },

  updateSpool: async (id, updated) => {
    set((state) => {
      const nextSpools = state.spools.map((s) => (s.id === id ? { ...s, ...updated } : s));
      saveSpoolsToLocal(nextSpools);
      return { spools: nextSpools };
    });
    if (isTauri()) {
      try {
        const current = get().spools.find((s) => s.id === id);
        if (!current) return;
        const db = await getDb();
        await db.execute(
          "UPDATE spools SET name = $1, material = $2, color_name = $3, color_hex = $4, cost = $5, initial_weight = $6, weight_left = $7, low_weight_threshold = $8 WHERE id = $9",
          [
            current.name,
            current.material,
            current.colorName || '',
            current.colorHex || '',
            current.cost || 0,
            current.initialWeight || 0,
            current.weightLeft || 0,
            current.lowWeightThreshold || 50,
            id,
          ]
        );
      } catch (e) {
        console.error("Failed to update spool in SQLite:", e);
      }
    }
  },

  deleteSpool: async (id) => {
    set((state) => {
      const nextSpools = state.spools.filter((s) => s.id !== id);
      saveSpoolsToLocal(nextSpools);
      return { spools: nextSpools };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM spools WHERE id = $1", [id]);
      } catch (e) {
        console.error("Failed to delete spool in SQLite:", e);
      }
    }
  },

  deductFilament: async (spoolId, grams, jobTitle = 'Job', type = 'deduction') => {
    let spoolName = 'Unknown';
    set((state) => {
      const updatedSpools = state.spools.map((spool) => {
        if (spool.id === spoolId) {
          const newWeight = Math.max(0, Math.round((spool.weightLeft - grams) * 10) / 10);
          spoolName = spool.name;
          return { ...spool, weightLeft: newWeight };
        }
        return spool;
      });

      const newLog: FilamentLog = {
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        spoolId,
        spoolName: state.spools.find((s) => s.id === spoolId)?.name || 'Unknown',
        jobTitle,
        grams,
        type,
        date:
          new Date().toLocaleDateString() +
          ' ' +
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextLogs = [newLog, ...state.logs];
      saveSpoolsToLocal(updatedSpools);
      saveLogsToLocal(nextLogs);

      return {
        spools: updatedSpools,
        logs: nextLogs,
      };
    });

    if (isTauri()) {
      try {
        const spool = get().spools.find((s) => s.id === spoolId);
        if (!spool) return;

        const logId = 'log-' + Math.random().toString(36).substring(2, 9);
        const logDate =
          new Date().toLocaleDateString() +
          ' ' +
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const db = await getDb();
        await db.execute("UPDATE spools SET weight_left = $1 WHERE id = $2", [
          spool.weightLeft,
          spoolId,
        ]);
        await db.execute(
          "INSERT INTO filament_logs (id, spool_id, spool_name, job_title, grams, type, date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [logId, spoolId, spoolName, jobTitle, grams, type, logDate]
        );
      } catch (e) {
        console.error("Failed to deduct filament in SQLite:", e);
      }
    }
  },

  clearLogs: async () => {
    set({ logs: [] });
    saveLogsToLocal([]);
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM filament_logs");
      } catch (e) {
        console.error("Failed to clear filament logs in SQLite:", e);
      }
    }
  },
}));

