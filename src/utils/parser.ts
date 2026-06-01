import JSZip from 'jszip';

export interface ParsedMetadata {
  filename: string;
  fileSize: number;
  printTimeMinutes: number;
  printTimeString: string;
  filamentWeightGrams: number;
  layerHeightMm: number;
  filamentDensity: number;
  filamentDiameter: number;
  filamentChanges: number;
  modifiedDate: string;
  thumbnailUrl?: string; // Optional embedded thumbnail base64
  plateIndex?: number;
  plateName?: string;
}

// Helper to convert time strings (e.g., "1d 8h 29m 45s", "7h 42m", "45m") to minutes
export function parseTimeStringToMinutes(timeStr: string): number {
  let minutes = 0;
  
  const dayMatch = timeStr.match(/(\d+)\s*d/);
  const hourMatch = timeStr.match(/(\d+)\s*h/);
  const minMatch = timeStr.match(/(\d+)\s*m/);
  const secMatch = timeStr.match(/(\d+)\s*s/);

  if (dayMatch) minutes += parseInt(dayMatch[1], 10) * 24 * 60;
  if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += parseInt(minMatch[1], 10);
  if (secMatch && !minMatch && !hourMatch && !dayMatch) {
    // If it only has seconds, round up to 1 minute
    minutes += 1;
  }
  
  return minutes;
}

// Scans G-code text for metadata comments and returns ParsedMetadata
function parseGcodeText(
  gcodeText: string,
  filename: string,
  fileSize: number,
  modifiedDate: string,
  thumbnailUrl?: string,
  plateIndex?: number,
  plateName?: string
): ParsedMetadata {
  const lines = gcodeText.split('\n');
  
  let printTimeMinutes = 0;
  let filamentWeightGrams = 0;
  let layerHeightMm = 0.20; // Default layer height fallback
  let filamentDensity = 1.24; // Default PLA density fallback
  let filamentDiameter = 1.75;
  let filamentChanges = 0;

  // Extract lines to scan: first 3000 lines (header) and last 3000 lines (footer)
  const linesToScan: string[] = [];
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

    // Parse estimated print times
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
    
    // Fallback: ; print_time = 5021 (seconds) or ; print_time: 5021
    if (lowerLine.includes('print_time') && (line.includes('=') || line.includes(':'))) {
      const secMatch = line.match(/(?::|=)\s*(\d+)/);
      if (secMatch) {
        const secs = parseInt(secMatch[1], 10);
        if (secs > 0) printTimeMinutes = Math.round(secs / 60);
      }
    }

    // Parse filament weight
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

    // Parse filament volume fallback
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

    // Parse filament density
    if (line.includes('filament_density') || line.includes('filament density')) {
      const densityMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (densityMatch) {
        filamentDensity = parseFloat(densityMatch[1]);
      }
    }

    // Parse filament diameter
    if (line.includes('filament_diameter') || line.includes('filament diameter')) {
      const diaMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (diaMatch) {
        filamentDiameter = parseFloat(diaMatch[1]);
      }
    }

    // Parse layer height
    if (line.includes('layer_height') || line.includes('layer height')) {
      const layerMatch = line.match(/(?::|=)\s*(\d+\.?\d*)/);
      if (layerMatch) {
        layerHeightMm = parseFloat(layerMatch[1]);
      }
    }

    // Parse filament changes count
    if (line.includes('filament changes') || line.includes('filament change')) {
      const changeMatch = line.match(/(?::|=)\s*(\d+)/);
      if (changeMatch) {
        filamentChanges = parseInt(changeMatch[1], 10);
      }
    }
  }

  // Fallback if filament weight is not found directly but we have filament length
  if (filamentWeightGrams === 0) {
    for (let i = 0; i < linesToScan.length; i++) {
      const line = linesToScan[i].trim();
      if (!line.startsWith(';')) continue;
      
      if (line.includes('filament used') && (line.includes('[mm]') || line.includes('mm'))) {
        const valPart = line.split(/(?::|=)/)[1];
        if (valPart) {
          const numbers = valPart.match(/(\d+\.?\d*)/g);
          if (numbers && numbers.length > 0) {
            const lengthMm = numbers.reduce((acc, numStr) => acc + parseFloat(numStr), 0);
            const radiusMm = filamentDiameter / 2;
            const volumeMm3 = Math.PI * Math.pow(radiusMm, 2) * lengthMm;
            const volumeCm3 = volumeMm3 / 1000;
            filamentWeightGrams = Math.round(volumeCm3 * filamentDensity * 10) / 10;
            break;
          }
        }
      }
    }
  }

  // Format print time string
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
    printTimeMinutes = 60; // fallback 1 hour
  }

  if (filamentWeightGrams === 0) {
    filamentWeightGrams = 150.0; // fallback 150g
  }

  // Rounded values
  filamentWeightGrams = Math.round(filamentWeightGrams * 10) / 10;

  // Clean filename for plate display
  let displayFilename = filename;
  const basename = filename.split('/').pop() || filename;
  if (plateName) {
    displayFilename = `${basename} (${plateName})`;
  }

  return {
    filename: displayFilename,
    fileSize: Math.round((fileSize / (1024 * 1024)) * 10) / 10, // MB
    printTimeMinutes,
    printTimeString,
    filamentWeightGrams,
    layerHeightMm,
    filamentDensity,
    filamentDiameter,
    filamentChanges,
    modifiedDate,
    thumbnailUrl,
    plateIndex,
    plateName,
  };
}

