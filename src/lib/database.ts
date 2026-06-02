import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:ccprint.db');
  }
  return dbInstance;
}

export async function initDb(): Promise<Database> {
  const db = await getDb();

  // Create Settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Create Customers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      notes TEXT,
      date_added TEXT
    );
  `);

  // Create Printers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT,
      serial TEXT UNIQUE,
      access_code TEXT
    );
  `);

  // Create Filament Spools table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS spools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      material TEXT,
      color_name TEXT,
      color_hex TEXT,
      cost REAL DEFAULT 0,
      initial_weight REAL DEFAULT 0,
      weight_left REAL DEFAULT 0,
      low_weight_threshold REAL DEFAULT 50
    );
  `);

  // Create Filament Logs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS filament_logs (
      id TEXT PRIMARY KEY,
      spool_id TEXT,
      spool_name TEXT,
      job_title TEXT,
      grams REAL,
      type TEXT,
      date TEXT
    );
  `);

  // Create Failures table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS failures (
      id TEXT PRIMARY KEY,
      job_title TEXT,
      client TEXT,
      spool_id TEXT,
      spool_name TEXT,
      wasted_grams REAL,
      wasted_cost REAL,
      wasted_time_minutes INTEGER,
      failure_percent REAL,
      date TEXT
    );
  `);

  // Create Jobs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client TEXT,
      weight REAL DEFAULT 0,
      print_time_minutes INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      filename TEXT,
      status TEXT DEFAULT 'Pending Quote',
      progress REAL,
      remaining_time_minutes REAL,
      date_created TEXT,
      spool_id TEXT,
      filament_deducted INTEGER DEFAULT 0,
      plate_index INTEGER,
      plate_name TEXT,
      completed_at TEXT,
      printer_serial TEXT,
      printer_name TEXT,
      started_at TEXT
    );
  `);

  // Create Print History table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS print_history (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      job_title TEXT,
      client TEXT,
      filename TEXT,
      weight_grams REAL,
      print_time_minutes INTEGER,
      price REAL,
      spool_id TEXT,
      spool_name TEXT,
      printer_serial TEXT,
      printer_name TEXT,
      status TEXT,
      started_at TEXT,
      completed_at TEXT,
      plate_index INTEGER,
      plate_name TEXT
    );
  `);

  // Create Notifications table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      message TEXT,
      type TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT,
      action_type TEXT,
      action_payload TEXT
    );
  `);

  // Database schema migration fallbacks
  try {
    await db.execute("ALTER TABLE jobs ADD COLUMN started_at TEXT");
  } catch (e) {
    // Ignore: column already exists
  }

  return db;
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings");
  await db.execute("DELETE FROM customers");
  await db.execute("DELETE FROM printers");
  await db.execute("DELETE FROM spools");
  await db.execute("DELETE FROM filament_logs");
  await db.execute("DELETE FROM failures");
  await db.execute("DELETE FROM jobs");
  await db.execute("DELETE FROM print_history");
  await db.execute("DELETE FROM notifications");
}
