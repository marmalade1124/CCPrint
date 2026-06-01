import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import mqtt from 'mqtt';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Map of PrinterConnection instances keyed by serial number
const printers = new Map();

class PrinterConnection {
  constructor(config) {
    this.config = config; // { ip, serial, accessCode, name }
    this.mqttClient = null;
    this.connectionStatus = 'offline'; // 'offline', 'connecting', 'online'
    this.lastTelemetry = null;
    
    // Mock simulation state
    this.mockInterval = null;
    this.mockPercent = 0;
    this.mockRemainingMinutes = 45;
    this.mockIsPrinting = false;
    this.mockFilename = '';
  }

  connect() {
    this.disconnect();
    
    this.connectionStatus = 'connecting';
    broadcast({ type: 'status', serial: this.config.serial, status: 'connecting' });
    console.log(`Connecting to Bambu Printer [${this.config.name}] at mqtts://${this.config.ip}:8883...`);

    try {
      this.mqttClient = mqtt.connect(`mqtts://${this.config.ip}:8883`, {
        username: 'bblp',
        password: this.config.accessCode,
        rejectUnauthorized: false, // self-signed cert on printer
        protocolVersion: 4, // MQTT 3.1.1
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      this.mqttClient.on('connect', () => {
        console.log(`Connected to Bambu Printer [${this.config.name}] MQTT broker!`);
        this.connectionStatus = 'online';
        broadcast({ type: 'status', serial: this.config.serial, status: 'online' });

        const topic = `device/${this.config.serial}/report`;
        this.mqttClient.subscribe(topic, (err) => {
          if (err) {
            console.error(`[${this.config.name}] Subscription error:`, err);
          } else {
            console.log(`[${this.config.name}] Subscribed to topic: ${topic}`);
            // Send request to trigger an immediate status report
            const requestTopic = `device/${this.config.serial}/request`;
            const requestPayload = JSON.stringify({
              pushing: {
                sequence_id: "1",
                command: "pushall"
              }
            });
            this.mqttClient.publish(requestTopic, requestPayload);
          }
        });
      });

      this.mqttClient.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (!this.lastTelemetry) {
            this.lastTelemetry = {};
          }
          if (payload.print) {
            this.lastTelemetry.print = {
              ...(this.lastTelemetry.print || {}),
              ...payload.print
            };
          }
          for (const key of Object.keys(payload)) {
            if (key !== 'print') {
              this.lastTelemetry[key] = payload[key];
            }
          }
          broadcast({
            type: 'telemetry',
            serial: this.config.serial,
            source: 'printer',
            data: this.lastTelemetry
          });
        } catch (err) {
          console.error(`[${this.config.name}] Error parsing MQTT payload:`, err);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.error(`[${this.config.name}] MQTT error:`, err);
        this.connectionStatus = 'offline';
        broadcast({ type: 'status', serial: this.config.serial, status: 'offline', error: err.message });
      });

      this.mqttClient.on('close', () => {
        console.log(`[${this.config.name}] MQTT connection closed.`);
        this.connectionStatus = 'offline';
        broadcast({ type: 'status', serial: this.config.serial, status: 'offline' });
      });
    } catch (err) {
      console.error(`[${this.config.name}] Failed to initialize MQTT client:`, err);
      this.connectionStatus = 'offline';
      broadcast({ type: 'status', serial: this.config.serial, status: 'offline', error: err.message });
    }
  }

  disconnect() {
    this.stopSimulation();
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
    this.connectionStatus = 'offline';
    broadcast({ type: 'status', serial: this.config.serial, status: 'offline' });
  }