// Main parser function - returns list of parsed plates
export async function parsePrintFile(file: File): Promise<ParsedMetadata[]> {
  const isZip = file.name.toLowerCase().endsWith('.3mf') || file.name.toLowerCase().endsWith('.gcode.3mf');
  const modifiedDate = new Date(file.lastModified).toLocaleString();

  if (isZip) {
    // Unzip .3mf file
    const zip = await JSZip.loadAsync(file);
    
    // Find all files ending in .gcode inside the zip
    const gcodeEntryKeys = Object.keys(zip.files).filter(
      (name) => name.toLowerCase().endsWith('.gcode')
    );

    if (gcodeEntryKeys.length === 0) {
      throw new Error(
        'This .3mf file does not contain sliced G-Code. Please slice your model and export the sliced file (.gcode or .gcode.3mf) from your slicer first.'
      );
    }

    // Sort alphabetically so plate_1.gcode is parsed first, then plate_2, etc.
    gcodeEntryKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const results: ParsedMetadata[] = [];

    for (let index = 0; index < gcodeEntryKeys.length; index++) {
      const gcodeEntryKey = gcodeEntryKeys[index];
      const gcodeText = await zip.files[gcodeEntryKey].async('string');

      // Look for a plate number in the selected G-code filename to match thumbnail
      let thumbnailUrl: string | undefined = undefined;
      let thumbnailEntryKey: string | undefined = undefined;

      const plateMatch = gcodeEntryKey.match(/plate_(\d+)/i);
      const plateNum = plateMatch ? plateMatch[1] : (index + 1).toString();
      const plateName = `Plate ${plateNum}`;

      thumbnailEntryKey = Object.keys(zip.files).find(
        (name) => name.startsWith('Metadata/') && 
                  (name.endsWith(`plate_${plateNum}.png`) || 
                   name.endsWith(`plate_no_light_${plateNum}.png`) || 
                   name.includes(`pick_${plateNum}`))
      );

      // Fallback: search for any PNG/pick image in Metadata/ if no plate number match
      if (!thumbnailEntryKey) {
        thumbnailEntryKey = Object.keys(zip.files).find(
          (name) => name.startsWith('Metadata/') && (name.endsWith('.png') || name.includes('pick_'))
        );
      }

      if (thumbnailEntryKey) {
        const imgBlob = await zip.files[thumbnailEntryKey].async('blob');
        thumbnailUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imgBlob);
        });
      }

      const plateMetadata = parseGcodeText(
        gcodeText,
        file.name,
        file.size,
        modifiedDate,
        thumbnailUrl,
        index,
        plateName
      );
      results.push(plateMetadata);
    }

    return results;
  } else {
    // For plain G-code, slice the file to read the first 512KB and last 512KB
    const size = file.size;
    let gcodeText = '';
    if (size <= 1024 * 1024) {
      gcodeText = await file.text();
    } else {
      const headerBlob = file.slice(0, 512 * 1024);
      const footerBlob = file.slice(size - 512 * 1024, size);
      const headerText = await headerBlob.text();
      const footerText = await footerBlob.text();
      gcodeText = headerText + '\n\n' + footerText;
    }

    const metadata = parseGcodeText(gcodeText, file.name, size, modifiedDate);
    return [metadata];
  }
}
