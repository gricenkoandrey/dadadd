import { CompanyConfig } from '../types';

export const DEFAULT_COMPANIES: CompanyConfig[] = [
  {
    id: 'zhigermunayservice',
    name: 'ТОО "Жигермунайсервис"',
    departmentMatch: 'Жигермунайсервис,ЖМС,ZMS',
    isDefault: true,
    dayStartMins: 8 * 60,      // 08:00
    dayEndMins: 17 * 60,      // 17:00
    eveningStartMins: 17 * 60, // 17:00
    eveningEndMins: 24 * 60,   // 24:00
    nightStartMins: 21 * 60,   // 21:00
    nightEndMins: 6 * 60 + 24 * 60, // 06:00 след. дня
    thresholdEveningMins: 14 * 60, // 14:00
    thresholdNightMins: 21 * 60,   // 21:00
    lunchWindowStartMins: 11 * 60, // 11:00 (Окно обеда С)
    lunchWindowEndMins: 15 * 60,   // 15:00 (Окно обеда По)
    lunchFixedEndMins: 12 * 60,    // 12:00
    gracePeriodLateMins: 15,       // 15 мин допуск на опоздание
    gracePeriodEarlyMins: 15,      // 15 мин допуск на ранний уход
    workDays: [1, 2, 3, 4, 5],     // Пн, Вт, Ср, Чт, Пт
    accessPoints: [],
    countMissingInAsViolation: false,
    countMissingOutAsViolation: false,
    countWeekendViolations: false,
    workWeekType: '5days',
  },
  {
    id: 'office-administration',
    name: 'Офис / Администрация (09:00 - 18:00)',
    departmentMatch: 'Офис,Администрация,Бухгалтерия,Руководство,ИТ,Юристы,Кадры',
    isDefault: false,
    dayStartMins: 9 * 60,      // 09:00
    dayEndMins: 18 * 60,      // 18:00
    eveningStartMins: 18 * 60, // 18:00
    eveningEndMins: 24 * 60,   // 24:00
    nightStartMins: 22 * 60,   // 22:00
    nightEndMins: 6 * 60 + 24 * 60,
    thresholdEveningMins: 15 * 60,
    thresholdNightMins: 22 * 60,
    lunchWindowStartMins: 13 * 60, // 13:00
    lunchWindowEndMins: 14 * 60,   // 14:00
    lunchFixedEndMins: 14 * 60,    // 14:00
    gracePeriodLateMins: 10,       // 10 мин люфт
    gracePeriodEarlyMins: 5,
    countMissingInAsViolation: false,
    countMissingOutAsViolation: false,
    countWeekendViolations: false,
    workWeekType: '5days',
  },
  {
    id: 'production-shop',
    name: 'Производство / Цех / Склад (08:00 - 20:00)',
    departmentMatch: 'Цех,Производство,Склад,Сервисный участок,Участок,Механика,Сварка,Бригада',
    isDefault: false,
    dayStartMins: 8 * 60,      // 08:00
    dayEndMins: 20 * 60,      // 20:00
    eveningStartMins: 20 * 60, // 20:00
    eveningEndMins: 8 * 60 + 24 * 60, // 08:00 след. дня
    nightStartMins: 20 * 60,
    nightEndMins: 8 * 60 + 24 * 60,
    thresholdEveningMins: 16 * 60,
    thresholdNightMins: 20 * 60,
    lunchWindowStartMins: 12 * 60,
    lunchWindowEndMins: 14 * 60,
    lunchFixedEndMins: 13 * 60,
    gracePeriodLateMins: 0,       // 0 минут (строгая сменная дисциплина)
    gracePeriodEarlyMins: 0,
    countMissingInAsViolation: true,
    countMissingOutAsViolation: true,
    countWeekendViolations: false,
    workWeekType: 'shift',        // Сменный график
  },
  {
    id: 'transport-logistics',
    name: 'Транспортный отдел / Водители (07:30 - 16:30)',
    departmentMatch: 'Транспорт,Гараж,Водители,Автобаза,Логистика,Автоколонна',
    isDefault: false,
    dayStartMins: 7 * 60 + 30, // 07:30
    dayEndMins: 16 * 60 + 30,  // 16:30
    eveningStartMins: 16 * 60 + 30,
    eveningEndMins: 24 * 60,
    nightStartMins: 21 * 60,
    nightEndMins: 6 * 60 + 24 * 60,
    thresholdEveningMins: 14 * 60,
    thresholdNightMins: 21 * 60,
    lunchWindowStartMins: 11 * 60 + 30,
    lunchWindowEndMins: 13 * 60 + 30,
    lunchFixedEndMins: 12 * 60 + 30,
    gracePeriodLateMins: 5,
    gracePeriodEarlyMins: 5,
    countMissingInAsViolation: false,
    countMissingOutAsViolation: false,
    countWeekendViolations: false,
    workWeekType: '6days',        // 6-дневная рабочая неделя
  },
];

const STORAGE_KEY_COMPANIES = 'skud_company_profiles_v1';
const STORAGE_KEY_ACTIVE_COMPANY = 'skud_active_company_id_v1';

export function loadSavedCompanies(): CompanyConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load companies from localStorage', e);
  }
  return DEFAULT_COMPANIES;
}

export function saveCompanies(companies: CompanyConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  } catch (e) {
    console.warn('Failed to save companies to localStorage', e);
  }
}

export function loadActiveCompanyId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY_ACTIVE_COMPANY);
    if (id) return id;
  } catch (e) {
    // ignore
  }
  return 'auto'; // 'auto' means auto-detect by department, or fallback to default
}

export function saveActiveCompanyId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_COMPANY, id);
  } catch (e) {
    // ignore
  }
}
