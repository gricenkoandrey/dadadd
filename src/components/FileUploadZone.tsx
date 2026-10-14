import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, ShieldCheck, Clock, Sparkles, CheckCircle2, FileText, X } from 'lucide-react';

interface FileUploadZoneProps {
  onFileUpload: (skudFile: File, absencesFile: File | null) => void;
  onRunSample: () => void;
  isLoading: boolean;
  error: string | null;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileUpload,
  onRunSample,
  isLoading,
  error,
}) => {
  const [skudFile, setSkudFile] = useState<File | null>(null);
  const [absencesFile, setAbsencesFile] = useState<File | null>(null);

  const skudInputRef = useRef<HTMLInputElement>(null);
  const absencesInputRef = useRef<HTMLInputElement>(null);

  const handleProcess = () => {
    if (skudFile) {
      onFileUpload(skudFile, absencesFile);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4">
      {/* Title Banner */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200/80 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>СКУД Система Учета Рабочего Времени</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Автоматическая обработка отчетов турникетов
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Загрузите первичный файл Excel из системы СКУД и, опционально, файл отпусков из 1С для расчета смен и отсутствий.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* SKUD File Drop Area */}
        <div
          onClick={() => !isLoading && skudInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 shadow-sm flex flex-col items-center justify-center ${
            skudFile
              ? 'border-emerald-500 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
              : 'border-slate-300 hover:border-emerald-400 bg-white hover:bg-slate-50/70'
          } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={skudInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setSkudFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className={`p-3 rounded-full mb-3 ${skudFile ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className={`text-sm font-bold ${skudFile ? 'text-emerald-700' : 'text-slate-700'}`}>
            1. Основной отчет СКУД
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[250px] truncate">
            {skudFile ? skudFile.name : 'Выберите .xlsx файл (Обязательно)'}
          </p>
          {skudFile && !isLoading && (
            <button
              onClick={(e) => { e.stopPropagation(); setSkudFile(null); }}
              className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1C Absences File Drop Area */}
        <div
          onClick={() => !isLoading && absencesInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 shadow-sm flex flex-col items-center justify-center ${
            absencesFile
              ? 'border-indigo-500 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/20'
              : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/70'
          } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={absencesInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setAbsencesFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className={`p-3 rounded-full mb-3 ${absencesFile ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
            <FileText className="w-8 h-8" />
          </div>
          <h3 className={`text-sm font-bold ${absencesFile ? 'text-indigo-700' : 'text-slate-700'}`}>
            2. Отсутствия (1С)
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[250px] truncate">
            {absencesFile ? absencesFile.name : 'Загрузите файл отпусков (Опционально)'}
          </p>
          {absencesFile && !isLoading && (
            <button
              onClick={(e) => { e.stopPropagation(); setAbsencesFile(null); }}
              className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4">
        <button
          type="button"
          disabled={!skudFile || isLoading}
          onClick={handleProcess}
          className="w-full max-w-md px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-900/10 transition-all flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span>{isLoading ? 'Обработка данных...' : 'Сформировать итоговый отчет'}</span>
        </button>
        
        {!isLoading && (
          <button
            type="button"
            onClick={onRunSample}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center space-x-1.5 transition-colors group"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
            <span>Запустить на демо-данных</span>
          </button>
        )}

        {error && (
          <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2 text-left w-full max-w-md shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Feature Value Cards */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3 hover:border-slate-300 transition-colors">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Умная идентификация смен</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Распределение на дневные, вечерние и ночные смены по первому входу на турникете.
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3 hover:border-slate-300 transition-colors">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">100% точность формата Excel</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Генерация файла с формулами `=SUM()`, зебра-стилями и шапкой 1-в-1.
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-start space-x-3 hover:border-slate-300 transition-colors">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Учет отпусков из 1С</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Отпуска и командировки автоматически исключаются из числа нарушений.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
