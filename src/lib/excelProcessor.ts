import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  ShiftConfig,
  CompanyConfig,
  RawPassRecord,
  EmployeeInfo,
  DailyAttendanceRecord,
  EmployeeReportGroup,
  ProcessedReportResult,
  AbsenceRecord,
  AccessPointConfig,
  AccessPointRole,
} from '../types';
import { DEFAULT_COMPANIES } from './companyDefaults';

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  dayStartMins: 8 * 60,      // 08:00 (Начало смены)
  dayEndMins: 17 * 60,      // 17:00 (Конец смены)
  eveningStartMins: 17 * 60, // 17:00
  eveningEndMins: 24 * 60,   // 24:00
  nightStartMins: 21 * 60,   // 21:00
  nightEndMins: 6 * 60 + 24 * 60, // 06:00 next day
  thresholdEveningMins: 14 * 60, // 14:00
  thresholdNightMins: 21 * 60,   // 21:00
  lunchWindowStartMins: 11 * 60, // 11:00 (Окно обеда С)
  lunchWindowEndMins: 15 * 60,   // 15:00 (Окно обеда По)
  lunchFixedEndMins: 12 * 60,    // 12:00
};

// Helper to format minutes to HH:MM
export function minsToTimeStr(mins: number): string {
  if (mins === undefined || mins === null || mins === -1 || isNaN(mins)) {
    return '';
  }
  let displayMin = mins;
  if (mins >= 24 * 60) {
    displayMin = mins - 24 * 60;
  }
  const h = Math.floor(displayMin / 60);
  const m = Math.floor(displayMin % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper to format total violation minutes to HH:MM:00
export function minsToDurationStr(totalMins: number | null | undefined): string {
  if (!totalMins || totalMins <= 0 || isNaN(totalMins)) {
    return '';
  }
  const total = Math.floor(totalMins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

// Format date YYYY-MM-DD
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date DD.MM.YYYY
export function formatDateRU(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Parse string or cell value to DD.MM.YYYY Date
export function parseDateStr(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  const str = String(val).trim();
  if (!str) return null;

  // Try extracting DD.MM.YYYY from string
  const matchDots = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (matchDots) {
    const day = parseInt(matchDots[1], 10);
    const month = parseInt(matchDots[2], 10) - 1;
    const year = parseInt(matchDots[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  // Try YYYY-MM-DD
  const matchDashes = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchDashes) {
    const year = parseInt(matchDashes[1], 10);
    const month = parseInt(matchDashes[2], 10) - 1;
    const day = parseInt(matchDashes[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

// Normalize employee name for robust matching across systems
export function normalizeFio(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[«»""'']/g, '')
    .replace(/\s*\([^)]*\)/g, '') // remove parenthetical notes like "(." or "(водители)"
    .replace(/[\(\.\,\-_]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

// Fuzzy matching between Sigur name (e.g. "Рысова А.А." or "Рысова Айнур") and 1C name ("Рысова Айнур Амиржановна")
export function matchesFio(fio1: string, fio2: string): boolean {
  if (!fio1 || !fio2) return false;
  const n1 = normalizeFio(fio1);
  const n2 = normalizeFio(fio2);
  if (n1 === n2) return true;
  if (n1.length > 3 && n2.length > 3 && (n1.includes(n2) || n2.includes(n1))) return true;

  const parts1 = n1.split(' ').filter(Boolean);
  const parts2 = n2.split(' ').filter(Boolean);
  if (parts1.length === 0 || parts2.length === 0) return false;

  // Surname comparison (first token)
  const surname1 = parts1[0];
  const surname2 = parts2[0];
  if (surname1 !== surname2) {
    // Check if one contains the other (e.g. slight suffix differences in Kazakh/Russian transliteration)
    if (surname1.length >= 4 && surname2.length >= 4) {
      if (!surname1.startsWith(surname2.slice(0, 4)) && !surname2.startsWith(surname1.slice(0, 4))) {
        return false;
      }
    } else {
      return false;
    }
  }

  // If both have first name or initials
  if (parts1.length > 1 && parts2.length > 1) {
    const firstInitial1 = parts1[1][0];
    const firstInitial2 = parts2[1][0];
    if (firstInitial1 !== firstInitial2) return false;

    // If both have patronymic or initials
    if (parts1.length > 2 && parts2.length > 2) {
      const patInitial1 = parts1[2][0];
      const patInitial2 = parts2[2][0];
      if (patInitial1 && patInitial2 && patInitial1 !== patInitial2) {
        return false;
      }
    }
  }

  return true;
}

// Find applicable company config for an employee
export function findCompanyForEmployee(
  employee: EmployeeInfo,
  companies: CompanyConfig[] = DEFAULT_COMPANIES,
  selectedCompanyId?: string
): CompanyConfig {
  if (selectedCompanyId && selectedCompanyId !== 'auto') {
    const found = companies.find((c) => c.id === selectedCompanyId);
    if (found) return found;
  }

  // Auto-match by department if present
  if (employee.department) {
    const deptLower = employee.department.toLowerCase();
    for (const comp of companies) {
      if (comp.departmentMatch) {
        const keywords = comp.departmentMatch.toLowerCase().split(',').map((k) => k.trim()).filter(Boolean);
        if (keywords.some((k) => deptLower.includes(k))) {
          return comp;
        }
      }
      if (comp.name && deptLower.includes(comp.name.toLowerCase())) {
        return comp;
      }
    }
  }

  // Default fallback
  return companies.find((c) => c.isDefault) || companies[0] || (DEFAULT_COMPANIES[0] as CompanyConfig);
}

// Helper to calculate shift params
export function getShiftParams(
  firstIn: number,
  lastOut: number,
  config: ShiftConfig = DEFAULT_SHIFT_CONFIG
): { startMins: number; endMins: number; lastOutCorr: number } {
  // First adjust lastOut if it is less than firstIn (midnight crossover)
  if (lastOut !== -1 && firstIn !== -1 && lastOut < firstIn) {
    const lastOutCorr = lastOut + 24 * 60;
    // This is a night shift
    const startMins = config.nightStartMins;
    const endMins = config.nightEndMins; 
    return { startMins, endMins, lastOutCorr };
  } else {
    // No midnight crossover - determine shift by firstIn
    let startMins: number;
    let endMins: number;

    if (firstIn === -1) {
      // If no entry, use day shift as fallback
      startMins = config.dayStartMins;
      endMins = config.dayEndMins;
    } else if (firstIn < config.thresholdEveningMins) {
      startMins = config.dayStartMins;
      endMins = config.dayEndMins;
    } else if (firstIn < config.thresholdNightMins) {
      startMins = config.eveningStartMins;
      endMins = config.eveningEndMins;
    } else {
      startMins = config.nightStartMins;
      endMins = config.nightEndMins;
    }

    let lastOutCorr = lastOut;
    if (lastOut !== -1 && firstIn !== -1 && lastOut < firstIn) {
      lastOutCorr = lastOut + 24 * 60;
    }

    return { startMins, endMins, lastOutCorr };
  }
}

// Helper to calculate late & early minutes with company grace tolerance rules
export function calcLateEarly(
  firstIn: number,
  lastOut: number,
  config: ShiftConfig | CompanyConfig = DEFAULT_SHIFT_CONFIG
): { lateMins: number; earlyMins: number; totalMins: number | null } {
  if (firstIn === -1 || lastOut === -1) {
    return { lateMins: 0, earlyMins: 0, totalMins: null };
  }
  const { startMins, endMins, lastOutCorr } = getShiftParams(firstIn, lastOut, config);
  const rawLate = Math.max(firstIn - startMins, 0);
  const rawEarly = Math.max(endMins - lastOutCorr, 0);

  // Apply company grace periods ("выбирать время и тд нарушение")
  const graceLate = 'gracePeriodLateMins' in config ? config.gracePeriodLateMins : 0;
  const graceEarly = 'gracePeriodEarlyMins' in config ? config.gracePeriodEarlyMins : 0;

  const lateMins = rawLate <= graceLate ? 0 : rawLate;
  const earlyMins = rawEarly <= graceEarly ? 0 : rawEarly;
  const totalMins = lateMins + earlyMins;

  return {
    lateMins,
    earlyMins,
    totalMins: totalMins > 0 ? totalMins : null,
  };
}

// Extract string value safely from cell
function extractCellStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return formatDateRU(val);
  }
  if (typeof val === 'number') {
    if (val > 20000 && val < 80000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return formatDateRU(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
  }
  return String(val).trim();
}

// Parse absences from raw text (copy-paste support)
export function parseAbsencesFromText(text: string): AbsenceRecord[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((l) => l.split(/\t/).map((c) => c.trim()));
  return parseAbsencesFromAoA(rows);
}

// Core helper to parse Array of Arrays (from XLSX or text)
export function parseAbsencesFromAoA(data: any[][]): AbsenceRecord[] {
  const absences: AbsenceRecord[] = [];
  let currentOrg = 'ТОО "Жигермунайсервис"';

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Detect organization header (e.g. ТОО "Жигермунайсервис")
    const joinedRow = row.map(extractCellStr).join(' ');
    const orgMatch =
      joinedRow.match(/(?:ТОО|АО|ИП)\s*["«][^"»\r\n\t]+["»]/i) ||
      joinedRow.match(/(?:ТОО|АО|ИП)\s+[А-ЯЁӘІҢҒҮҰҚӨҺA-Z][а-яёәіңғүұқөһa-z0-9_-]+/i) ||
      joinedRow.match(/Организация[:\s]+([^\r\n\t]+)/i);
    if (orgMatch) {
      const detected = orgMatch[0].trim();
      if (detected.length > 3 && !detected.toLowerCase().includes('сотрудник')) {
        currentOrg = detected;
      }
    }

    // Skip table header rows
    const firstFewCells = row.slice(0, 4).map(extractCellStr).join(' ').toLowerCase();
    if (
      firstFewCells.includes('вид отсутствия') ||
      firstFewCells.includes('период отсутствия') ||
      firstFewCells.includes('кален. дни') ||
      (firstFewCells.includes('сотрудник') && firstFewCells.includes('организация'))
    ) {
      continue;
    }

    // Find employee FIO: search first 4 cells for non-empty text with 2-3 words (capitalized)
    let fio = '';
    let fioColIdx = -1;
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cell = extractCellStr(row[c]);
      if (!cell) continue;
      const lower = cell.toLowerCase();
      if (
        lower.includes('тоо ') ||
        lower.includes('организация') ||
        lower.includes('период') ||
        lower.includes('сотрудник') ||
        lower.includes('итого') ||
        lower.includes('всего') ||
        /^\d+$/.test(cell)
      ) {
        continue;
      }
      // Check if it looks like a person's name (2+ words or surname with initials)
      const words = cell.split(/\s+/).filter(Boolean);
      if (words.length >= 2 || (words.length === 1 && cell.length >= 4 && /^[А-ЯЁӘІҢҒҮҰҚӨҺA-Z]/.test(cell))) {
        fio = cell;
        fioColIdx = c;
        break;
      }
    }

    if (!fio) continue;

    // Find absence reason
    let reason = '';
    for (let c = fioColIdx + 1; c < Math.min(row.length, fioColIdx + 5); c++) {
      const cell = extractCellStr(row[c]);
      if (!cell) continue;
      const lower = cell.toLowerCase();
      if (/^\d+$/.test(cell)) continue; // skip numbers like 824, 5
      if (
        lower.includes('отпуск') ||
        lower.includes('больничн') ||
        lower.includes('командировк') ||
        lower.includes('неявк') ||
        lower.includes('отсутств') ||
        lower.includes('уход') ||
        lower.includes('за свой счет') ||
        lower.includes('без сохранен') ||
        lower.includes('прогул') ||
        cell.length >= 4
      ) {
        reason = cell;
        break;
      }
    }

    if (!reason) {
      reason = 'Отпуск / Отсутствие';
    }

    // Extract dates from row
    const foundDates: { date: Date; originalStr: string }[] = [];
    let calDays: number | undefined;
    let workDays: number | undefined;

    for (let c = fioColIdx + 1; c < Math.max(row.length, 12); c++) {
      const cellVal = row[c];
      const str = extractCellStr(cellVal);
      if (!str) continue;

      // Extract numbers for calendar and work days if in appropriate range
      if (typeof cellVal === 'number' && cellVal > 0 && cellVal < 20000) {
        if (calDays === undefined) calDays = cellVal;
        else if (workDays === undefined) workDays = cellVal;
      }

      // Check date formats: DD.MM.YYYY
      const dateMatches = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g);
      if (dateMatches) {
        for (const dm of dateMatches) {
          const parsed = parseDateStr(dm);
          if (parsed) {
            foundDates.push({ date: parsed, originalStr: str });
          }
        }
      } else if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
        foundDates.push({
          date: new Date(cellVal.getFullYear(), cellVal.getMonth(), cellVal.getDate()),
          originalStr: formatDateRU(cellVal),
        });
      }
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let startStr = '';
    let endStr = '';

    if (foundDates.length >= 2) {
      startDate = foundDates[0].date;
      startStr = formatDateRU(foundDates[0].date);
      endDate = foundDates[1].date;
      endStr = foundDates[1].originalStr.includes('предположительно')
        ? foundDates[1].originalStr
        : formatDateRU(foundDates[1].date);
    } else if (foundDates.length === 1) {
      startDate = foundDates[0].date;
      startStr = formatDateRU(foundDates[0].date);
      // Default end date far into future if ongoing parental leave
      endDate = new Date(startDate.getFullYear() + 3, startDate.getMonth(), startDate.getDate());
      endStr = 'по настоящее время';
    }

    if (startDate && endDate) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      absences.push({
        fio,
        reason,
        organization: currentOrg,
        startDate,
        endDate,
        startDateStr: startStr,
        endDateStr: endStr,
        calendarDays: calDays,
        workDays: workDays,
      });
    }
  }

  return absences;
}

// Core excel file processor for 1C absences file
export async function parseAbsencesBuffer(buffer: ArrayBuffer): Promise<AbsenceRecord[]> {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    if (!ws) return [];

    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    return parseAbsencesFromAoA(data);
  } catch (err) {
    console.error('Error parsing absences:', err);
    return [];
  }
}

export async function processExcelBuffer(
  buffer: ArrayBuffer,
  config: ShiftConfig | CompanyConfig = DEFAULT_SHIFT_CONFIG,
  absences: AbsenceRecord[] = [],
  companiesList: CompanyConfig[] = DEFAULT_COMPANIES,
  selectedCompanyId: string = 'auto'
): Promise<ProcessedReportResult> {
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const rawRecords: RawPassRecord[] = [];

  // Helper to extract clean date from cell value
  const parseCellDate = (val: any): Date | null => {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    if (typeof val === 'number') {
      if (val > 20000 && val < 80000) {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      }
    }
    const str = String(val).trim();
    const matchDots = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (matchDots) {
      const d = parseInt(matchDots[1], 10);
      const m = parseInt(matchDots[2], 10) - 1;
      const y = parseInt(matchDots[3], 10);
      return new Date(y, m, d);
    }
    const matchDashes = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchDashes) {
      const y = parseInt(matchDashes[1], 10);
      const m = parseInt(matchDashes[2], 10) - 1;
      const d = parseInt(matchDashes[3], 10);
      return new Date(y, m, d);
    }
    return null;
  };

  // Helper to parse cell time value
  const parseCellTime = (v: any): { timeStr: string; totalMins: number } | null => {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v.getTime())) {
      const h = v.getUTCHours();
      const m = v.getUTCMinutes();
      const s = v.getUTCSeconds();
      const lh = v.getHours();
      const lm = v.getMinutes();
      const ls = v.getSeconds();
      const hFinal = (h === 0 && m === 0 && s === 0 && (lh !== 0 || lm !== 0)) ? lh : h;
      const mFinal = (h === 0 && m === 0 && s === 0 && (lh !== 0 || lm !== 0)) ? lm : m;
      const sFinal = (h === 0 && m === 0 && s === 0 && (lh !== 0 || lm !== 0)) ? ls : s;
      return {
        timeStr: `${hFinal.toString().padStart(2, '0')}:${mFinal.toString().padStart(2, '0')}:${sFinal.toString().padStart(2, '0')}`,
        totalMins: hFinal * 60 + mFinal,
      };
    }
    if (typeof v === 'number') {
      const frac = v >= 1 ? v % 1 : v;
      const totalSecs = Math.round(frac * 86400);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      return {
        timeStr: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
        totalMins: h * 60 + m,
      };
    }
    const str = String(v).trim();
    const match = str.match(/(\d{1,2}):(\d{2})(:(\d{2}))?/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = match[4] ? parseInt(match[4], 10) : 0;
      return {
        timeStr: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
        totalMins: h * 60 + m,
      };
    }
    return null;
  };

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    if (!ws) throw new Error('Файл не содержит листов.');

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

    // 1. Extract Period Dates from header metadata
    for (let i = 0; i < Math.min(25, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const valStr = String(row[c] || '').trim();
        const valLower = valStr.toLowerCase();

        // Check for range patterns like "Период: 05.10.2026 - 11.10.2026" or "с 05.10.2026 по 11.10.2026"
        const rangeMatch = valStr.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*(?:-|—|по|до)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
        if (rangeMatch) {
          const p1 = parseCellDate(rangeMatch[1]);
          const p2 = parseCellDate(rangeMatch[2]);
          if (p1 && p2) {
            if (!startDate) startDate = p1;
            if (!endDate) endDate = p2;
          }
        }

        if (valLower.includes('начало периода')) {
          for (let offset = 1; offset <= 3; offset++) {
            const parsed = parseCellDate(row[c + offset]);
            if (parsed) {
              startDate = parsed;
              break;
            }
          }
          if (!startDate) {
            startDate = parseCellDate(row[c]);
          }
        } else if (valLower.includes('конец периода')) {
          for (let offset = 1; offset <= 3; offset++) {
            const parsed = parseCellDate(row[c + offset]);
            if (parsed) {
              endDate = parsed;
              break;
            }
          }
          if (!endDate) {
            endDate = parseCellDate(row[c]);
          }
        }
      }
    }

    // 2. Dynamic Table Headers Finder
    let colDate = -1;
    let colDept = -1;
    let colFio = -1;
    let colTabNum = -1;
    let colPosition = -1;
    let colTime = -1;
    let colAccessPoint = -1;
    let colDirection = -1;
    let dataStartRow = -1;

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      let hasHeaderKeyword = false;
      for (let c = 0; c < row.length; c++) {
        const text = String(row[c] || '').toLowerCase().trim();
        if (text === 'дата') { colDate = c; hasHeaderKeyword = true; }
        else if (text.includes('отдел') || text.includes('подразделение')) { colDept = c; hasHeaderKeyword = true; }
        else if (text === 'фио' || text === 'сотрудник') { colFio = c; hasHeaderKeyword = true; }
        else if (text.includes('таб.') || text.includes('таб_') || text.includes('таб №') || text === 'таб') { colTabNum = c; hasHeaderKeyword = true; }
        else if (text.includes('должность') || text.includes('профессия')) { colPosition = c; hasHeaderKeyword = true; }
        else if (text === 'время' || text.includes('время')) { colTime = c; hasHeaderKeyword = true; }
        else if (text.includes('точка доступа') || text.includes('точка_доступа') || text.includes('турникет')) { colAccessPoint = c; hasHeaderKeyword = true; }
        else if (text.includes('направление')) { colDirection = c; hasHeaderKeyword = true; }
      }

      if (hasHeaderKeyword) {
        // Check if next row has subheaders (Sigur 2-level headers)
        if (i + 1 < data.length) {
          const nextRow = data[i + 1];
          if (nextRow) {
            for (let c = 0; c < nextRow.length; c++) {
              const subText = String(nextRow[c] || '').toLowerCase().trim();
              if (subText === 'время' || subText.includes('время')) colTime = c;
              else if (subText.includes('точка доступа') || subText.includes('турникет')) colAccessPoint = c;
              else if (subText.includes('направление')) colDirection = c;
            }
          }
        }
        dataStartRow = i + 1;
        // If next row had 'время' or 'направление', data starts at i + 2
        if (data[i + 1] && (
          String(data[i + 1][colTime] || '').toLowerCase().includes('время') ||
          String(data[i + 1][colDirection] || '').toLowerCase().includes('направление')
        )) {
          dataStartRow = i + 2;
        }
        break;
      }
    }

    // Fallbacks if not detected
    if (dataStartRow === -1) dataStartRow = 6;
    if (colDate === -1) colDate = 0;
    if (colDept === -1) colDept = 1;
    if (colFio === -1) colFio = 2;
    if (colTabNum === -1) colTabNum = 3;
    if (colPosition === -1) colPosition = 4;
    if (colTime === -1) colTime = 5;
    if (colAccessPoint === -1) colAccessPoint = 6;
    if (colDirection === -1) colDirection = 7;

    // 3. Read table rows with state propagation across empty cells
    let currentFio = '';
    let currentDept = '';
    let currentPos = '';
    let currentTabNum = '';
    let currentDateStr = '';
    const passDates: Date[] = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const rawDate = row[colDate];
      const parsedDate = parseCellDate(rawDate);
      if (parsedDate) {
        currentDateStr = formatDate(parsedDate);
        passDates.push(parsedDate);
      } else if (rawDate && typeof rawDate === 'string' && rawDate.trim().match(/\d{2}\.\d{2}\.\d{4}/)) {
        currentDateStr = rawDate.trim();
      }

      const rawFio = row[colFio];
      const fioText = rawFio !== null && rawFio !== undefined ? String(rawFio).trim() : '';

      // Skip repeated table headers
      if (fioText.toLowerCase() === 'фио' || fioText.toLowerCase() === 'сотрудник') {
        continue;
      }

      const rawDept = row[colDept];
      const deptText = rawDept !== null && rawDept !== undefined ? String(rawDept).trim() : '';

      const rawPos = row[colPosition];
      const posText = rawPos !== null && rawPos !== undefined ? String(rawPos).trim() : '';

      const rawTabNum = row[colTabNum];
      const tabNumText = rawTabNum !== null && rawTabNum !== undefined ? String(rawTabNum).trim() : '';

      // When a new employee block starts
      if (fioText !== '') {
        currentFio = fioText;
        currentDept = deptText;
        currentPos = posText || '—';
        currentTabNum = tabNumText;
      }

      if (!currentFio || !currentDateStr) continue;

      // Extract time
      const rawTime = row[colTime];
      const timeParsed = parseCellTime(rawTime);
      if (!timeParsed) continue;

      const rawAp = row[colAccessPoint];
      const apText = rawAp !== null && rawAp !== undefined ? String(rawAp).trim() : '';

      const rawDir = row[colDirection];
      const dirText = rawDir !== null && rawDir !== undefined ? String(rawDir).trim().toLowerCase() : '';

      rawRecords.push({
        date: currentDateStr,
        department: currentDept,
        fio: currentFio,
        tabNum: currentTabNum,
        position: currentPos,
        time: timeParsed.timeStr,
        accessPoint: apText,
        direction: dirText,
      });
    }

    // 4. Fallback period dates if not found in header
    if ((!startDate || !endDate) && passDates.length > 0) {
      let minT = passDates[0].getTime();
      let maxT = passDates[0].getTime();
      for (const pd of passDates) {
        if (pd.getTime() < minT) minT = pd.getTime();
        if (pd.getTime() > maxT) maxT = pd.getTime();
      }
      if (!startDate) startDate = new Date(minT);
      if (!endDate) endDate = new Date(maxT);
    }

    // If endDate was set to 00:00:00 on the last day, ensure all pass dates are included
    if (passDates.length > 0 && endDate) {
      for (const pd of passDates) {
        if (pd.getTime() > endDate.getTime()) {
          endDate = new Date(pd.getTime());
        }
      }
    }

    if (!startDate || !endDate) {
      throw new Error('Не удалось найти даты начала и конца периода в файле.');
    }
    if (startDate > endDate) {
      throw new Error('Начало периода позже конца периода.');
    }

  } catch (err: any) {
    throw new Error('Ошибка при разборе файла: ' + err.message);
  }

  if (rawRecords.length === 0) {
    throw new Error('Не найдено записей с данными проходов в файле.');
  }

  // 5. Discover access points and separate normal passes vs. lunch passes
  const discoveredMap = new Map<string, AccessPointConfig>();
  for (const rec of rawRecords) {
    const apName = rec.accessPoint || 'Проходная';
    if (!discoveredMap.has(apName)) {
      const lower = apName.toLowerCase();
      let role: AccessPointRole = 'turnstile';
      if (lower.includes('столов') || lower.includes('асхан') || lower.includes('буфет') || lower.includes('кафе')) {
        role = 'canteen';
      } else if (lower.includes('общежит') || lower.includes('гостиниц') || lower.includes('хостел')) {
        role = 'dormitory';
      }
      discoveredMap.set(apName, {
        id: apName,
        name: apName,
        role,
        enabled: true,
        passCount: 1,
      });
    } else {
      const existing = discoveredMap.get(apName)!;
      existing.passCount = (existing.passCount || 0) + 1;
    }
  }

  const discoveredAccessPoints = Array.from(discoveredMap.values());

  const normalPasses: Array<{
    fio: string;
    position: string;
    dateKey: string; // YYYY-MM-DD
    timeMins: number;
    direction: string;
  }> = [];

  const lunchPasses: Array<{
    fio: string;
    dateKey: string;
    timeMins: number;
    direction: string;
  }> = [];

  const employeeMap = new Map<string, EmployeeInfo>();

  for (const rec of rawRecords) {
    const dt = parseDateStr(rec.date);
    if (!dt) continue;
    const dateKey = formatDate(dt);

    // Save employee info
    if (!employeeMap.has(rec.fio)) {
      employeeMap.set(rec.fio, {
        fio: rec.fio,
        position: rec.position || '—',
        tabNum: rec.tabNum,
        department: rec.department,
      });
    }

    // Determine access point configuration rule (from active company or config)
    const activeComp = findCompanyForEmployee(
      employeeMap.get(rec.fio)!,
      companiesList,
      selectedCompanyId
    );
    const apRule = activeComp.accessPoints?.find(
      (p) => p.name === rec.accessPoint || p.id === rec.accessPoint
    );

    // Check if point is disabled (excluded from calculation & export)
    if (apRule && apRule.enabled === false) {
      continue;
    }

    const effectiveRole: AccessPointRole = apRule
      ? apRule.role
      : (discoveredMap.get(rec.accessPoint)?.role || 'turnstile');

    // Dormitory passes are not counted in work time or lunch
    if (effectiveRole === 'dormitory') {
      continue;
    }

    // Time in minutes
    const timeParts = rec.time.split(':');
    if (timeParts.length < 2) continue;
    const hrs = parseInt(timeParts[0], 10);
    const mins = parseInt(timeParts[1], 10);
    if (isNaN(hrs) || isNaN(mins)) continue;
    const totalTimeMins = hrs * 60 + mins;

    if (effectiveRole === 'canteen') {
      lunchPasses.push({
        fio: rec.fio,
        dateKey,
        timeMins: totalTimeMins,
        direction: rec.direction,
      });
    } else {
      normalPasses.push({
        fio: rec.fio,
        position: rec.position,
        dateKey,
        timeMins: totalTimeMins,
        direction: rec.direction,
      });
    }
  }

  // Include employees from absences list even if they have 0 passes in SKUD (e.g. 3-year parental leave / vacation)
  for (const abs of absences) {
    const absStart = abs.startDate.getTime();
    const absEnd = abs.endDate.getTime();
    const repStart = startDate.getTime();
    const repEnd = endDate.getTime();
    if (absStart <= repEnd && absEnd >= repStart) {
      let alreadyExists = false;
      for (const [existingFio] of employeeMap.entries()) {
        if (matchesFio(existingFio, abs.fio)) {
          alreadyExists = true;
          break;
        }
      }
      if (!alreadyExists) {
        employeeMap.set(abs.fio, {
          fio: abs.fio,
          position: abs.reason || 'Отпуск по уходу за ребенком',
          department: abs.organization || 'ТОО "Жигермунайсервис"',
          companyName: abs.organization || 'ТОО "Жигермунайсервис"',
        });
      }
    }
  }

  // Group entries & exits for normal passes
  // Key: `${fio}_${dateKey}`
  const dayNormalMap = new Map<
    string,
    { firstIn: number; lastOut: number; position: string }
  >();

  for (const pass of normalPasses) {
    const key = `${pass.fio}_${pass.dateKey}`;
    let item = dayNormalMap.get(key);
    if (!item) {
      item = { firstIn: -1, lastOut: -1, position: pass.position };
      dayNormalMap.set(key, item);
    }

    const isEntry = pass.direction.includes('вход') || pass.direction.includes('въезд');
    const isExit = pass.direction.includes('выход') || pass.direction.includes('выезд');

    if (isEntry) {
      if (item.firstIn === -1 || pass.timeMins < item.firstIn) {
        item.firstIn = pass.timeMins;
      }
    } else if (isExit) {
      if (item.lastOut === -1 || pass.timeMins > item.lastOut) {
        item.lastOut = pass.timeMins;
      }
    }
  }

  // Group lunch breaks
  // Lunch logic: entry between lunchWindowStartMins (12:00) and lunchWindowEndMins (14:00)
  const dayLunchMap = new Map<string, { startMins: number; endMins: number }>();

  for (const lPass of lunchPasses) {
    if (
      lPass.direction.includes('вход') &&
      lPass.timeMins >= config.lunchWindowStartMins &&
      lPass.timeMins <= config.lunchWindowEndMins
    ) {
      const key = `${lPass.fio}_${lPass.dateKey}`;
      const existing = dayLunchMap.get(key);
      if (!existing || lPass.timeMins < existing.startMins) {
        dayLunchMap.set(key, {
          startMins: lPass.timeMins,
          endMins: config.lunchFixedEndMins,
        });
      }
    }
  }

  // 4. Generate Daily Range & Report Groups
  const dateRange: Date[] = [];
  let curr = new Date(startDate.getTime());
  while (curr <= endDate) {
    dateRange.push(new Date(curr.getTime()));
    curr.setDate(curr.getDate() + 1);
  }

  const employeeGroups: EmployeeReportGroup[] = [];
  let empIdx = 1;

  let globalTotalViolations = 0;
  let globalTotalLateEvents = 0;
  let globalTotalEarlyEvents = 0;
  let globalTotalMissingPunches = 0;
  let globalTotalLunchBreaks = 0;
  let globalTotalViolationMins = 0;

  const dayOfWeekNames = [
    'воскресенье',
    'понедельник',
    'вторник',
    'среда',
    'четверг',
    'пятница',
    'суббота',
  ];

  for (const [fio, empInfo] of employeeMap.entries()) {
    const empCompany = findCompanyForEmployee(empInfo, companiesList, selectedCompanyId);
    empInfo.companyId = empCompany.id;
    empInfo.companyName = empCompany.name;

    const dailyRecords: DailyAttendanceRecord[] = [];
    let groupViolationsCount = 0;
    let groupViolationMins = 0;
    let groupLateMins = 0;
    let groupEarlyMins = 0;
    let groupMissingPunches = 0;

    for (const d of dateRange) {
      const dateKey = formatDate(d);
      const dayOfWeek = d.getDay();

      // Check work week type and active working days according to company rules
      let isWeekend = false;
      if (empCompany.workDays && empCompany.workDays.length > 0) {
        isWeekend = !empCompany.workDays.includes(dayOfWeek);
      } else if (empCompany.workWeekType === '6days') {
        isWeekend = dayOfWeek === 0; // Only Sunday is weekend
      } else if (empCompany.workWeekType === 'shift') {
        isWeekend = false; // Shift schedule has no fixed weekend
      } else {
        isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Standard 5-day week
      }

      let dateStr = dateKey;
      if (isWeekend) {
        dateStr = dayOfWeek === 6 ? 'суббота' : 'воскресенье';
      }

      // Check for absences with fuzzy FIO matching
      const dTime = d.getTime();
      const currentAbsence = absences.find(
        (a) =>
          matchesFio(a.fio, fio) &&
          dTime >= a.startDate.getTime() &&
          dTime <= a.endDate.getTime()
      );

      const isAbsent = !!currentAbsence;
      const absenceReason = currentAbsence ? currentAbsence.reason : '';

      const passData = dayNormalMap.get(`${fio}_${dateKey}`);
      const lunchData = dayLunchMap.get(`${fio}_${dateKey}`);

      let firstInMins = passData ? passData.firstIn : -1;
      let lastOutMins = passData ? passData.lastOut : -1;

      let firstInStr =
        firstInMins !== -1 ? minsToTimeStr(firstInMins) : isAbsent ? absenceReason : 'нет входа';

      let lastOutCorrMins = -1;
      let lastOutStr = isAbsent ? absenceReason : 'нет выхода';

      if (lastOutMins !== -1 && !isAbsent) {
        const shift = getShiftParams(firstInMins, lastOutMins, empCompany);
        lastOutCorrMins = shift.lastOutCorr;
        lastOutStr = minsToTimeStr(lastOutCorrMins % (24 * 60));
      } else if (lastOutMins !== -1 && isAbsent) {
        firstInMins = -1;
        lastOutMins = -1;
      }

      const lunchStartStr = lunchData && !isAbsent ? minsToTimeStr(lunchData.startMins) : '';
      const lunchEndStr = lunchData && !isAbsent ? minsToTimeStr(lunchData.endMins) : '';

      if (lunchData && !isAbsent) {
        globalTotalLunchBreaks++;
      }

      // Violations with company rules ("выбирать время и тд нарушение")
      let { lateMins, earlyMins, totalMins } = calcLateEarly(
        firstInMins,
        lastOutMins,
        empCompany
      );

      const shiftParams = getShiftParams(firstInMins, lastOutMins, empCompany);
      const graceLate = empCompany.gracePeriodLateMins || 0;
      const graceEarly = empCompany.gracePeriodEarlyMins || 0;

      let isLate = firstInMins !== -1 && firstInMins > shiftParams.startMins + graceLate;
      let isEarlyExit = lastOutMins !== -1 && shiftParams.lastOutCorr < shiftParams.endMins - graceEarly;

      if (isAbsent) {
        // No violations for absent employees
        lateMins = 0;
        earlyMins = 0;
        totalMins = null;
        isLate = false;
        isEarlyExit = false;
      } else if (isWeekend && !empCompany.countWeekendViolations) {
        totalMins = null;
        lateMins = 0;
        earlyMins = 0;
        isLate = false;
        isEarlyExit = false;
      }

      let missingInFlag = firstInMins === -1 && !isWeekend && !isAbsent;
      let missingOutFlag = lastOutMins === -1 && !isWeekend && !isAbsent && firstInMins !== -1;
      let note = isAbsent ? absenceReason : '';

      let hasViolation = (totalMins !== null && totalMins > 0) || isLate || isEarlyExit;
      if (empCompany.countMissingInAsViolation && missingInFlag) {
        hasViolation = true;
      }
      if (empCompany.countMissingOutAsViolation && missingOutFlag) {
        hasViolation = true;
      }

      const totalViolationTimeStr = minsToDurationStr(totalMins);

      if (missingInFlag || missingOutFlag) {
        groupMissingPunches++;
        globalTotalMissingPunches++;
      }

      if (isLate) globalTotalLateEvents++;
      if (isEarlyExit) globalTotalEarlyEvents++;

      if (hasViolation) {
        groupViolationsCount++;
        globalTotalViolations++;
        if (totalMins) {
          groupViolationMins += totalMins;
          globalTotalViolationMins += totalMins;
        }
        groupLateMins += lateMins;
        groupEarlyMins += earlyMins;
      }

      dailyRecords.push({
        dateStr,
        rawDate: dateKey,
        isWeekend,
        dayOfWeekStr: dayOfWeekNames[dayOfWeek],
        isAbsent,
        absenceReason,
        firstInMins,
        firstInStr,
        lastOutMins,
        lastOutCorrMins,
        lastOutStr,
        lunchStartStr,
        lunchEndStr,
        lateMins,
        earlyMins,
        totalViolationMins: totalMins || 0,
        totalViolationTimeStr,
        isLate,
        isEarlyExit,
        hasViolation,
        missingIn: missingInFlag,
        missingOut: missingOutFlag,
        note,
      });
    }

    employeeGroups.push({
      index: empIdx++,
      employee: empInfo,
      dailyRecords,
      totalViolationsCount: groupViolationsCount,
      totalViolationMinutes: groupViolationMins,
      totalLateMinutes: groupLateMins,
      totalEarlyMinutes: groupEarlyMins,
      missingPunchDays: groupMissingPunches,
    });
  }

  const notesText = [
    'Необходимо пояснение/аналитика',
    'За отчетный период зафиксированы следующие отклонения от регламента:',
    'Например, ФИО сотрудника по которому вывялено нарушение, проведена ли разъяснительная работа',
    'Невыход/прогул без уважительной причины по сотруднику, составлен акт, затребована объяснительная записка',
  ];

  const formattedPeriod = `${formatDateRU(startDate)} - ${formatDateRU(endDate)}`;
  const filename = `Информация об учете рабочего времени_${formatDateRU(startDate)}_${formatDateRU(endDate)}.xlsx`;

  const activeCompany =
    selectedCompanyId && selectedCompanyId !== 'auto'
      ? companiesList.find((c) => c.id === selectedCompanyId) || (companiesList[0] as CompanyConfig)
      : (companiesList[0] as CompanyConfig);

  return {
    filename,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    formattedPeriod,
    employeeGroups,
    absencesList: absences,
    summaryMetrics: {
      totalEmployees: employeeMap.size,
      totalDays: dateRange.length,
      totalViolations: globalTotalViolations,
      totalLateEvents: globalTotalLateEvents,
      totalEarlyEvents: globalTotalEarlyEvents,
      totalMissingPunches: globalTotalMissingPunches,
      totalLunchBreaksLogged: globalTotalLunchBreaks,
      totalViolationMinutes: globalTotalViolationMins,
    },
    shiftConfig: activeCompany,
    companyConfig: activeCompany,
    allCompanies: companiesList,
    selectedCompanyId,
    discoveredAccessPoints,
    notesText,
  };
}

// Dynamically recalculate an existing report when user switches or customizes company rules
export function recalculateReportWithCompany(
  report: ProcessedReportResult,
  companies: CompanyConfig[],
  selectedCompanyId: string = 'auto'
): ProcessedReportResult {
  const newReport = JSON.parse(JSON.stringify(report)) as ProcessedReportResult;
  let globalTotalViolations = 0;
  let globalTotalLateEvents = 0;
  let globalTotalEarlyEvents = 0;
  let globalTotalMissingPunches = 0;
  let globalTotalViolationMins = 0;

  for (const group of newReport.employeeGroups) {
    const empCompany = findCompanyForEmployee(group.employee, companies, selectedCompanyId);
    group.employee.companyId = empCompany.id;
    group.employee.companyName = empCompany.name;

    let groupViolationsCount = 0;
    let groupViolationMins = 0;
    let groupLateMins = 0;
    let groupEarlyMins = 0;
    let groupMissingPunches = 0;

    for (const record of group.dailyRecords) {
      if (record.isAbsent) {
        continue;
      }

      // Check weekend according to company's active workDays or work week
      const dt = parseDateStr(record.rawDate);
      if (dt) {
        const dayOfWeek = dt.getDay();
        if (empCompany.workDays && empCompany.workDays.length > 0) {
          record.isWeekend = !empCompany.workDays.includes(dayOfWeek);
        } else if (empCompany.workWeekType === '6days') {
          record.isWeekend = dayOfWeek === 0;
        } else if (empCompany.workWeekType === 'shift') {
          record.isWeekend = false;
        } else {
          record.isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        }
      }

      let { lateMins, earlyMins, totalMins } = calcLateEarly(
        record.firstInMins,
        record.lastOutMins,
        empCompany
      );

      const shiftParams = getShiftParams(record.firstInMins, record.lastOutMins, empCompany);
      const graceLate = empCompany.gracePeriodLateMins || 0;
      const graceEarly = empCompany.gracePeriodEarlyMins || 0;

      let isLate = record.firstInMins !== -1 && record.firstInMins > shiftParams.startMins + graceLate;
      let isEarlyExit = record.lastOutMins !== -1 && shiftParams.lastOutCorr < shiftParams.endMins - graceEarly;

      if (record.isWeekend && !empCompany.countWeekendViolations) {
        totalMins = null;
        lateMins = 0;
        earlyMins = 0;
        isLate = false;
        isEarlyExit = false;
      }

      let hasViolation = (totalMins !== null && totalMins > 0) || isLate || isEarlyExit;
      if (empCompany.countMissingInAsViolation && record.missingIn) {
        hasViolation = true;
      }
      if (empCompany.countMissingOutAsViolation && record.missingOut) {
        hasViolation = true;
      }

      record.lateMins = lateMins;
      record.earlyMins = earlyMins;
      record.totalViolationMins = totalMins || 0;
      record.totalViolationTimeStr = minsToDurationStr(totalMins);
      record.isLate = isLate;
      record.isEarlyExit = isEarlyExit;
      record.hasViolation = hasViolation;

      if (record.missingIn || record.missingOut) {
        groupMissingPunches++;
        globalTotalMissingPunches++;
      }
      if (isLate) globalTotalLateEvents++;
      if (isEarlyExit) globalTotalEarlyEvents++;

      if (hasViolation) {
        groupViolationsCount++;
        globalTotalViolations++;
        if (totalMins) {
          groupViolationMins += totalMins;
          globalTotalViolationMins += totalMins;
        }
        groupLateMins += lateMins;
        groupEarlyMins += earlyMins;
      }
    }

    group.totalViolationsCount = groupViolationsCount;
    group.totalViolationMinutes = groupViolationMins;
    group.totalLateMinutes = groupLateMins;
    group.totalEarlyMinutes = groupEarlyMins;
    group.missingPunchDays = groupMissingPunches;
  }

  const activeCompany =
    selectedCompanyId && selectedCompanyId !== 'auto'
      ? companies.find((c) => c.id === selectedCompanyId) || (companies[0] as CompanyConfig)
      : (companies[0] as CompanyConfig);

  newReport.summaryMetrics.totalViolations = globalTotalViolations;
  newReport.summaryMetrics.totalLateEvents = globalTotalLateEvents;
  newReport.summaryMetrics.totalEarlyEvents = globalTotalEarlyEvents;
  newReport.summaryMetrics.totalMissingPunches = globalTotalMissingPunches;
  newReport.summaryMetrics.totalViolationMinutes = globalTotalViolationMins;
  newReport.shiftConfig = activeCompany;
  newReport.companyConfig = activeCompany;
  newReport.allCompanies = companies;
  newReport.selectedCompanyId = selectedCompanyId;

  return newReport;
}

// Generate styled Excel workbook matching openpyxl script specification exactly
export async function generateExcelReportBuffer(
  reportData: ProcessedReportResult
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('общий');

  // Page setup & view settings
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];

  // Column Widths matching Python col_widths:
  // {'A': 8, 'B': 30, 'C': 25, 'D': 15, 'E': 12, 'F': 12, 'G': 15, 'H': 15, 'I': 20, 'J': 20}
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 25;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 15;
  ws.getColumn(8).width = 15;
  ws.getColumn(9).width = 20;
  ws.getColumn(10).width = 20;

  // 1. Header Metadata block (Rows 1..7)
  ws.mergeCells('A1:J1');
  const r1 = ws.getCell('A1');
  r1.value = 'ИНФОРМАЦИЯ';
  r1.font = { name: 'Calibri', bold: true, size: 14 };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:J2');
  const r2 = ws.getCell('A2');
  r2.value = 'об учете рабочего времени';
  r2.font = { name: 'Calibri', bold: true, size: 12 };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getRow(3).height = 5;

  ws.mergeCells('A4:J4');
  const r4 = ws.getCell('A4');
  r4.value = `Упрощенный отчет: с ${reportData.formattedPeriod}`;
  r4.font = { name: 'Calibri', bold: true, size: 11 };
  r4.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. Table Headers at Row 8
  const headers = [
    '№ пп',
    'Сотрудник',
    'Должность',
    'Дата',
    'Начало дня',
    'Конец дня',
    'Обеденный перерыв начало',
    'Обеденный перерыв конец',
    'Итоговое количество опозданий и ранних уходов',
    'Причина неявки',
  ];

  const headerRow = ws.getRow(8);
  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = 30;

  // 3. Populate Data Rows starting row 9
  let currentRow = 9;
  const redFont = { name: 'Calibri', color: { argb: 'FFFF0000' } };
  const regularFont = { name: 'Calibri' };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  for (const group of reportData.employeeGroups) {
    const empSummaryRowIndex = currentRow;
    const dailyStartRowIndex = currentRow + 1;
    const dailyEndRowIndex = currentRow + group.dailyRecords.length;

    // A) Summary Row for Employee
    const empRow = ws.getRow(empSummaryRowIndex);
    empRow.getCell(1).value = group.index;
    empRow.getCell(2).value = group.employee.fio;
    empRow.getCell(3).value = group.employee.position || group.employee.companyName || '—';
    empRow.getCell(4).value = '';
    empRow.getCell(5).value = '';
    empRow.getCell(6).value = '';
    empRow.getCell(7).value = '';
    empRow.getCell(8).value = '';
    // Formula for sum of total violation times of this employee
    empRow.getCell(9).value = {
      formula: `SUM(I${dailyStartRowIndex}:I${dailyEndRowIndex})`,
    };
    empRow.getCell(10).value = '';

    // Style summary row
    for (let c = 1; c <= 10; c++) {
      const cell = empRow.getCell(c);
      cell.font = { name: 'Calibri', bold: true };
      cell.border = thinBorder;
      cell.alignment = c === 2 || c === 3 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
    }

    currentRow++;

    // B) Daily Rows for Employee
    for (const record of group.dailyRecords) {
      const dayRow = ws.getRow(currentRow);
      dayRow.getCell(1).value = '';
      dayRow.getCell(2).value = group.employee.fio;
      dayRow.getCell(3).value = group.employee.position || group.employee.companyName || '—';
      dayRow.getCell(4).value = record.dateStr;
      dayRow.getCell(5).value = record.firstInStr;
      dayRow.getCell(6).value = record.lastOutStr;
      dayRow.getCell(7).value = record.lunchStartStr;
      dayRow.getCell(8).value = record.lunchEndStr;
      dayRow.getCell(9).value = record.totalViolationTimeStr;
      dayRow.getCell(10).value = record.note;

      // Apply cell formatting
      const isEven = currentRow % 2 === 0;
      for (let c = 1; c <= 10; c++) {
        const cell = dayRow.getCell(c);
        cell.border = thinBorder;
        cell.alignment = c === 2 || c === 3 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };

        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' },
          };
        }

        // Apply Red Font for violations
        if (c === 5 && record.isLate) {
          cell.font = redFont;
        } else if (c === 6 && record.isEarlyExit) {
          cell.font = redFont;
        } else if (c === 9 && record.totalViolationTimeStr) {
          cell.font = redFont;
        } else {
          cell.font = regularFont;
        }
      }

      currentRow++;
    }
  }

  const lastDataRow = currentRow - 1;

  // Add empty separator row
  currentRow++;

  // 4. Trailing Notes Block
  for (const noteLine of reportData.notesText) {
    const noteRow = ws.getRow(currentRow);
    noteRow.getCell(2).value = noteLine;
    noteRow.getCell(2).font = { name: 'Calibri', italic: true, size: 10 };
    currentRow++;
  }

  // 5. AutoFilter setup
  ws.autoFilter = `A8:J${lastDataRow}`;

  // 6. Add Top Violators Sheet
  const wsTop = workbook.addWorksheet('Топ нарушителей');
  
  const topHeaders = ['№', 'Сотрудник', 'Должность', 'Суммарное время нарушений', 'Кол-во дней с нарушениями'];
  const topHeaderRow = wsTop.getRow(1);
  topHeaders.forEach((h, colIdx) => {
    const cell = topHeaderRow.getCell(colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  const violatorsMap = new Map<string, {fio: string; position: string; minutes: number; days: number}>();
  
  for (const group of reportData.employeeGroups) {
    for (const record of group.dailyRecords) {
      const violStr = record.totalViolationTimeStr;
      if (!violStr || violStr === '' || violStr === '0') continue;
      
      const parts = violStr.split(':');
      let minutes = 0;
      if (parts.length === 3) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
          minutes = h * 60 + m + Math.floor(s / 60);
        }
      } else if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          minutes = h * 60 + m;
        }
      }
      
      if (minutes === 0) continue;
      
      if (!violatorsMap.has(group.employee.fio)) {
        violatorsMap.set(group.employee.fio, {
          fio: group.employee.fio,
          position: group.employee.position,
          minutes: 0,
          days: 0
        });
      }
      
      const v = violatorsMap.get(group.employee.fio)!;
      v.minutes += minutes;
      v.days += 1;
    }
  }

  const violators = Array.from(violatorsMap.values());
  violators.sort((a, b) => b.minutes - a.minutes);

  let topRowIdx = 2;
  for (const v of violators) {
    const row = wsTop.getRow(topRowIdx);
    row.getCell(1).value = topRowIdx - 1;
    row.getCell(2).value = v.fio;
    row.getCell(3).value = v.position;
    
    const h = Math.floor(v.minutes / 60);
    const m = v.minutes % 60;
    row.getCell(4).value = `${h} ч ${m.toString().padStart(2, '0')} мин`;
    row.getCell(5).value = v.days;

    // formatting
    if (v.minutes > 0) {
      row.getCell(4).font = redFont;
    }

    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.alignment = c === 2 || c === 3 
        ? { horizontal: 'left', vertical: 'middle' } 
        : { horizontal: 'center', vertical: 'middle' };
      if (topRowIdx % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      }
    }
    topRowIdx++;
  }

  wsTop.getColumn(1).width = 8;
  wsTop.getColumn(2).width = 30;
  wsTop.getColumn(3).width = 25;
  wsTop.getColumn(4).width = 22;
  wsTop.getColumn(5).width = 22;

  if (violators.length > 0) {
    wsTop.autoFilter = `A1:E${topRowIdx - 1}`;
  }

  // 7. Add Absences Sheet if data exists
  if (reportData.absencesList && reportData.absencesList.length > 0) {
    const wsAbsences = workbook.addWorksheet('Отсутствия');
    
    // Headers
    wsAbsences.columns = [
      { key: 'A', width: 6 },
      { key: 'B', width: 30 },
      { key: 'C', width: 32 },
      { key: 'D', width: 30 },
      { key: 'E', width: 14 },
      { key: 'F', width: 20 },
      { key: 'G', width: 12 },
      { key: 'H', width: 12 },
    ];
    
    const absHeaders = wsAbsences.getRow(1);
    absHeaders.getCell(1).value = '№ пп';
    absHeaders.getCell(2).value = 'Организация';
    absHeaders.getCell(3).value = 'Сотрудник';
    absHeaders.getCell(4).value = 'Вид отсутствия';
    absHeaders.getCell(5).value = 'Дата начала';
    absHeaders.getCell(6).value = 'Дата окончания';
    absHeaders.getCell(7).value = 'Кален. дни';
    absHeaders.getCell(8).value = 'Раб. дни';
    
    for (let c = 1; c <= 8; c++) {
      const cell = absHeaders.getCell(c);
      cell.font = { name: 'Calibri', bold: true, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }
    
    let absRowIdx = 2;
    const reportStart = new Date(reportData.startDate).getTime();
    const reportEnd = new Date(reportData.endDate).getTime();
    
    const relevantAbsences = reportData.absencesList.filter(a => 
      new Date(a.startDate).getTime() <= reportEnd && new Date(a.endDate).getTime() >= reportStart
    );
    
    const absencesToShow = relevantAbsences.length > 0 ? relevantAbsences : reportData.absencesList;
    
    absencesToShow.forEach((a, i) => {
      const r = wsAbsences.getRow(absRowIdx++);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = a.organization || reportData.companyConfig?.name || 'ТОО "Жигермунайсервис"';
      r.getCell(3).value = a.fio;
      r.getCell(4).value = a.reason;
      r.getCell(5).value = a.startDateStr;
      r.getCell(6).value = a.endDateStr;
      r.getCell(7).value = a.calendarDays ?? '';
      r.getCell(8).value = a.workDays ?? '';
      
      for (let c = 1; c <= 8; c++) {
        const cell = r.getCell(c);
        cell.border = thinBorder;
        cell.alignment = c === 2 || c === 3 || c === 4
          ? { horizontal: 'left', vertical: 'middle' }
          : { horizontal: 'center', vertical: 'middle' };
      }
    });
    
    if (absencesToShow.length > 0) {
      wsAbsences.autoFilter = `A1:H${absRowIdx - 1}`;
    }
  }

  // Return workbook buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return arrayBuffer as ArrayBuffer;
}

