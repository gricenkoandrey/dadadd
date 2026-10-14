import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { CompanyConfig, AccessPointConfig, AccessPointRole } from '../types';
import { minsToTimeStr } from '../lib/excelProcessor';
import { DEFAULT_COMPANIES } from '../lib/companyDefaults';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyConfig[];
  selectedCompanyId?: string;
  onSaveCompanies: (newCompanies: CompanyConfig[], activeId: string) => void;
  discoveredAccessPoints?: AccessPointConfig[];
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Пн', name: 'Понедельник' },
  { id: 2, label: 'Вт', name: 'Вторник' },
  { id: 3, label: 'Ср', name: 'Среда' },
  { id: 4, label: 'Чт', name: 'Четверг' },
  { id: 5, label: 'Пт', name: 'Пятница' },
  { id: 6, label: 'Сб', name: 'Суббота' },
  { id: 0, label: 'Вс', name: 'Воскресенье' },
];

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedCompanyId,
  onSaveCompanies,
  discoveredAccessPoints = [],
}) => {
  const currentBase =
    companies.find((c) => c.id === selectedCompanyId) ||
    companies[0] ||
    DEFAULT_COMPANIES[0];

  const [currentConfig, setCurrentConfig] = useState<CompanyConfig>(() =>
    JSON.parse(JSON.stringify(currentBase))
  );

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentConfig(JSON.parse(JSON.stringify(currentBase)));
    }
  }, [isOpen, currentBase]);

  if (!isOpen) return null;

  const timeStrToMins = (timeStr: string, fallback: number): number => {
    if (!timeStr) return fallback;
    const parts = timeStr.split(':');
    if (parts.length < 2) return fallback;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return fallback;
    return h * 60 + m;
  };

  const updateConfig = (patch: Partial<CompanyConfig>) => {
    setCurrentConfig((prev) => ({ ...prev, ...patch }));
  };

  // Merge discovered access points from uploaded SKUD file
  const effectivePoints: AccessPointConfig[] = (() => {
    const compPoints = currentConfig.accessPoints || [];
    if (discoveredAccessPoints.length === 0) {
      return compPoints;
    }
    const merged = [...compPoints];
    for (const dp of discoveredAccessPoints) {
      const existing = merged.find((p) => p.name === dp.name || p.id === dp.id);
      if (!existing) {
        merged.push({ ...dp });
      } else if (dp.passCount && !existing.passCount) {
        existing.passCount = dp.passCount;
      }
    }
    return merged;
  })();

  const updateAccessPoint = (name: string, patch: Partial<AccessPointConfig>) => {
    const updated = effectivePoints.map((p) =>
      p.name === name || p.id === name ? { ...p, ...patch } : p
    );
    updateConfig({ accessPoints: updated });
  };

  const handleSelectAllPoints = (enabled: boolean) => {
    const updated = effectivePoints.map((p) => ({ ...p, enabled }));
    updateConfig({ accessPoints: updated });
  };

  const toggleWorkDay = (dayId: number) => {
    const currentDays = currentConfig.workDays || [1, 2, 3, 4, 5];
    let nextDays: number[];
    if (currentDays.includes(dayId)) {
      if (currentDays.length === 1) return; // Keep at least 1 day
      nextDays = currentDays.filter((d) => d !== dayId);
    } else {
      nextDays = [...currentDays, dayId];
    }
    updateConfig({ workDays: nextDays });
  };

  const handleResetDefaults = () => {
    updateConfig({
      dayStartMins: 8 * 60, // 08:00
      dayEndMins: 17 * 60, // 17:00
      gracePeriodLateMins: 15, // 15
      gracePeriodEarlyMins: 15, // 15
      lunchWindowStartMins: 11 * 60, // 11:00
      lunchWindowEndMins: 15 * 60, // 15:00
      workDays: [1, 2, 3, 4, 5],
      accessPoints: DEFAULT_COMPANIES[0].accessPoints || [],
    });
  };

  const handleSave = () => {
    const updatedAll = companies.map((c) =>
      c.id === currentConfig.id ? currentConfig : { ...c, ...currentConfig, id: c.id, name: c.name }
    );
    onSaveCompanies(updatedAll, currentConfig.id);
    onClose();
  };

  const currentWorkDays = currentConfig.workDays || [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Точки доступа и нормы времени
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors text-2xl font-light leading-none"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* 1. Section: Точки доступа: роль и включение в расчёт */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Точки доступа: роль и включение в расчёт
              </h3>
              {effectivePoints.length > 0 && (
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectAllPoints(true)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2 py-1 rounded-md transition-colors"
                  >
                    Отметить все
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllPoints(false)}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-md transition-colors"
                  >
                    Снять все
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Снимите галочку у точки, чтобы полностью исключить её проходы из расчёта Входа/Выхода/Обеда и из выгрузки. Роль определяет, как используется точка: проходная (вход/выход), столовая (обед) или общежитие (не учитывается).
            </p>

            {effectivePoints.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-500 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Точки доступа не найдены — сначала загрузите файл выгрузки СКУД.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {effectivePoints.map((point) => (
                  <div
                    key={point.name}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border text-xs gap-2 transition-all ${
                      point.enabled !== false
                        ? 'bg-white border-slate-200/90 shadow-2xs'
                        : 'bg-slate-50 border-slate-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={point.enabled !== false}
                        onChange={(e) =>
                          updateAccessPoint(point.name, { enabled: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 truncate block">
                          {point.name}
                        </span>
                        {point.passCount !== undefined && (
                          <span className="text-[10px] text-slate-400">
                            {point.passCount} проходов
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sm:shrink-0 flex items-center space-x-1.5 self-end sm:self-center">
                      <select
                        value={point.role || 'turnstile'}
                        disabled={point.enabled === false}
                        onChange={(e) =>
                          updateAccessPoint(point.name, {
                            role: e.target.value as AccessPointRole,
                          })
                        }
                        className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="turnstile">Проходная (вход/выход)</option>
                        <option value="canteen">Столовая (обед)</option>
                        <option value="dormitory">Общежитие (не учитывается)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Section: Норма рабочего дня */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Норма рабочего дня
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Начало смены
                </label>
                <input
                  type="time"
                  value={minsToTimeStr(currentConfig.dayStartMins)}
                  onChange={(e) =>
                    updateConfig({
                      dayStartMins: timeStrToMins(e.target.value, 8 * 60),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Конец смены
                </label>
                <input
                  type="time"
                  value={minsToTimeStr(currentConfig.dayEndMins)}
                  onChange={(e) =>
                    updateConfig({
                      dayEndMins: timeStrToMins(e.target.value, 17 * 60),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Допуск на опоздание, мин
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={currentConfig.gracePeriodLateMins ?? 15}
                  onChange={(e) =>
                    updateConfig({
                      gracePeriodLateMins: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Допуск на ранний уход, мин
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={currentConfig.gracePeriodEarlyMins ?? 15}
                  onChange={(e) =>
                    updateConfig({
                      gracePeriodEarlyMins: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Section: Окно обеда (для точки «Столовая») */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Окно обеда (для точки «Столовая»)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  С
                </label>
                <input
                  type="time"
                  value={minsToTimeStr(currentConfig.lunchWindowStartMins)}
                  onChange={(e) =>
                    updateConfig({
                      lunchWindowStartMins: timeStrToMins(e.target.value, 11 * 60),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  По
                </label>
                <input
                  type="time"
                  value={minsToTimeStr(currentConfig.lunchWindowEndMins)}
                  onChange={(e) =>
                    updateConfig({
                      lunchWindowEndMins: timeStrToMins(e.target.value, 15 * 60),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* 4. Section: Рабочие дни недели */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Рабочие дни недели
            </h3>

            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isActive = currentWorkDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWorkDay(day.id)}
                    className={`flex-1 min-w-[42px] py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200'
                    }`}
                    title={day.name}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить по умолчанию</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить и применить</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
