import React, { useState } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Clock,
  Calendar,
  Building,
  UserCheck,
  FileText,
  Filter,
  Edit2,
  Check,
} from 'lucide-react';
import { EmployeeReportGroup, DailyAttendanceRecord } from '../types';

interface AttendanceTableViewProps {
  employeeGroups: EmployeeReportGroup[];
  notesText: string[];
  onUpdateRecord?: (groupIndex: number, recordIndex: number, firstInStr: string, lastOutStr: string) => void;
}

export const AttendanceTableView: React.FC<AttendanceTableViewProps> = ({
  employeeGroups,
  notesText,
  onUpdateRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'violations' | 'missing'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  const [editingRecord, setEditingRecord] = useState<{groupIndex: number, recordIndex: number} | null>(null);
  const [editFirstIn, setEditFirstIn] = useState('');
  const [editLastOut, setEditLastOut] = useState('');

  // Toggle group expansion
  const toggleGroup = (index: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    employeeGroups.forEach((g) => {
      all[g.index] = true;
    });
    setExpandedGroups(all);
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  // Filter employee groups
  const filteredGroups = employeeGroups.filter((group) => {
    const matchesSearch =
      group.employee.fio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.employee.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.employee.department &&
        group.employee.department.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterMode === 'violations') {
      return group.totalViolationsCount > 0;
    }
    if (filterMode === 'missing') {
      return group.missingPunchDays > 0;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-8">
      {/* Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Field */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по ФИО, должности или отделу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-slate-300/80 rounded-xl bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters and Accordion Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все ({employeeGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('violations')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                filterMode === 'violations'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Нарушители</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('missing')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'missing'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Пропуски отметок
            </button>
          </div>
          <div className="flex space-x-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Раскрыть все
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Свернуть все
            </button>
          </div>
        </div>
      </div>
      
      {/* Help Banner */}
      <div className="bg-indigo-50/70 border-y border-indigo-100 px-4 py-2.5 flex items-center justify-center space-x-2 text-xs text-indigo-700 font-medium">
        <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
        <span>Вы можете вручную редактировать время прихода и ухода в таблице.</span>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white font-bold tracking-tight divide-x divide-slate-800">
              <th className="py-3 px-3 text-center w-12 text-slate-400 font-mono">№</th>
              <th className="py-3 px-4 min-w-[200px]">Сотрудник ФИО</th>
              <th className="py-3 px-4 min-w-[180px]">Должность</th>
              <th className="py-3 px-3 text-center w-28">Дата</th>
              <th className="py-3 px-3 text-center w-28">Вход (СКУД)</th>
              <th className="py-3 px-3 text-center w-28">Выход (СКУД)</th>
              <th className="py-3 px-3 text-center min-w-[120px]">Обед с</th>
              <th className="py-3 px-3 text-center min-w-[120px]">Обед по</th>
              <th className="py-3 px-4 text-center min-w-[180px]">
                Итог опозданий / уходов
              </th>
              <th className="py-3 px-4 min-w-[160px]">Примечание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80">
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <UserCheck className="w-8 h-8 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">Сотрудники по выбранным критериям не найдены</p>
                    <p className="text-[11px] text-slate-400">Попробуйте изменить поисковый запрос или сбросить фильтры</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredGroups.map((group) => {
                const isExpanded = !!expandedGroups[group.index];
                return (
                  <React.Fragment key={group.index}>
                    {/* Employee Header Summary Row */}
                    <tr
                      onClick={() => toggleGroup(group.index)}
                      className="bg-slate-100/95 hover:bg-slate-200/90 cursor-pointer transition-colors font-semibold border-t-2 border-slate-300 divide-x divide-slate-200/80"
                    >
                      <td className="py-3 px-3 text-center text-slate-700 font-mono font-bold">
                        {group.index}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 text-slate-700 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="truncate max-w-[220px] sm:max-w-none">{group.employee.fio}</span>
                        {group.totalViolationsCount > 0 && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-200/80 shrink-0">
                            {group.totalViolationsCount} нар.
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-semibold text-slate-800">
                          {group.employee.position && group.employee.position !== '—'
                            ? group.employee.position
                            : (group.employee.companyName || group.employee.department || '—')}
                        </div>
                        {(group.employee.companyName || group.employee.department) && (
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{group.employee.companyName || group.employee.department}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                      <td className="py-3 px-3 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-700 bg-rose-50/60">
                        {group.totalViolationMinutes > 0
                          ? `Итого (${group.totalViolationsCount} дн.)`
                          : '00:00:00'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">—</td>
                    </tr>

                    {/* Detailed Daily Rows */}
                    {isExpanded &&
                      group.dailyRecords.map((record, rIdx) => {
                        const isEven = rIdx % 2 === 0;
                        const isEditing = editingRecord?.groupIndex === group.index && editingRecord?.recordIndex === rIdx;
                        
                        return (
                          <tr
                            key={record.rawDate}
                            className={`group divide-x divide-slate-200/80 transition-colors ${
                              isEditing ? 'bg-indigo-50/50 shadow-inner' : isEven ? 'bg-slate-50/40 hover:bg-slate-100/70' : 'bg-white hover:bg-slate-100/70'
                            } ${record.isWeekend && !isEditing ? 'text-slate-400 bg-slate-100/50' : ''}`}
                          >
                            <td className="py-2.5 px-3 text-center text-slate-300 font-mono"></td>
                            <td className="py-2.5 px-4 text-slate-600 pl-9 font-medium">{group.employee.fio}</td>
                            <td className="py-2.5 px-4 text-slate-500">
                              {group.employee.position && group.employee.position !== '—'
                                ? group.employee.position
                                : (group.employee.companyName || group.employee.department || '—')}
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-slate-800">
                              {record.dateStr}
                            </td>

                            {/* Start Time Column */}
                            <td
                              className={`py-2.5 px-3 text-center font-mono ${
                                record.isLate && !isEditing
                                  ? 'font-extrabold text-rose-700 bg-rose-100/70 border-l-2 border-l-rose-500'
                                  : record.missingIn && !isEditing
                                  ? 'text-slate-400 italic'
                                  : record.isAbsent
                                  ? 'text-indigo-600 italic text-[11px]'
                                  : 'text-slate-800'
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFirstIn}
                                  placeholder="09:00"
                                  onChange={(e) => setEditFirstIn(e.target.value)}
                                  className="w-16 text-center bg-white border border-indigo-300 rounded-md shadow-sm px-1.5 py-1 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition-all font-semibold"
                                  title="Формат времени: ЧЧ:ММ"
                                />
                              ) : (
                                record.firstInStr
                              )}
                            </td>

                            {/* End Time Column */}
                            <td
                              className={`py-2.5 px-3 text-center font-mono ${
                                record.isEarlyExit && !isEditing
                                  ? 'font-extrabold text-rose-700 bg-rose-100/70 border-l-2 border-l-rose-500'
                                  : record.missingOut && !isEditing
                                  ? 'text-slate-400 italic'
                                  : record.isAbsent
                                  ? 'text-indigo-600 italic text-[11px]'
                                  : 'text-slate-800'
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editLastOut}
                                  placeholder="18:00"
                                  onChange={(e) => setEditLastOut(e.target.value)}
                                  className="w-16 text-center bg-white border border-indigo-300 rounded-md shadow-sm px-1.5 py-1 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition-all font-semibold"
                                  title="Формат времени: ЧЧ:ММ"
                                />
                              ) : (
                                record.lastOutStr
                              )}
                            </td>

                            {/* Lunch Start */}
                            <td className="py-2.5 px-3 text-center font-mono text-emerald-800 font-semibold bg-emerald-50/30">
                              {record.lunchStartStr || '—'}
                            </td>

                            {/* Lunch End */}
                            <td className="py-2.5 px-3 text-center font-mono text-emerald-800 font-semibold bg-emerald-50/30">
                              {record.lunchEndStr || '—'}
                            </td>

                            {/* Total Violation Duration */}
                            <td
                              className={`py-2.5 px-4 text-center font-mono font-black ${
                                record.totalViolationTimeStr
                                  ? 'text-rose-700 bg-rose-100/80'
                                  : 'text-slate-300'
                              }`}
                            >
                              {record.totalViolationTimeStr || ''}
                            </td>

                            {/* Note / Reason & Actions */}
                            <td className="py-2.5 px-4 text-slate-600 font-medium">
                              <div className="flex items-center justify-between">
                                <span>{record.isAbsent ? <span className="inline-flex items-center space-x-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"><FileText className="w-3 h-3 mr-1" />{record.absenceReason}</span> : record.note}</span>
                                {isEditing ? (
                                  <div className="flex space-x-1.5">
                                    <button
                                      onClick={() => {
                                        if (onUpdateRecord) {
                                          onUpdateRecord(group.index, rIdx, editFirstIn, editLastOut);
                                        }
                                        setEditingRecord(null);
                                      }}
                                      className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
                                      title="Сохранить изменения"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingRecord(null)}
                                      className="p-1.5 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-800 shadow-sm transition-all"
                                      title="Отменить"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingRecord({ groupIndex: group.index, recordIndex: rIdx });
                                      setEditFirstIn(record.firstInStr);
                                      setEditLastOut(record.lastOutStr);
                                    }}
                                    className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                                    title="Редактировать время"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Trailing Executive Notes Section */}
      <div className="p-6 bg-slate-900 text-slate-300 border-t border-slate-800 space-y-3">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">
            Официальные примечания к отчету (Заполняются ответственным лицом)
          </h4>
        </div>
        <ul className="list-disc list-inside text-xs space-y-1.5 text-slate-300 font-sans leading-relaxed pl-1">
          {notesText.map((line, idx) => (
            <li key={idx} className="text-slate-300">{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