  startSimulation(filename) {
    this.stopSimulation();
    console.log(`[${this.config.name}] Starting mock print simulation for: ${filename}`);
    
    // If it was offline, make it online for simulation
    if (this.connectionStatus !== 'online') {
      this.connectionStatus = 'online';
      broadcast({ type: 'status', serial: this.config.serial, status: 'online' });
    }

    this.mockFilename = filename;
    this.mockPercent = 0;
    this.mockRemainingMinutes = 45;
    this.mockIsPrinting = true;

    this.mockInterval = setInterval(() => {
      if (this.mockPercent < 100) {
        this.mockPercent += 5; // increment progress
        this.mockRemainingMinutes = Math.max(0, Math.round(45 * (1 - this.mockPercent / 100)));
        
        const nozzleTemp = this.mockPercent < 95 ? 220 + Math.random() * 2 - 1 : 150 - (this.mockPercent - 95) * 20;
        const bedTemp = this.mockPercent < 95 ? 60 + Math.random() * 0.5 - 0.25 : 45 - (this.mockPercent - 95) * 3;
        
        const payload = {
          print: {
            gcode_state: this.mockPercent < 100 ? 'RUNNING' : 'FINISH',
            mc_percent: this.mockPercent,
            mc_remaining_time: this.mockRemainingMinutes,
            nozzle_temper: Math.round(nozzleTemp),
            nozzle_target_temper: this.mockPercent < 95 ? 220 : 0,
            bed_temper: Math.round(bedTemp),
            bed_target_temper: this.mockPercent < 95 ? 60 : 0,
            chamber_temper: 35,
            subtask_name: this.mockFilename,
          }
        };

        this.lastTelemetry = payload;
        broadcast({
          type: 'telemetry',
          serial: this.config.serial,
          source: 'mock',
          data: payload
        });
      } else {
        this.stopSimulation();
        console.log(`[${this.config.name}] Mock print simulation finished.`);
      }
    }, 3000);
  }

  stopSimulation() {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    this.mockIsPrinting = false;
  }

  async printFile(filename) {
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filename} not found in uploads.`);
    }

    console.log(`[${this.config.name}] Starting FTPS upload of ${filename} to ftp://${this.config.ip}:990/ ...`);
    
    const ip = this.config.ip;
    const accessCode = this.config.accessCode;
    const { execFile } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const args = [
        '--ftp-pasv',
        '--insecure',
        '-u',
        `bblp:${accessCode}`,
        '-T',
        filePath,
        `ftps://${ip}:990/${encodeURIComponent(filename)}`
      ];
      
      execFile('curl', args, (error, stdout, stderr) => {
        if (error) {
          console.error(`[${this.config.name}] FTPS upload failed:`, stderr || error.message);
          return reject(new Error(`FTPS upload failed: ${stderr || error.message}`));
        }
        
        console.log(`[${this.config.name}] FTPS upload complete! Triggering print job via MQTT...`);
        
        const topic = `device/${this.config.serial}/request`;
        const payload = {
          print: {
            sequence_id: Math.floor(Math.random() * 100000).toString(),
            command: "project_file",
            param: "Metadata/slice_info.json",
            subtask_name: filename,
            url: `file:///sdcard/${encodeURIComponent(filename)}`,
            md5: "",
            timelapse: false,
            bed_leveling: true,
            flow_cali: false,
            vibration_cali: false
          }
        };

        if (this.mqttClient && this.connectionStatus === 'online') {
          this.mqttClient.publish(topic, JSON.stringify(payload), (err) => {
            if (err) {
              console.error(`[${this.config.name}] Failed to publish start print MQTT command:`, err);
              return reject(new Error(`Failed to send start print command over MQTT.`));
            }
            console.log(`[${this.config.name}] MQTT start print command published successfully.`);
            resolve({ success: true, message: 'Print job started successfully.' });
          });
        } else {
          reject(new Error("Printer is offline or MQTT client is not connected."));
        }
      });
    });
  }
}

// Helper to broadcast to all WebSocket clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Sync Printer Connections
function syncPrinters(configs) {
  const newSerials = new Set(configs.map(c => c.serial));

  // 1. Remove deleted printers
  for (const [serial, printer] of printers.entries()) {
    if (!newSerials.has(serial)) {
      console.log(`Removing printer: ${printer.config.name} (${serial})`);
      printer.disconnect();
      printers.delete(serial);
    }
  }

  // 2. Add or update printers
  for (const config of configs) {
    const existing = printers.get(config.serial);
    if (existing) {
      // Check if config changed
      const ipChanged = existing.config.ip !== config.ip;
      const codeChanged = existing.config.accessCode !== config.accessCode;
      const nameChanged = existing.config.name !== config.name;

      existing.config = config; // update reference

      if (ipChanged || codeChanged) {
        console.log(`Configuration changed for printer: ${config.name} (${config.serial}). Reconnecting...`);
        existing.connect();
      } else if (nameChanged) {
        console.log(`Renamed printer ${config.serial} to ${config.name}`);
      }
    } else {
      console.log(`Adding new printer: ${config.name} (${config.serial})`);
      const newPrinter = new PrinterConnection(config);
      printers.set(config.serial, newPrinter);
      newPrinter.connect();
    }
  }
}

