export interface ShiftConfig {
  dayStartMins: number; // default 8*60+30 = 510 (08:30)
  dayEndMins: number;   // default 17*60+30 = 1050 (17:30)
  eveningStartMins: number; // default 17*60 = 1020 (17:00)
  eveningEndMins: number;   // default 24*60 = 1440 (24:00)
  nightStartMins: number;   // default 21*60 = 1260 (21:00)
  nightEndMins: number;     // default 6*60 + 24*60 = 1800 (06:00 next day)
  thresholdEveningMins: number; // default 14*60 = 840 (14:00)
  thresholdNightMins: number;   // default 21*60 = 1260 (21:00)
  lunchWindowStartMins: number; // default 12*60 = 720 (12:00)
  lunchWindowEndMins: number;   // default 14*60 = 840 (14:00)
  lunchFixedEndMins: number;    // default 13*60+30 = 810 (13:30)
}

export type AccessPointRole = 'turnstile' | 'canteen' | 'dormitory'; // проходная (вход/выход), столовая (обед), общежитие (не учитывается)

export interface AccessPointConfig {
  id: string;
  name: string;
  role: AccessPointRole;
  enabled: boolean; // включение в расчёт
  passCount?: number;
}

export interface CompanyConfig extends ShiftConfig {
  id: string;
  name: string;
  departmentMatch?: string; // keywords to auto-match company or department from Sigur/1C
  isDefault?: boolean;

  // Time norms and violation rules ("выбирать время и тд нарушение")
  gracePeriodLateMins: number; // Допуск на опоздание, мин (default 15)
  gracePeriodEarlyMins: number; // Допуск на ранний уход, мин (default 15)
  workDays?: number[]; // Рабочие дни недели: [1, 2, 3, 4, 5] (1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб, 0=Вс)
  accessPoints?: AccessPointConfig[]; // Точки доступа: роль и включение в расчёт

  countMissingInAsViolation?: boolean;
  countMissingOutAsViolation?: boolean;
  countWeekendViolations?: boolean;
  workWeekType?: '5days' | '6days' | 'shift';
}

export interface AbsenceRecord {
  fio: string;
  reason: string;
  organization?: string;
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  calendarDays?: number;
  workDays?: number;
}

export interface RawPassRecord {
  date: string;
  department: string;
  fio: string;
  tabNum: string;
  position: string;
  time: string;
  accessPoint: string;
  direction: 'вход' | 'выход' | string;
}

export interface EmployeeInfo {
  fio: string;
  position: string;
  tabNum?: string;
  department?: string;
  companyId?: string;
  companyName?: string;
}

export interface DailyAttendanceRecord {
  dateStr: string; // YYYY-MM-DD or 'суббота' / 'воскресенье'
  rawDate: string; // YYYY-MM-DD
  isWeekend: boolean;
  dayOfWeekStr: string; // e.g. "понедельник", "суббота"
  
  isAbsent?: boolean;
  absenceReason?: string;

  firstInMins: number; // -1 if missing
  firstInStr: string; // '08:35' or 'нет входа'
  lastOutMins: number; // -1 if missing
  lastOutCorrMins: number; // corrected for next day if applicable
  lastOutStr: string; // '17:30' or 'нет выхода'
  
  lunchStartStr: string; // '12:15' or ''
  lunchEndStr: string;   // '13:30' or ''
  
  lateMins: number;
  earlyMins: number;
  totalViolationMins: number;
  totalViolationTimeStr: string; // '00:15:00' or ''
  
  isLate: boolean;
  isEarlyExit: boolean;
  hasViolation: boolean;
  missingIn: boolean;
  missingOut: boolean;
  note: string;
}

export interface EmployeeReportGroup {
  index: number; // 1, 2, 3...
  employee: EmployeeInfo;
  dailyRecords: DailyAttendanceRecord[];
  
  totalViolationsCount: number;
  totalViolationMinutes: number;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
  missingPunchDays: number;
}

export interface ProcessedReportResult {
  filename: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  formattedPeriod: string; // e.g. "16.03.2024 - 31.03.2024"
  
  employeeGroups: EmployeeReportGroup[];
  absencesList: AbsenceRecord[];
  
  summaryMetrics: {
    totalEmployees: number;
    totalDays: number;
    totalViolations: number;
    totalLateEvents: number;
    totalEarlyEvents: number;
    totalMissingPunches: number;
    totalLunchBreaksLogged: number;
    totalViolationMinutes: number;
  };
  shiftConfig: ShiftConfig;
  companyConfig?: CompanyConfig;
  allCompanies?: CompanyConfig[];
  selectedCompanyId?: string;
  discoveredAccessPoints?: AccessPointConfig[];
  notesText: string[];
}
