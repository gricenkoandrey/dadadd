import { ProcessedReportResult, ShiftConfig } from '../types';
import { calcLateEarly, getShiftParams, minsToTimeStr, minsToDurationStr } from './excelProcessor';

function timeStrToMins(timeStr: string): number {
  if (!timeStr || timeStr === 'нет входа' || timeStr === 'нет выхода') return -1;
  const parts = timeStr.split(':');
  if (parts.length < 2) return -1;
  const hrs = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hrs) || isNaN(mins)) return -1;
  return hrs * 60 + mins;
}

export function updateReportRecord(
  report: ProcessedReportResult,
  groupIndex: number,
  recordIndex: number,
  newFirstInStr: string, // "HH:MM" or "нет входа"
  newLastOutStr: string, // "HH:MM" or "нет выхода"
  config: ShiftConfig
): ProcessedReportResult {
  const newReport = JSON.parse(JSON.stringify(report)) as ProcessedReportResult;
  const group = newReport.employeeGroups.find((g: any) => g.index === groupIndex);
  if (!group) return newReport;
  
  const record = group.dailyRecords[recordIndex];
  if (!record) return newReport;

  // parse new times
  const newFirstInMins = timeStrToMins(newFirstInStr);
  let newLastOutMins = timeStrToMins(newLastOutStr);
  
  // Update record fields
  record.firstInMins = newFirstInMins;
  record.firstInStr = newFirstInMins !== -1 ? minsToTimeStr(newFirstInMins) : 'нет входа';
  
  record.lastOutMins = newLastOutMins;
  let lastOutCorrMins = newLastOutMins;
  if (newLastOutMins !== -1) {
    const shift = getShiftParams(newFirstInMins, newLastOutMins, config);
    lastOutCorrMins = shift.lastOutCorr;
    record.lastOutStr = minsToTimeStr(lastOutCorrMins % (24 * 60));
  } else {
    record.lastOutStr = 'нет выхода';
  }
  record.lastOutCorrMins = lastOutCorrMins;

  const { lateMins, earlyMins, totalMins } = calcLateEarly(newFirstInMins, newLastOutMins, config);
  const shiftParams = getShiftParams(newFirstInMins, newLastOutMins, config);
  
  const graceLate = ('gracePeriodLateMins' in config) ? (config as any).gracePeriodLateMins : 0;
  const graceEarly = ('gracePeriodEarlyMins' in config) ? (config as any).gracePeriodEarlyMins : 0;

  let isLate = newFirstInMins !== -1 && newFirstInMins > shiftParams.startMins + graceLate;
  let isEarlyExit = newLastOutMins !== -1 && shiftParams.lastOutCorr < shiftParams.endMins - graceEarly;
  let finalTotalMins = totalMins;
  let finalLateMins = lateMins;
  let finalEarlyMins = earlyMins;

  const countWeekend = ('countWeekendViolations' in config) ? (config as any).countWeekendViolations : false;
  if (record.isWeekend && !countWeekend) {
    finalTotalMins = null;
    finalLateMins = 0;
    finalEarlyMins = 0;
    isLate = false;
    isEarlyExit = false;
  }

  let hasViolation = (finalTotalMins !== null && finalTotalMins > 0) || isLate || isEarlyExit;
  const countMissingIn = ('countMissingInAsViolation' in config) ? (config as any).countMissingInAsViolation : false;
  const countMissingOut = ('countMissingOutAsViolation' in config) ? (config as any).countMissingOutAsViolation : false;
  if (countMissingIn && newFirstInMins === -1 && !record.isWeekend && !record.isAbsent) {
    hasViolation = true;
  }
  if (countMissingOut && newLastOutMins === -1 && !record.isWeekend && !record.isAbsent) {
    hasViolation = true;
  }

  const totalViolationTimeStr = minsToDurationStr(finalTotalMins);

  record.lateMins = finalLateMins;
  record.earlyMins = finalEarlyMins;
  record.totalViolationMins = finalTotalMins || 0;
  record.totalViolationTimeStr = totalViolationTimeStr;
  record.isLate = isLate;
  record.isEarlyExit = isEarlyExit;
  record.hasViolation = hasViolation;
  record.missingIn = newFirstInMins === -1;
  record.missingOut = newLastOutMins === -1;

  // Recalculate group totals
  group.totalViolationsCount = 0;
  group.totalViolationMinutes = 0;
  group.totalLateMinutes = 0;
  group.totalEarlyMinutes = 0;
  group.missingPunchDays = 0;

  for (const r of group.dailyRecords) {
    if (r.hasViolation) group.totalViolationsCount++;
    group.totalViolationMinutes += r.totalViolationMins;
    group.totalLateMinutes += r.lateMins;
    group.totalEarlyMinutes += r.earlyMins;
    if (r.missingIn || r.missingOut) group.missingPunchDays++;
  }

  // Recalculate global totals
  let globalViolations = 0;
  let globalLateEvents = 0;
  let globalEarlyEvents = 0;
  let globalMissingPunches = 0;
  let globalViolationMinutes = 0;

  for (const g of newReport.employeeGroups) {
    for (const r of g.dailyRecords) {
      if (r.hasViolation) globalViolations++;
      if (r.isLate) globalLateEvents++;
      if (r.isEarlyExit) globalEarlyEvents++;
      if (r.missingIn || r.missingOut) globalMissingPunches++;
      globalViolationMinutes += r.totalViolationMins;
    }
  }

  newReport.summaryMetrics.totalViolations = globalViolations;
  newReport.summaryMetrics.totalLateEvents = globalLateEvents;
  newReport.summaryMetrics.totalEarlyEvents = globalEarlyEvents;
  newReport.summaryMetrics.totalMissingPunches = globalMissingPunches;
  newReport.summaryMetrics.totalViolationMinutes = globalViolationMinutes;

  return newReport;
}