// Setup folder for uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// G-code / ZIP Parsing Utilities for Slicer Uploads
function parseTimeStringToMinutes(timeStr) {
  let minutes = 0;
  const dayMatch = timeStr.match(/(\d+)\s*d/);
  const hourMatch = timeStr.match(/(\d+)\s*h/);
  const minMatch = timeStr.match(/(\d+)\s*m/);
  const secMatch = timeStr.match(/(\d+)\s*s/);
  if (dayMatch) minutes += parseInt(dayMatch[1], 10) * 24 * 60;
  if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += parseInt(minMatch[1], 10);
  if (secMatch && !minMatch && !hourMatch && !dayMatch) minutes += 1;
  return minutes;
}

async function parseLocalFile(filePath, filename, stats) {
  const isZip = filename.toLowerCase().endsWith('.3mf') || filename.toLowerCase().endsWith('.gcode.3mf');
  let gcodeText = '';
  
  if (isZip) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const gcodeEntryKeys = Object.keys(zip.files).filter(
      (name) => name.toLowerCase().endsWith('.gcode')
    );
    if (gcodeEntryKeys.length === 0) return null;
    gcodeEntryKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    gcodeText = await zip.files[gcodeEntryKeys[0]].async('string');
  } else {
    const size = stats.size;
    if (size <= 1024 * 1024) {
      gcodeText = fs.readFileSync(filePath, 'utf8');
    } else {
      const fd = fs.openSync(filePath, 'r');
      const headerBuf = Buffer.alloc(512 * 1024);
      const footerBuf = Buffer.alloc(512 * 1024);
      fs.readSync(fd, headerBuf, 0, 512 * 1024, 0);
      fs.readSync(fd, footerBuf, 0, 512 * 1024, size - 512 * 1024);
      gcodeText = headerBuf.toString('utf8') + '\n\n' + footerBuf.toString('utf8');
      fs.closeSync(fd);
    }
  }

  const lines = gcodeText.split('\n');
  let printTimeMinutes = 0;
  let filamentWeightGrams = 0;
  let layerHeightMm = 0.20;
  let filamentDensity = 1.24;
  let filamentDiameter = 1.75;
  let filamentChanges = 0;

  const linesToScan = [];
  const headerLimit = Math.min(lines.length, 3000);
  for (let i = 0; i < headerLimit; i++) {
    linesToScan.push(lines[i]);
  }
  if (lines.length > 3000) {
    const startIdx = Math.max(3000, lines.length - 3000);
    for (let i = startIdx; i < lines.length; i++) {
      linesToScan.push(lines[i]);
    }
  }

  for (let i = 0; i < linesToScan.length; i++) {
    const line = linesToScan[i].trim();
    if (!line.startsWith(';')) continue;

    const lowerLine = line.toLowerCase();

    // Print Time
    if (
      (lowerLine.includes('printing time') || lowerLine.includes('print time') || lowerLine.includes('estimated time') || lowerLine.includes('estimated print')) &&
      !lowerLine.includes('first layer') &&
      !lowerLine.includes('first_layer') &&
      !lowerLine.includes('prepare')
    ) {
      const timeValMatch = line.match(/(?::|=)\s*([0-9a-zA-Z\s]+)$/);
      if (timeValMatch) {
        const parsedMins = parseTimeStringToMinutes(timeValMatch[1]);
        if (parsedMins > 0) printTimeMinutes = parsedMins;
      }
    }
    if (lowerLine.includes('print_time') && (line.includes('=') || line.includes(':'))) {
      const secMatch = line.match(/(?::|=)\s*(\d+)/);
      if (secMatch) {
        const secs = parseInt(secMatch[1], 10);
        if (secs > 0) printTimeMinutes = Math.round(secs / 60);
      }
    }

    // Filament Weight
    const isWeightLine = 
      lowerLine.includes('filament_used_g') || 
      lowerLine.includes('filament_weight_g') || 
      lowerLine.includes('filament weight') || 
      lowerLine.includes('filament used') ||
      (lowerLine.includes('filament') && (
        lowerLine.includes('weight') || 
        lowerLine.includes('used') || 
        lowerLine.includes('[g]') || 
        /\d+\.?\d*\s*g\b/.test(lowerLine)
      ));

    if (
      isWeightLine &&
      !lowerLine.includes('gcode') &&
      !lowerLine.includes('settings') &&
      !lowerLine.includes('config')
    ) {
      if (!lowerLine.includes('_m') && !lowerLine.includes('volume') && !lowerLine.includes('[mm]') && !lowerLine.includes(' length')) {
        const valPart = line.split(/(?::|=)/)[1];
        if (valPart) {
          const numbers = valPart.match(/(\d+\.?\d*)/g);
          if (numbers && numbers.length > 0) {
            const sum = numbers.reduce((acc, numStr) => acc + parseFloat(numStr), 0);
            if (sum > 0) filamentWeightGrams = sum;
          }
        }
      }
    }

    // Volume fallback
    if (lowerLine.includes('filament volume') && (lowerLine.includes('cm^3') || lowerLine.includes('cm3'))) {
      const valPart = line.split(/(?::|=)/)[1];
      if (valPart) {
        const numbers = valPart.match(/(\d+\.?\d*)/g);
        if (numbers && numbers.length > 0) {
          const volumeCm3 = numbers.reduce((acc, numStr) => acc + parseFloat(numStr), 0);
          filamentWeightGrams = volumeCm3 * filamentDensity;
        }
      }
    }

    // Settings
    if (lowerLine.includes('filament_density') || lowerLine.includes('filament density')) {
      const densityMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (densityMatch) filamentDensity = parseFloat(densityMatch[1]);
    }
    if (lowerLine.includes('filament_diameter') || lowerLine.includes('filament diameter')) {
      const diaMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (diaMatch) filamentDiameter = parseFloat(diaMatch[1]);
    }
    if (lowerLine.includes('layer_height') || lowerLine.includes('layer height')) {
      const layerMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (layerMatch) layerHeightMm = parseFloat(layerMatch[1]);
    }
    if (lowerLine.includes('filament changes') || lowerLine.includes('filament change')) {
      const changeMatch = line.match(/(?::|=)\s*(\d+)/);
      if (changeMatch) filamentChanges = parseInt(changeMatch[1], 10);
    }
  }

  // Length fallback
  if (filamentWeightGrams === 0) {
    for (let i = 0; i < linesToScan.length; i++) {
      const line = linesToScan[i].trim();
      if (!line.startsWith(';')) continue;
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('filament used') && (lowerLine.includes('[mm]') || lowerLine.includes('mm'))) {
        const valPart = line.split(/(?::|=)/)[1];
        if (valPart) {
          const numbers = valPart.match(/(\d+\.?\d*)/g);
          if (numbers && numbers.length > 0) {
            const lengthMm = numbers.reduce((acc, numStr) => acc + parseFloat(numStr), 0);
            const radiusMm = filamentDiameter / 2;
            const volumeMm3 = Math.PI * Math.pow(radiusMm, 2) * lengthMm;
            const volumeCm3 = volumeMm3 / 1000;
            filamentWeightGrams = volumeCm3 * filamentDensity;
            break;
          }
        }
      }
    }
  }

  let printTimeString = '';
  if (printTimeMinutes > 0) {
    const d = Math.floor(printTimeMinutes / (24 * 60));
    const h = Math.floor((printTimeMinutes % (24 * 60)) / 60);
    const m = printTimeMinutes % 60;
    if (d > 0) printTimeString += `${d}d `;
    if (h > 0 || d > 0) printTimeString += `${h}h `;
    printTimeString += `${m}m`;
  } else {
    printTimeString = 'Unknown';
    printTimeMinutes = 60;
  }

  if (filamentWeightGrams === 0) {
    filamentWeightGrams = 150.0;
  }
  filamentWeightGrams = Math.round(filamentWeightGrams * 10) / 10;

  return {
    filename,
    fileSize: Math.round((stats.size / (1024 * 1024)) * 10) / 10,
    printTimeMinutes,
    printTimeString,
    filamentWeightGrams,
    layerHeightMm,
    filamentDensity,
    filamentDiameter,
    filamentChanges,
    modifiedDate: new Date(stats.mtime).toLocaleString(),
  };
}

