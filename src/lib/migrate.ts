import { getDb } from './database';

let migrationPromise: Promise<void> | null = null;

export function runMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const db = await getDb();

  // Check if already migrated
  const migrationCheck = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    ["migrated_from_localstorage"]
  );

  if (migrationCheck.length > 0 && migrationCheck[0].value === 'true') {
    console.log("Database already migrated from localStorage.");
    return;
  }

  console.log("Starting data migration from localStorage to SQLite...");

  // 1. Migrate settings
  const settingsJson = localStorage.getItem('printflow_settings');
  if (settingsJson) {
    try {
      const parsed = JSON.parse(settingsJson);
      const state = parsed.state || parsed || {};
      if (state.pricingVars) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["pricingVars", JSON.stringify(state.pricingVars)]
        );
      }
      if (state.shopName) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["shopName", state.shopName]
        );
      }
      console.log("Migrated settings.");
    } catch (e) {
      console.error("Failed to migrate settings:", e);
    }
  }

  // 2. Migrate customers
  const customersJson = localStorage.getItem('printflow_customers_store');
  if (customersJson) {
    try {
      const parsed = JSON.parse(customersJson);
      const state = parsed.state || parsed || {};
      const customers = state.customers || (Array.isArray(parsed) ? parsed : []);
      for (const c of customers) {
        await db.execute(
          "INSERT OR REPLACE INTO customers (id, name, email, phone, company, notes, date_added) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [c.id, c.name, c.email || '', c.phone || '', c.company || '', c.notes || '', c.dateAdded || new Date().toLocaleDateString()]
        );
      }
      console.log(`Migrated ${customers.length} customers.`);
    } catch (e) {
      console.error("Failed to migrate customers:", e);
    }
  }

  // 3. Migrate printers
  const printersJson = localStorage.getItem('printflow_printers_store');
  if (printersJson) {
    try {
      const parsed = JSON.parse(printersJson);
      const state = parsed.state || parsed || {};
      const printers = state.printers || [];
      for (const p of printers) {
        await db.execute(
          "INSERT OR REPLACE INTO printers (id, name, ip, serial, access_code) VALUES ($1, $2, $3, $4, $5)",
          [p.id, p.name, p.ip || '', p.serial || '', p.accessCode || '']
        );
      }
      if (state.activePrinterSerial) {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["activePrinterSerial", state.activePrinterSerial]
        );
      }
      console.log(`Migrated ${printers.length} printers.`);
    } catch (e) {
      console.error("Failed to migrate printers:", e);
    }
  }

  // 4. Migrate filaments (spools & logs)
  const filamentsJson = localStorage.getItem('printflow_filaments_store');
  if (filamentsJson) {
    try {
      const parsed = JSON.parse(filamentsJson);
      const state = parsed.state || parsed || {};
      const spools = state.spools || (Array.isArray(parsed) ? parsed : []);
      const logs = state.logs || [];

      for (const s of spools) {
        await db.execute(
          "INSERT OR REPLACE INTO spools (id, name, material, color_name, color_hex, cost, initial_weight, weight_left, low_weight_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [s.id, s.name, s.material || '', s.colorName || '', s.colorHex || '', s.cost || 0, s.initialWeight || 0, s.weightLeft || 0, s.lowWeightThreshold || 50]
        );
      }

      for (const l of logs) {
        await db.execute(
          "INSERT OR REPLACE INTO filament_logs (id, spool_id, spool_name, job_title, grams, type, date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [l.id, l.spoolId, l.spoolName, l.jobTitle, l.grams, l.type, l.date]
        );
      }
      console.log(`Migrated ${spools.length} spools and ${logs.length} logs.`);
    } catch (e) {
      console.error("Failed to migrate filaments:", e);
    }
  }

  // 5. Migrate jobs & failures
  const jobsJson = localStorage.getItem('printflow_jobs_store');
  if (jobsJson) {
    try {
      const parsed = JSON.parse(jobsJson);
      const state = parsed.state || parsed || {};
      const jobs = state.jobs || [];
      const failures = state.failuresLog || [];

      for (const j of jobs) {
        await db.execute(
          "INSERT OR REPLACE INTO jobs (id, title, client, weight, print_time_minutes, price, filename, status, progress, remaining_time_minutes, date_created, spool_id, filament_deducted, plate_index, plate_name, completed_at, printer_serial, printer_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)",
          [
            j.id, j.title, j.client || '', j.weight || 0, j.printTimeMinutes || 0, j.price || 0, j.filename || '',
            j.status || 'Pending Quote', j.progress !== undefined ? j.progress : null,
            j.remainingTimeMinutes !== undefined ? j.remainingTimeMinutes : null,
            j.dateCreated || '', j.spoolId || null, j.filamentDeducted ? 1 : 0,
            j.plateIndex !== undefined ? j.plateIndex : null, j.plateName || null,
            j.completedAt || null, j.printerSerial || null, j.printerName || null
          ]
        );
      }

      for (const f of failures) {
        await db.execute(
          "INSERT OR REPLACE INTO failures (id, job_title, client, spool_id, spool_name, wasted_grams, wasted_cost, wasted_time_minutes, failure_percent, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [f.id, f.jobTitle, f.client || '', f.spoolId || null, f.spoolName || '', f.wastedGrams || 0, f.wastedCost || 0, f.wastedTimeMinutes || 0, f.failurePercent || 0, f.date || '']
        );
      }
      console.log(`Migrated ${jobs.length} jobs and ${failures.length} failures.`);
    } catch (e) {
      console.error("Failed to migrate jobs:", e);
    }
  }

  // 6. Migrate notifications
  const notificationsJson = localStorage.getItem('printflow_notifications');
  if (notificationsJson) {
    try {
      const parsed = JSON.parse(notificationsJson);
      const state = parsed.state || parsed || {};
      const notifications = state.notifications || (Array.isArray(parsed) ? parsed : []);
      for (const n of notifications) {
        await db.execute(
          "INSERT OR REPLACE INTO notifications (id, message, type, read, created_at, action_type, action_payload) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [n.id, n.message, n.type || 'info', n.read ? 1 : 0, n.createdAt || '', n.actionType || null, n.actionPayload || null]
        );
      }
      console.log(`Migrated ${notifications.length} notifications.`);
    } catch (e) {
      console.error("Failed to migrate notifications:", e);
    }
  }

  // Set migrated setting
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
    ["migrated_from_localstorage", "true"]
  );

  console.log("Data migration to SQLite finished successfully.");

  // Clear migrated items from localStorage
  const keysToClear = [
    'printflow_settings',
    'printflow_customers_store',
    'printflow_printers_store',
    'printflow_filaments_store',
    'printflow_jobs_store',
    'printflow_notifications',
    // also legacy keys
    'printflow_vars',
    'printflow_shop_name',
    'printflow_customers',
    'printflow_printers',
    'printflow_active_printer_serial',
    'printflow_filaments',
    'printflow_filament_logs',
    'printflow_jobs',
    'printflow_failures'
  ];

  for (const key of keysToClear) {
    localStorage.removeItem(key);
  }
    })();
  }
  return migrationPromise;
}
