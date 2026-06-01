import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, FileText, Clock, Scale } from 'lucide-react';
import type { ParsedMetadata } from '../utils/parser';

interface PlateSelectorProps {
  isOpen: boolean;
  plates: ParsedMetadata[];
  onConfirm: (selected: ParsedMetadata[]) => void;
  onCancel: () => void;
}

export default function PlateSelector({ isOpen, plates, onConfirm, onCancel }: PlateSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    plates.map((_, i) => i) // Default select all
  );

  if (!isOpen) return null;

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleConfirm = () => {
    const selected = plates.filter((_, i) => selectedIndices.includes(i));
    onConfirm(selected);
  };

  const selectAll = () => {
    setSelectedIndices(plates.map((_, i) => i));
  };

  const selectNone = () => {
    setSelectedIndices([]);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] relative z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Multi-Plate File Detected</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                We found {plates.length} printable plates in this file. Select which plates to import.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
            <div className="flex justify-end gap-3 text-[10px] font-bold text-slate-400">
              <button onClick={selectAll} className="hover:text-brand-orange transition-colors">
                SELECT ALL
              </button>
              <span>•</span>
              <button onClick={selectNone} className="hover:text-brand-orange transition-colors">
                SELECT NONE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plates.map((plate, index) => {
                const isSelected = selectedIndices.includes(index);
                return (
                  <div
                    key={index}
                    onClick={() => toggleSelect(index)}
                    className={`border rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-brand-orange bg-brand-orange/5 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-brand-orange border-brand-orange text-white'
                              : 'border-slate-350 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="font-extrabold text-slate-800 text-sm truncate">
                          {plate.plateName || `Plate ${index + 1}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4 items-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center p-2 border border-slate-100 shrink-0">
                        {plate.thumbnailUrl ? (
                          <img
                            alt="Plate Preview"
                            className="object-contain w-full h-full drop-shadow-sm"
                            src={plate.thumbnailUrl}
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-300 stroke-1" />
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-650 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <Scale className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-extrabold text-slate-800">
                            {plate.filamentWeightGrams} g
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-700">{plate.printTimeString}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate">
                          {plate.filamentChanges} swaps • {plate.layerHeightMm.toFixed(2)}mm
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={selectedIndices.length === 0}
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange/90 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              Import Selected ({selectedIndices.length})
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
