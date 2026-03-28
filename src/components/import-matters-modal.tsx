"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type CanonicalField =
  | "matterTitle"
  | "clientName"
  | "templateName"
  | "matterSummary"
  | "engagementDate"
  | "dueDate"
  | "amountPaid";

type ParsedSourceRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type NormalizedRow = {
  rowNumber: number;
  matterTitle: string;
  clientName: string;
  templateName: string;
  matterSummary: string;
  engagementDate: string | null;
  dueDate: string | null;
  amountPaid: number | null;
};

type PreviewRow = NormalizedRow & {
  status: "valid" | "invalid" | "skipped";
  errors: string[];
};

type FailedRow = {
  index: number;
  message: string;
};

type ImportResponse = {
  imported: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  createdClients: number;
  reusedClients: number;
  failed: FailedRow[];
  invalidRows: Array<{ rowNumber: number; message: string; normalizedRow: NormalizedRow }>;
  duplicateRows: Array<{ rowNumber: number; message: string; normalizedRow: NormalizedRow }>;
  warnings?: Array<{ row: number; message: string }>;
};

const CANONICAL_FIELDS: Array<{ key: CanonicalField; label: string; required?: boolean }> = [
  { key: "matterTitle", label: "Matter Title", required: true },
  { key: "clientName", label: "Client Name", required: true },
  { key: "templateName", label: "FlowGuardian Name" },
  { key: "matterSummary", label: "Matter Summary" },
  { key: "engagementDate", label: "Engagement Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "amountPaid", label: "Amount Paid" }
];

const CHATGPT_PROMPT = `Convert the following data into a CSV with headers:
matterTitle, matterSummary, clientName, engagementDate, dueDate, amountPaid, templateName.
Return ONLY the CSV, no commentary.`;

const DEFAULT_MAPPING: Record<CanonicalField, string> = {
  matterTitle: "",
  clientName: "",
  templateName: "",
  matterSummary: "",
  engagementDate: "",
  dueDate: "",
  amountPaid: ""
};

const SYNONYMS: Record<CanonicalField, string[]> = {
  matterTitle: ["matter", "title", "case", "project", "mattertitle"],
  clientName: ["client", "company", "entity", "customer", "clientname"],
  templateName: ["template", "type", "workflow", "templatename"],
  matterSummary: ["summary", "description", "notes", "mattersummary"],
  engagementDate: ["engagement", "start", "opened", "engagementdate"],
  dueDate: ["due", "deadline", "duedate"],
  amountPaid: ["amount", "fee", "revenue", "paid", "amountpaid"]
};

function cleanHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function normalizeString(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseMoney(raw: string): number | null {
  const normalized = raw.replace(/[^0-9.-]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateToISO(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : value;
  }

  const mmdd = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!mmdd) return null;
  const [, mm, dd, yyyy] = mmdd;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : iso;
}

function downloadTemplateCSV() {
  const csv = `${CANONICAL_FIELDS.map((item) => item.key).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "FlowGuardian-matters-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function mappingStorageKey(columns: string[], fileSize: number) {
  return `matterflow.import.mapping.${columns.join("|")}#${fileSize}`;
}

function getRecommendedMapping(columns: string[]): Record<CanonicalField, string> {
  const normalizedColumns = columns.map((col) => ({ raw: col, normalized: normalizeString(col) }));
  const used = new Set<string>();
  const mapping = { ...DEFAULT_MAPPING };

  for (const field of CANONICAL_FIELDS) {
    const fieldNorm = normalizeString(field.key);
    const exact = normalizedColumns.find((col) => !used.has(col.raw) && col.normalized === fieldNorm);
    if (exact) {
      mapping[field.key] = exact.raw;
      used.add(exact.raw);
      continue;
    }

    const synonyms = SYNONYMS[field.key];
    const fuzzy = normalizedColumns.find(
      (col) =>
        !used.has(col.raw) &&
        synonyms.some((token) => col.normalized.includes(normalizeString(token)) || normalizeString(token).includes(col.normalized))
    );
    if (fuzzy) {
      mapping[field.key] = fuzzy.raw;
      used.add(fuzzy.raw);
    }
  }

  return mapping;
}

function isHeaderRepeated(row: NormalizedRow, mapping: Record<CanonicalField, string>) {
  const titleHeader = normalizeString(mapping.matterTitle || "");
  const clientHeader = normalizeString(mapping.clientName || "");
  const titleValue = normalizeString(row.matterTitle);
  const clientValue = normalizeString(row.clientName);
  if (!titleHeader && !clientHeader) return false;
  return (titleHeader && titleValue === titleHeader) || (clientHeader && clientValue === clientHeader);
}

function hasReportNoise(row: NormalizedRow) {
  const combined = `${row.matterTitle} ${row.clientName} ${row.matterSummary}`.toUpperCase();
  return /TOTAL|REPORT|GENERATED/.test(combined) && !row.matterTitle && !row.clientName;
}

export function ImportMattersModal({ open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<ParsedSourceRow[]>([]);
  const [mapping, setMapping] = useState<Record<CanonicalField, string>>({ ...DEFAULT_MAPPING });
  const [recommendedMapping, setRecommendedMapping] = useState<Record<CanonicalField, string> | null>(null);
  const [showRecommendedBanner, setShowRecommendedBanner] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const mappedRows = useMemo<PreviewRow[]>(() => {
    if (sourceRows.length === 0) return [];

    return sourceRows.map((source) => {
      const read = (field: CanonicalField) => {
        const col = mapping[field];
        if (!col) return "";
        return (source.values[col] ?? "").trim();
      };

      const amountRaw = read("amountPaid");
      const amount = parseMoney(amountRaw);
      const engagementRaw = read("engagementDate");
      const dueRaw = read("dueDate");
      const engagementDate = engagementRaw ? parseDateToISO(engagementRaw) : null;
      const dueDate = dueRaw ? parseDateToISO(dueRaw) : null;

      const row: NormalizedRow = {
        rowNumber: source.rowNumber,
        matterTitle: read("matterTitle"),
        clientName: read("clientName"),
        templateName: read("templateName") || "No FlowGuardian",
        matterSummary: read("matterSummary"),
        engagementDate,
        dueDate,
        amountPaid: amount
      };

      const allMappedEmpty = CANONICAL_FIELDS.every((field) => !read(field.key));
      if (allMappedEmpty) {
        return { ...row, status: "skipped", errors: [] } as PreviewRow;
      }
      if (!row.matterTitle && !row.clientName) {
        return { ...row, status: "skipped", errors: [] } as PreviewRow;
      }
      if (isHeaderRepeated(row, mapping)) {
        return { ...row, status: "skipped", errors: [] } as PreviewRow;
      }
      if (hasReportNoise(row)) {
        return { ...row, status: "skipped", errors: [] } as PreviewRow;
      }

      const errors: string[] = [];
      if (!row.matterTitle) errors.push("Missing matterTitle");
      if (!row.clientName) errors.push("Missing clientName");
      if (amountRaw && amount === null) errors.push("Invalid amountPaid");
      if (amount !== null && amount < 0) errors.push("amountPaid must be >= 0");
      if (engagementRaw && !engagementDate) errors.push("Invalid engagementDate");
      if (dueRaw && !dueDate) errors.push("Invalid dueDate");

      return {
        ...row,
        status: errors.length > 0 ? "invalid" : "valid",
        errors
      } as PreviewRow;
    });
  }, [sourceRows, mapping]);

  const summary = useMemo(() => {
    const valid = mappedRows.filter((row) => row.status === "valid");
    const invalid = mappedRows.filter((row) => row.status === "invalid");
    const skipped = mappedRows.filter((row) => row.status === "skipped");
    return { valid, invalid, skipped };
  }, [mappedRows]);

  const canProceedToPreview = Boolean(mapping.matterTitle && mapping.clientName);
  const recommendedReady = Boolean(recommendedMapping?.matterTitle && recommendedMapping?.clientName);

  if (!open) return null;

  function resetAll() {
    setStep(1);
    setHasHeaderRow(true);
    setSourceColumns([]);
    setSourceRows([]);
    setMapping({ ...DEFAULT_MAPPING });
    setRecommendedMapping(null);
    setShowRecommendedBanner(false);
    setFileSize(0);
    setHeaderError(null);
    setParseError(null);
    setImporting(false);
    setImportResult(null);
    setToast(null);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  function parseUploadedFile(file: File, headerEnabled: boolean) {
    setHeaderError(null);
    setParseError(null);
    setImportResult(null);
    setToast(null);
    setFileSize(file.size);

    if (headerEnabled) {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: "greedy",
        dynamicTyping: false,
        transformHeader: (header) => cleanHeader(header),
        transform: (value) => (typeof value === "string" ? value.trim() : String(value ?? "").trim()),
        complete: (results) => {
          const fields = (results.meta.fields ?? []).map(cleanHeader).filter(Boolean);
          if (fields.length === 0) {
            setParseError("No columns found in CSV.");
            return;
          }
          const rows = (results.data ?? []).map((item, index) => ({
            rowNumber: index + 2,
            values: Object.fromEntries(fields.map((field) => [field, String(item[field] ?? "").trim()]))
          }));
          setSourceColumns(fields);
          setSourceRows(rows);
          const recommendation = getRecommendedMapping(fields);
          setRecommendedMapping(recommendation);
          setShowRecommendedBanner(Boolean(recommendation.matterTitle && recommendation.clientName));
          const key = mappingStorageKey(fields, file.size);
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as Record<string, string>;
              setMapping({ ...DEFAULT_MAPPING, ...parsed } as Record<CanonicalField, string>);
            } catch {
              setMapping({ ...DEFAULT_MAPPING });
            }
          } else {
            setMapping({ ...DEFAULT_MAPPING, ...recommendation });
          }
          setStep(2);
        },
        error: () => setParseError("Unable to parse CSV file.")
      });
      return;
    }

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      transform: (value) => (typeof value === "string" ? value.trim() : String(value ?? "").trim()),
      complete: (results) => {
        const data = results.data ?? [];
        const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
        if (maxCols === 0) {
          setParseError("No columns found in CSV.");
          return;
        }
        const fields = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
        const rows = data.map((row, index) => ({
          rowNumber: index + 1,
          values: Object.fromEntries(fields.map((field, fieldIndex) => [field, String(row[fieldIndex] ?? "").trim()]))
        }));
        setSourceColumns(fields);
        setSourceRows(rows);
        const recommendation = getRecommendedMapping(fields);
        setRecommendedMapping(recommendation);
        setShowRecommendedBanner(Boolean(recommendation.matterTitle && recommendation.clientName));
        const key = mappingStorageKey(fields, file.size);
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Record<string, string>;
            setMapping({ ...DEFAULT_MAPPING, ...parsed } as Record<CanonicalField, string>);
          } catch {
            setMapping({ ...DEFAULT_MAPPING });
          }
        } else {
          setMapping({ ...DEFAULT_MAPPING, ...recommendation });
        }
        setStep(2);
      },
      error: () => setParseError("Unable to parse CSV file.")
    });
  }

  function downloadErrorsCsv() {
    const rows = summary.invalid.map((row) => ({
      rowNumber: row.rowNumber,
      errorMessage: row.errors.join("; "),
      matterTitle: row.matterTitle,
      clientName: row.clientName,
      templateName: row.templateName,
      matterSummary: row.matterSummary,
      engagementDate: row.engagementDate ?? "",
      dueDate: row.dueDate ?? "",
      amountPaid: row.amountPaid ?? ""
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matterflow_import_errors_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadDuplicatesCsv() {
    if (!importResult || importResult.duplicateRows.length === 0) return;
    const rows = importResult.duplicateRows.map((entry) => ({
      rowNumber: entry.rowNumber,
      message: entry.message,
      matterTitle: entry.normalizedRow.matterTitle,
      clientName: entry.normalizedRow.clientName
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matterflow_import_duplicates_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importValidRows() {
    if (summary.valid.length === 0) {
      setParseError("No valid rows to import.");
      return;
    }

    setImporting(true);
    setParseError(null);
    setImportResult(null);

    try {
      const payload = {
        rows: summary.valid.map((row) => ({
          matterTitle: row.matterTitle,
          clientName: row.clientName,
      templateName: row.templateName === "No FlowGuardian" ? "" : row.templateName,
          matterSummary: row.matterSummary,
          engagementDate: row.engagementDate ?? "",
          dueDate: row.dueDate ?? "",
          amountPaid: row.amountPaid
        }))
      };

      const response = await fetch("/api/matters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as ImportResponse & { error?: string };
      if (!response.ok) {
        setParseError(data.error ?? "Import failed.");
        return;
      }

      const key = mappingStorageKey(sourceColumns, fileSize);
      localStorage.setItem(key, JSON.stringify(mapping));
      setImportResult(data);
      setToast(`Imported ${data.imported} matters.`);
    } catch {
      setParseError("Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="import-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div className="import-modal-card">
        <div className="import-modal-head">
          <h2 id="import-modal-title">Import matters (CSV)</h2>
          <button type="button" className="button" onClick={handleClose}>
            Close
          </button>
        </div>

        <p className="meta" style={{ margin: 0 }}>
          Import multiple matters in one shot using a simple CSV file. If your data lives in PracticePanther, Clio,
          Excel, or even a Word/PDF list, you can export/copy it and convert it into this CSV format.
        </p>

        <div className="import-stepper">
          <span className={step === 1 ? "active" : ""}>1. Upload CSV</span>
          <span className={step === 2 ? "active" : ""}>2. Column Mapping</span>
          <span className={step === 3 ? "active" : ""}>3. Preview & Import</span>
        </div>

        {step === 1 ? (
          <>
            <div className="import-instructions">
              <ol>
                <li>
                  <strong>Export or copy your data</strong>
                  <div>PracticePanther / Clio: Export matters/clients to CSV (or export to Excel, then Save As CSV)</div>
                  <div>Excel: Save As → CSV</div>
                  <div>Word/PDF: copy/paste the rows into ChatGPT and ask it to convert into our FlowGuardian CSV</div>
                </li>
                <li>
                  <strong>Use our FlowGuardian headers</strong>
                  <div>Download the FlowGuardian template below and make sure your CSV uses the same header names</div>
                </li>
                <li>
                  <strong>Upload and preview</strong>
                  <div>Upload the CSV to preview the first rows before importing</div>
                </li>
              </ol>
            </div>

            <div className="import-prompt-box">
              <div className="import-prompt-row">
                <strong>ChatGPT conversion prompt</strong>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(CHATGPT_PROMPT);
                    setCopyStatus("copied");
                    setTimeout(() => setCopyStatus("idle"), 1200);
                  }}
                >
                  {copyStatus === "copied" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>{CHATGPT_PROMPT}</pre>
            </div>

            <div className="import-actions-row">
              <button type="button" className="button" onClick={downloadTemplateCSV}>
                Download CSV FlowGuardian Template
              </button>
              <label className="button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      parseUploadedFile(file, hasHeaderRow);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <label className="import-toggle">
                <input
                  type="checkbox"
                  checked={hasHeaderRow}
                  onChange={(event) => setHasHeaderRow(event.target.checked)}
                />
                This file has a header row
              </label>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            {showRecommendedBanner && recommendedReady ? (
              <div className="import-recommended-banner">
                <div>
                  <strong>Recommended mappings found</strong>
                  <div className="meta">We can map your columns automatically. You can adjust anything after.</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      if (!recommendedMapping) return;
                      setMapping(recommendedMapping);
                      setShowRecommendedBanner(false);
                      setToast("Applied recommended mappings.");
                    }}
                  >
                    Use recommended
                  </button>
                  <button type="button" className="button" onClick={() => setShowRecommendedBanner(false)}>
                    Review manually
                  </button>
                </div>
              </div>
            ) : null}

            <div className="import-mapping-grid">
              {CANONICAL_FIELDS.map((field) => (
                <div className="import-map-row" key={field.key}>
                  <label className="meta">
                    {field.label} {field.required ? "*" : ""}
                  </label>
                  <select
                    className="input"
                    value={mapping[field.key]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: event.target.value
                      }))
                    }
                  >
                    <option value="">(Ignore / None)</option>
                    {sourceColumns.map((column) => (
                      <option key={`${field.key}-${column}`} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="import-actions-row">
              <button type="button" className="button" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!canProceedToPreview}
                onClick={() => setStep(3)}
              >
                Continue to Preview
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="import-preview">
              <div className="meta">
                Total rows parsed: {sourceRows.length} • Valid rows: {summary.valid.length} • Invalid rows: {summary.invalid.length} • Skipped rows:{" "}
                {summary.skipped.length}
              </div>
              {summary.invalid.length > 0 ? (
                <div className="import-warning">Some rows are missing required fields and will be skipped.</div>
              ) : null}
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Matter Title</th>
                    <th>Client Name</th>
                    <th>FlowGuardian Name</th>
                    <th>Matter Summary</th>
                    <th>Engagement Date</th>
                    <th>Due Date</th>
                    <th>Amount Paid</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows
                    .filter((row) => row.status !== "skipped")
                    .slice(0, 10)
                    .map((row) => (
                      <tr key={row.rowNumber} className={row.status === "invalid" ? "invalid" : ""}>
                        <td>{row.rowNumber}</td>
                        <td>{row.matterTitle || "—"}</td>
                        <td>{row.clientName || "—"}</td>
                        <td>{row.templateName || "No FlowGuardian"}</td>
                        <td>{row.matterSummary || "—"}</td>
                        <td>{row.engagementDate || "—"}</td>
                        <td>{row.dueDate || "—"}</td>
                        <td>{row.amountPaid ?? "—"}</td>
                        <td>{row.errors.join(", ") || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="import-actions-row">
              <button type="button" className="button" onClick={() => setStep(2)}>
                Back to Mapping
              </button>
              {summary.invalid.length > 0 ? (
                <button type="button" className="button" onClick={downloadErrorsCsv}>
                  Download Errors CSV
                </button>
              ) : null}
              <button
                type="button"
                className="button primary"
                onClick={importValidRows}
                disabled={summary.valid.length === 0 || importing}
              >
                {importing ? "Importing..." : `Import ${summary.valid.length} matters`}
              </button>
            </div>
          </>
        ) : null}

        {headerError ? (
          <div className="import-error">
            {headerError} <button type="button" className="button" onClick={downloadTemplateCSV}>Download FlowGuardian template</button>
          </div>
        ) : null}
        {parseError ? <div className="import-error">{parseError}</div> : null}
        {toast ? <div className="import-toast">{toast}</div> : null}

        {importResult ? (
          <div className="import-result">
            <div>Imported matters: {importResult.imported}</div>
            <div>Skipped invalid rows: {importResult.skippedInvalid}</div>
            <div>Skipped duplicates: {importResult.skippedDuplicate}</div>
            <div>Clients reused: {importResult.reusedClients}</div>
            <div>Clients created: {importResult.createdClients}</div>
            <div>Warnings: {importResult.warnings?.length ?? 0}</div>
            <div className="meta">We never overwrite existing data. We reused existing clients and skipped duplicate matters automatically.</div>
            {importResult.failed.length > 0 ? (
              <div className="meta">Server failures: {importResult.failed.slice(0, 3).map((f) => `Row ${f.index}: ${f.message}`).join(" | ")}</div>
            ) : null}
            {importResult.duplicateRows.length > 0 ? (
              <button type="button" className="button" onClick={downloadDuplicatesCsv}>
                Download Duplicates CSV
              </button>
            ) : null}
            <Link className="button" href="/home?filter=all-active&sort=engagementDate&direction=desc" scroll={false}>
              View Matters
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
