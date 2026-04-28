export interface CsvImportReport {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export interface CsvImportReportPopupProps {
  report: CsvImportReport | null;
}
