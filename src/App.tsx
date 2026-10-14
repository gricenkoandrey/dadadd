import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FileUploadZone } from './components/FileUploadZone';
import { SummaryMetricsCards } from './components/SummaryMetricsCards';
import { AttendanceTableView } from './components/AttendanceTableView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { AbsenceRecord, CompanyConfig, ProcessedReportResult } from './types';
import {
  processExcelBuffer,
  parseAbsencesBuffer,
  generateExcelReportBuffer,
  createSampleInputExcelBuffer,
  recalculateReportWithCompany,
  matchesFio,
  minsToTimeStr,
} from './lib/excelProcessor';
import {
  DEFAULT_COMPANIES,
  loadSavedCompanies,
  saveCompanies,
  loadActiveCompanyId,
  saveActiveCompanyId,
} from './lib/companyDefaults';
import { updateReportRecord } from './lib/reportUpdater';
import { AbsencesList } from './components/AbsencesList';
import {
  BarChart3,
  Table as TableIcon,
  Download,
  Building2,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';

export default function App() {
  const [companies, setCompanies] = useState<CompanyConfig[]>(() => loadSavedCompanies());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => loadActiveCompanyId());
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<ProcessedReportResult | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'analytics' | 'absences'>('table');
  const [storedSkudBuffer, setStoredSkudBuffer] = useState<ArrayBuffer | null>(null);

  // Active company config
  const activeCompany =
    companies.find((c) => c.id === selectedCompanyId) ||
    companies.find((c) => c.isDefault) ||
    companies[0] ||
    DEFAULT_COMPANIES[0];

  // Save companies and selection to localStorage
  useEffect(() => {
    saveCompanies(companies);
  }, [companies]);

  useEffect(() => {
    saveActiveCompanyId(selectedCompanyId);
  }, [selectedCompanyId]);

  // Handle company change from selector or modal
  const handleSelectCompany = async (id: string) => {
    setSelectedCompanyId(id);
    if (storedSkudBuffer && report) {
      try {
        const comp = companies.find((c) => c.id === id) || companies[0];
        const updated = await processExcelBuffer(
          storedSkudBuffer,
          comp,
          report.absencesList || [],
          companies,
          id
        );
        setReport(updated);
        return;
      } catch (e) {
        console.warn('Error reprocessing SKUD buffer on company change:', e);
      }
    }
    if (report) {
      const updated = recalculateReportWithCompany(report, companies, id);
      setReport(updated);
    }
  };

  const handleSaveCompanies = async (newCompanies: CompanyConfig[], newActiveId: string) => {
    setCompanies(newCompanies);
    setSelectedCompanyId(newActiveId);
    saveCompanies(newCompanies);
    saveActiveCompanyId(newActiveId);

    if (storedSkudBuffer && report) {
      try {
        const activeComp = newCompanies.find((c) => c.id === newActiveId) || newCompanies[0];
        const updated = await processExcelBuffer(
          storedSkudBuffer,
          activeComp,
          report.absencesList || [],
          newCompanies,
          newActiveId
        );
        setReport(updated);
        return;
      } catch (e) {
        console.warn('Error reprocessing SKUD buffer on settings save:', e);
      }
    }

    if (report) {
      const updated = recalculateReportWithCompany(report, newCompanies, newActiveId);
      setReport(updated);
    }
  };

  const handleUpdateRecord = (
    groupIndex: number,
    recordIndex: number,
    firstInStr: string,
    lastOutStr: string
  ) => {
    if (report) {
      const updatedReport = updateReportRecord(
        report,
        groupIndex,
        recordIndex,
        firstInStr,
        lastOutStr,
        activeCompany
      );
      setReport(updatedReport);
    }
  };

  // Handle file upload and process client-side
  const handleFileUpload = async (skudFile: File, absencesFile?: File | null) => {
    setIsLoading(true);
    setError(null);

    try {
      let absencesData: AbsenceRecord[] = [];
      if (absencesFile) {
        const absBuffer = await absencesFile.arrayBuffer();
        absencesData = await parseAbsencesBuffer(absBuffer);
      }
      const buffer = await skudFile.arrayBuffer();
      setStoredSkudBuffer(buffer);

      const reportResult = await processExcelBuffer(
        buffer,
        activeCompany,
        absencesData,
        companies,
        selectedCompanyId
      );
      setReport(reportResult);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Произошла ошибка при загрузке и обработке файла.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle updating or adding absences inside the report view
  const handleUpdateAbsences = async (newAbsences: AbsenceRecord[]) => {
    if (!report) return;

    if (storedSkudBuffer) {
      setIsLoading(true);
      try {
        const reportResult = await processExcelBuffer(
          storedSkudBuffer,
          activeCompany,
          newAbsences,
          companies,
          selectedCompanyId
        );
        setReport(reportResult);
      } catch (e: any) {
        console.error('Error reprocessing with new absences', e);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Re-apply absences to existing records
      const cloned = JSON.parse(JSON.stringify(report)) as ProcessedReportResult;
      cloned.absencesList = newAbsences;

      for (const group of cloned.employeeGroups) {
        for (const rec of group.dailyRecords) {
          const recDate = new Date(rec.rawDate).getTime();
          const found = newAbsences.find(
            (a) =>
              matchesFio(a.fio, group.employee.fio) &&
              recDate >= new Date(a.startDate).getTime() &&
              recDate <= new Date(a.endDate).getTime()
          );
          if (found) {
            rec.isAbsent = true;
            rec.absenceReason = found.reason;
            rec.note = found.reason;
            rec.hasViolation = false;
            rec.isLate = false;
            rec.isEarlyExit = false;
            rec.lateMins = 0;
            rec.earlyMins = 0;
            rec.totalViolationMins = 0;
            rec.totalViolationTimeStr = '';
            rec.firstInStr = found.reason;
            rec.lastOutStr = found.reason;
          }
        }
      }
      const recalculated = recalculateReportWithCompany(cloned, companies, selectedCompanyId);
      setReport(recalculated);
    }
  };

  // Run sample demo file client-side
  const handleRunSample = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sampleBuffer = await createSampleInputExcelBuffer();
      setStoredSkudBuffer(sampleBuffer);
      const reportResult = await processExcelBuffer(
        sampleBuffer,
        activeCompany,
        [],
        companies,
        selectedCompanyId
      );
      setReport(reportResult);
    } catch (err: any) {
      console.error('Error processing sample:', err);
      setError(err.message || 'Ошибка обработки образца.');
    } finally {
      setIsLoading(false);
    }
  };

  // Download raw sample input file
  const handleDownloadSample = async () => {
    try {
      const buffer = await createSampleInputExcelBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asdasda_2_2.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error generating sample:', err);
      alert('Ошибка при генерации файла: ' + err.message);
    }
  };

  // Download processed formatted Excel file
  const handleDownloadExcel = async () => {
    if (report) {
      try {
        const buffer = await generateExcelReportBuffer(report);
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err: any) {
        console.error('Error downloading excel:', err);
        alert('Ошибка при генерации итогового файла: ' + err.message);
      }
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setStoredSkudBuffer(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/80 font-sans text-slate-900 flex flex-col antialiased">
      {/* Top Navigation with Company Selector */}
      <Navbar
        onOpenSettings={() => setIsCompanySettingsOpen(true)}
        onDownloadSample={handleDownloadSample}
        onReset={handleReset}
        hasReport={!!report}
        formattedPeriod={report?.formattedPeriod}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={handleSelectCompany}
        onOpenCompanySettings={() => setIsCompanySettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!report ? (
          /* File Upload State */
          <div className="space-y-6">
            <FileUploadZone
              onFileUpload={handleFileUpload}
              onRunSample={handleRunSample}
              isLoading={isLoading}
              error={error}
            />
          </div>
        ) : (
          /* Processed Report Display */
          <div className="space-y-6">
            {/* Top Metrics Cards */}
            <SummaryMetricsCards report={report} onDownloadExcel={handleDownloadExcel} />

            {/* Active Norms & Access Points Banner */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/70">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Действующие нормы и точки доступа:
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Смена: {minsToTimeStr(activeCompany.dayStartMins)} – {minsToTimeStr(activeCompany.dayEndMins)}
                    </span>
                    <span>•</span>
                    <span>
                      Допуск: опоздание {activeCompany.gracePeriodLateMins ?? 15} мин / уход {activeCompany.gracePeriodEarlyMins ?? 15} мин
                    </span>
                    <span>•</span>
                    <span>
                      Обед: {minsToTimeStr(activeCompany.lunchWindowStartMins ?? 11 * 60)} – {minsToTimeStr(activeCompany.lunchWindowEndMins ?? 15 * 60)}
                    </span>
                    <span>•</span>
                    <span>
                      Рабочие дни: {activeCompany.workDays?.length ? `${activeCompany.workDays.length} дн/нед` : '5-дневка (Пн-Пт)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCompanySettingsOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all self-start sm:self-auto shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>Точки доступа и нормы времени</span>
              </button>
            </div>

            {/* View Tabs Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/90 pb-3 gap-3">
              <div className="inline-flex flex-wrap bg-slate-200/80 p-1.5 rounded-2xl gap-1.5 border border-slate-300/60 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'table'
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-950/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <TableIcon className="w-4 h-4 text-emerald-400" />
                  <span>1. Таблица Учета (СКУД)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-950/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>2. Аналитика Нарушений</span>
                </button>

                {/* 3rd Tab: Always accessible */}
                <button
                  type="button"
                  onClick={() => setActiveTab('absences')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'absences'
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-950/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>3. Отпуска (1С)</span>
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'absences'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {report.absencesList?.length || 0}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadExcel}
                className="hidden sm:inline-flex items-center space-x-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl border border-emerald-200/80 shadow-xs transition-all"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Загрузить итоговый .xlsx</span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'table' && (
              <AttendanceTableView
                employeeGroups={report.employeeGroups}
                notesText={report.notesText}
                onUpdateRecord={handleUpdateRecord}
              />
            )}

            {activeTab === 'analytics' && <AnalyticsPanel report={report} />}

            {activeTab === 'absences' && (
              <AbsencesList
                absencesList={report.absencesList || []}
                onUpdateAbsences={handleUpdateAbsences}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-5 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-600">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>
              © {new Date().getFullYear()} СКУД Аналитик Pro • Автоматизированный учет рабочего времени
            </span>
          </div>
          <span className="text-slate-400 font-mono">
            Точки доступа и нормы • Отпуска 1С • Экспорт Excel OpenPyXL 1-в-1
          </span>
        </div>
      </footer>

      {/* Multi-Company Configuration Modal */}
      <CompanySettingsModal
        isOpen={isCompanySettingsOpen}
        onClose={() => setIsCompanySettingsOpen(false)}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSaveCompanies={handleSaveCompanies}
        discoveredAccessPoints={report?.discoveredAccessPoints || []}
      />
    </div>
  );
}