// OctoPrint Mock REST Endpoints
app.get('/api/version', (req, res) => {
  res.json({
    api: "0.1",
    server: "1.9.0",
    text: "OctoPrint (CCprint Virtual)"
  });
});

app.get('/api/connection', (req, res) => {
  res.json({
    current: {
      state: "Operational",
      port: "VIRTUAL",
      baudrate: 115200,
      printerProfile: "_default"
    }
  });
});

app.post('/api/job', (req, res) => {
  console.log('Received print job command from slicer:', req.body);
  res.status(204).send();
});

app.post('/api/files/local', upload.single('file'), async (req, res) => {
  console.log('Received G-code upload from slicer...');
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const filename = req.file.originalname;

  try {
    const stats = fs.statSync(filePath);
    const metadata = await parseLocalFile(filePath, filename, stats);
    if (metadata) {
      console.log(`Successfully parsed metadata: ${metadata.filamentWeightGrams}g, ${metadata.printTimeString}`);
      broadcast({
        type: 'slicer_upload',
        metadata
      });
      res.status(201).json({
        files: {
          local: {
            name: filename,
            path: filename,
            type: 'model',
            size: stats.size
          }
        },
        done: true
      });
    } else {
      res.status(422).json({ error: 'Could not parse G-code metadata' });
    }
  } catch (err) {
    console.error('Error processing slicer file:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST Endpoints
app.post('/api/printers/sync', (req, res) => {
  const { printers: configs } = req.body;
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: 'Printers list must be an array' });
  }

  syncPrinters(configs);
  res.json({ message: 'Printers synchronized successfully' });
});

app.post('/api/printer/connect', (req, res) => {
  const { ip, serial, accessCode, name } = req.body;
  if (!ip || !serial || !accessCode || !name) {
    return res.status(400).json({ error: 'Missing printer config fields' });
  }

  let printer = printers.get(serial);
  if (printer) {
    printer.config = { ip, serial, accessCode, name };
  } else {
    printer = new PrinterConnection({ ip, serial, accessCode, name });
    printers.set(serial, printer);
  }

  printer.connect();
  res.json({ message: 'Attempting connection', serial });
});

app.post('/api/printer/disconnect', (req, res) => {
  const { serial } = req.body;
  const printer = printers.get(serial);
  if (printer) {
    printer.disconnect();
    res.json({ message: 'Disconnected printer', serial });
  } else {
    res.status(404).json({ error: 'Printer not found' });
  }
});

app.post('/api/printer/mock/start', (req, res) => {
  const { serial, filename } = req.body;
  const printer = printers.get(serial);
  if (printer) {
    printer.startSimulation(filename || 'mock_model.gcode');
    res.json({ message: 'Simulation started', serial });
  } else {
    res.status(404).json({ error: 'Printer not found' });
  }
});

app.post('/api/printer/mock/stop', (req, res) => {
  const { serial } = req.body;
  const printer = printers.get(serial);
  if (printer) {
    printer.stopSimulation();
    res.json({ message: 'Simulation stopped', serial });
  } else {
    res.status(404).json({ error: 'Printer not found' });
  }
});

app.post('/api/printer/print', async (req, res) => {
  const { serial, filename } = req.body;
  const printer = printers.get(serial);
  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    const result = await printer.printFile(filename);
    res.json(result);
  } catch (err) {
    console.error('Failed to start real print:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/printers/status', (req, res) => {
  const statusList = Array.from(printers.values()).map(p => ({
    serial: p.config.serial,
    name: p.config.name,
    ip: p.config.ip,
    status: p.connectionStatus,
    lastTelemetry: p.lastTelemetry,
  }));
  res.json(statusList);
});

// Setup WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket client connected to PrintCC backend');
  
  // Send current status of all printers immediately
  const bulkStatus = Array.from(printers.values()).map(p => ({
    serial: p.config.serial,
    name: p.config.name,
    ip: p.config.ip,
    status: p.connectionStatus,
    lastTelemetry: p.lastTelemetry
  }));

  ws.send(JSON.stringify({
    type: 'bulk_status',
    printers: bulkStatus
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`PrintCC backend proxy listening on http://localhost:${PORT}`);
});
