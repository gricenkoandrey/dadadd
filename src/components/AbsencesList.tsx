import React, { useState, useRef } from 'react';
import { AbsenceRecord } from '../types';
import {
  FileText,
  Calendar,
  Info,
  Search,
  Upload,
  ClipboardPaste,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { parseAbsencesBuffer, parseAbsencesFromText } from '../lib/excelProcessor';

interface AbsencesListProps {
  absencesList: AbsenceRecord[];
  onUpdateAbsences?: (records: AbsenceRecord[]) => void;
}

export const AbsencesList: React.FC<AbsencesListProps> = ({
  absencesList,
  onUpdateAbsences,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseAbsencesBuffer(buffer);
      if (parsed.length === 0) {
        setMessage({
          text: 'В файле не найдено строк с отпусками или сотрудниками. Попробуйте скопировать таблицу и вставить текст.',
          type: 'error',
        });
      } else {
        setMessage({
          text: `Успешно загружено ${parsed.length} записей об отпусках!`,
          type: 'success',
        });
        if (onUpdateAbsences) {
          onUpdateAbsences(parsed);
        }
      }
    } catch (e: any) {
      setMessage({
        text: 'Ошибка при чтении файла: ' + e.message,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    try {
      const parsed = parseAbsencesFromText(pasteText);
      if (parsed.length === 0) {
        setMessage({
          text: 'Не удалось распознать формат строк. Убедитесь, что скопированы строки с ФИО, видом отпуска и датами.',
          type: 'error',
        });
      } else {
        setMessage({
          text: `Успешно распознано ${parsed.length} записей из буфера!`,
          type: 'success',
        });
        if (onUpdateAbsences) {
          // Merge with existing or replace
          onUpdateAbsences([...absencesList, ...parsed]);
        }
        setIsPasteOpen(false);
        setPasteText('');
      }
    } catch (e: any) {
      setMessage({
        text: 'Ошибка при разборе текста: ' + e.message,
        type: 'error',
      });
    }
  };

  const filtered = absencesList.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.fio.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q) ||
      (a.organization && a.organization.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />

      {/* Header bar */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shadow-2xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Реестр отпусков и отсутствий (1С)
              </h2>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {absencesList.length} записей
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Сотрудники в отпуске освобождаются от штрафов за неявку в табеле рабочего времени
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl shadow-2xs transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Загрузка...' : 'Загрузить .xlsx из 1С'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasteOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-all"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
            <span>Вставить текст из 1С</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {message && (
        <div
          className={`p-3.5 mx-6 mt-4 rounded-xl text-xs flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Paste Modal */}
      {isPasteOpen && (
        <div className="p-5 mx-6 mt-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ClipboardPaste className="w-4 h-4 text-indigo-700" />
              <h4 className="text-xs font-bold text-indigo-900">
                Вставка таблицы отпусков напрямую из буфера обмена (Ctrl+V)
              </h4>
            </div>
            <button
              onClick={() => setIsPasteOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-600 leading-normal">
            Выделите строки в отчете 1С или Excel (ФИО, вид отсутствия, даты с / до) и вставьте в
            поле ниже:
          </p>
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Рысова Айнур Амиржановна\tОтпуск по уходу за ребенком\t824\t5\t05.06.2024\tпредположительно до 01.03.2027 0:00:00\nМурзагулова Гулдана Кулгалиевна\tОтпуск по уходу за ребенком\t519\t5\t06.04.2025\tпредположительно до 01.01.2028 0:00:00`}
            className="w-full p-3 text-xs font-mono border border-indigo-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsPasteOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handlePasteSubmit}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Распознать и добавить
            </button>
          </div>
        </div>
      )}

      {/* Search & Empty state */}
      {absencesList.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100 shadow-xs">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            Файл отпусков из 1С еще не загружен
          </h3>
          <p className="text-slate-500 max-w-md text-xs mb-6">
            Загрузите отчет отпусков в формате .xlsx или скопируйте таблицу прямо из 1С. Все
            сотрудники будут сопоставлены с данными СКУД, а в их табелях автоматически отобразится
            причина неявки без начисления штрафов.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/10 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Выбрать файл Excel из 1С</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPasteOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <ClipboardPaste className="w-4 h-4 text-slate-500" />
              <span>Вставить из буфера</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search Toolbar */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200/80 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по ФИО, организации или причине..."
                className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Показано: <span className="font-bold text-slate-800">{filtered.length}</span> из{' '}
              {absencesList.length}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-600 uppercase bg-slate-100/90 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold text-center w-12">№</th>
                  <th className="py-3 px-4 font-bold">Организация</th>
                  <th className="py-3 px-4 font-bold">Сотрудник</th>
                  <th className="py-3 px-4 font-bold">Вид отсутствия</th>
                  <th className="py-3 px-4 font-bold">Период</th>
                  <th className="py-3 px-4 font-bold text-center">Кален. дни</th>
                  <th className="py-3 px-4 font-bold text-center">Раб. дни</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((absence, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{absence.organization || 'ТОО "Жигермунайсервис"'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {absence.fio}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/80">
                        {absence.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {absence.startDateStr} — {absence.endDateStr}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {absence.calendarDays ?? '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {absence.workDays ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