// Generate a realistic sample input file matching 'asdasda_2_2.xlsx' format
export async function createSampleInputExcelBuffer(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Sheet1');

  // Metadata block at top
  ws.getCell('C2').value = 'Начало периода:';
  ws.getCell('D2').value = '16.03.2024';

  ws.getCell('C3').value = 'Конец периода:';
  ws.getCell('D3').value = '31.03.2024';

  // Header row at row 7 (skiprows=6)
  const headers = [
    'Дата',
    'Отдел',
    'ФИО',
    'Таб_№',
    'Должность',
    'Время',
    'Точка_доступа',
    'Направление',
    'Unnamed',
  ];
  const headerRow = ws.getRow(7);
  headers.forEach((h, idx) => {
    headerRow.getCell(idx + 1).value = h;
  });

  // Sample employee records
  const sampleData = [
    // Employee 1: Иванов И.И. (Day shift 08:30-17:30, has lateness on 16th and lunch pass)
    { d: '2024-03-16', dept: 'ИТ Отдел', fio: 'Иванов Иван Иванович', tab: '001', pos: 'Инженер', t: '08:45', ap: 'Главный Вход (Турникет 1)', dir: 'вход' },
    { d: '2024-03-16', dept: 'ИТ Отдел', fio: 'Иванов Иван Иванович', tab: '001', pos: 'Инженер', t: '12:15', ap: 'Столовая Асхана', dir: 'вход' },
    { d: '2024-03-16', dept: 'ИТ Отдел', fio: 'Иванов Иван Иванович', tab: '001', pos: 'Инженер', t: '17:30', ap: 'Главный Вход (Турникет 1)', dir: 'выход' },
    
    { d: '2024-03-17', dept: 'ИТ Отдел', fio: 'Иванов Иван Иванович', tab: '001', pos: 'Инженер', t: '08:25', ap: 'Главный Вход (Турникет 1)', dir: 'вход' },
    { d: '2024-03-17', dept: 'ИТ Отдел', fio: 'Иванов Иван Иванович', tab: '001', pos: 'Инженер', t: '17:15', ap: 'Главный Вход (Турникет 1)', dir: 'выход' }, // early departure

    // Employee 2: Петров П.П. (Evening shift 17:00-24:00)
    { d: '2024-03-16', dept: 'Бухгалтерия', fio: 'Петрова Анна Сергеевна', tab: '002', pos: 'Главный Бухгалтер', t: '17:10', ap: 'Центральный Вход', dir: 'вход' },
    { d: '2024-03-16', dept: 'Бухгалтерия', fio: 'Петрова Анна Сергеевна', tab: '002', pos: 'Главный Бухгалтер', t: '23:55', ap: 'Центральный Вход', dir: 'выход' },

    // Employee 3: Смирнов А.В. (On-time)
    { d: '2024-03-16', dept: 'Отдел Продаж', fio: 'Смирнов Алексей Владимирович', tab: '003', pos: 'Менеджер', t: '08:20', ap: 'Главный Вход', dir: 'вход' },
    { d: '2024-03-16', dept: 'Отдел Продаж', fio: 'Смирнов Алексей Владимирович', tab: '003', pos: 'Менеджер', t: '12:30', ap: 'Асхана Буфет', dir: 'вход' },
    { d: '2024-03-16', dept: 'Отдел Продаж', fio: 'Смирнов Алексей Владимирович', tab: '003', pos: 'Менеджер', t: '17:40', ap: 'Главный Вход', dir: 'выход' },
  ];

  let rIdx = 8;
  for (const item of sampleData) {
    const row = ws.getRow(rIdx);
    row.getCell(1).value = item.d;
    row.getCell(2).value = item.dept;
    row.getCell(3).value = item.fio;
    row.getCell(4).value = item.tab;
    row.getCell(5).value = item.pos;
    row.getCell(6).value = item.t;
    row.getCell(7).value = item.ap;
    row.getCell(8).value = item.dir;
    rIdx++;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return arrayBuffer as ArrayBuffer;
}
