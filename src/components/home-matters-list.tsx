"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardTriage } from "@/components/home/dashboard-triage";
import { ImportMattersModal } from "@/components/import-matters-modal";
import { useUiPreference } from "@/hooks/use-ui-preference";
import type { HomeMetrics } from "@/lib/home-data";
import { MatterRowCard } from "@/components/matter-row-card";

type Health = "Bottlenecked" | "At Risk" | "On Track";

type HomeMatterRow = {
  id: string;
  clientLogoUrl: string;
  clientName: string;
  matterTitle: string;
  engagementDate: string;
  createdAt: string;
  daysOpen: number;
  amountPaid: number | null;
  overdueStepsCount: number;
  progressPercent: number;
  health: Health;
  reason: string;
  lastActivityAt: string;
  hasDueSoon: boolean;
  hasOverdue: boolean;
  isOverdue: boolean;
  isStalled: boolean;
  hasDueToday: boolean;
  hasDueThisWeek: boolean;
  isCashAtRisk: boolean;
  newIntakeToday: boolean;
  isAtRisk: boolean;
  isOnTrack: boolean;
  isBottlenecked: boolean;
  isAging: boolean;
  isPenaltyBox: boolean;
  statusLabel: "On Track" | "Needs Attention" | "Bottlenecked" | "Penalty Box";
  nextStepLabel: string;
  nextStepDueAt: string | null;
  currentStageTitle: string;
  currentStageExpectedDays: number | null;
  currentStageElapsedDays: number | null;
  currentStageGraceDays: number;
  matterFlowName: string;
};

type FilterQuery = "all-active" | "penalty-box";
type SortMode =
  | "engagement-desc"
  | "engagement-asc"
  | "added-desc"
  | "added-asc"
  | "daysOpen"
  | "revenue";
type DashboardFilter = "none" | "in-flow" | "needs-attention" | "overdue" | "penalty-box" | "all-active";

type Props = {
  rows: HomeMatterRow[];
  metrics: HomeMetrics;
  dashboardPreferenceKey: string;
  initialFilter?:
    | "all-active"
    | "at-risk"
    | "bottlenecked"
    | "on-track"
    | "overdue-steps"
    | "due-soon"
    | "needs-attention"
    | "aging-matters"
    | "penalty-box";
  initialSort?: string;
  initialDirection?: string;
  initialSearch?: string;
};

function parseSortMode(sort: string | null | undefined, direction: string | null | undefined): SortMode {
  if (sort === "daysOpen") return "daysOpen";
  if (sort === "revenue") return "revenue";
  if (sort === "engagementDate") return direction === "asc" ? "engagement-asc" : "engagement-desc";
  if (sort === "addedDate") return direction === "asc" ? "added-asc" : "added-desc";
  if (sort === "engagement-asc" || sort === "engagement-desc" || sort === "added-asc" || sort === "added-desc") {
    return sort;
  }
  return "engagement-desc";
}

function getSortQuery(sortMode: SortMode) {
  if (sortMode === "daysOpen") return { sort: "daysOpen", direction: "desc" as const };
  if (sortMode === "revenue") return { sort: "revenue", direction: "desc" as const };
  if (sortMode.startsWith("engagement")) {
    return { sort: "engagementDate", direction: sortMode.endsWith("asc") ? ("asc" as const) : ("desc" as const) };
  }
  return { sort: "addedDate", direction: sortMode.endsWith("asc") ? ("asc" as const) : ("desc" as const) };
}

function parseDashboardFilter(value: string | null | undefined): DashboardFilter {
  if (
    value === "in-flow" ||
    value === "needs-attention" ||
    value === "overdue" ||
    value === "penalty-box" ||
    value === "all-active"
  ) {
    return value;
  }
  if (value === "workload") return "all-active";
  return "none";
}

export function HomeMattersList({
  rows,
  metrics,
  dashboardPreferenceKey,
  initialFilter = "all-active",
  initialSort = "engagementDate",
  initialDirection = "desc",
  initialSearch = ""
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [overdueOnly, setOverdueOnly] = useState(initialFilter === "overdue-steps");
  const [penaltyOnly, setPenaltyOnly] = useState(initialFilter === "penalty-box");
  const [search, setSearch] = useState(initialSearch);
  const [sortMode, setSortMode] = useState<SortMode>(parseSortMode(initialSort, initialDirection));
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>(parseDashboardFilter(searchParams.get("op")));
  const [dashboardVisible, setDashboardVisible] = useUiPreference(dashboardPreferenceKey, true);
  const [mockupLayout, setMockupLayout] = useUiPreference(`${dashboardPreferenceKey}.mockupLayout`, true);
  const [importOpen, setImportOpen] = useState(false);

  const isDateSort = sortMode.startsWith("engagement") || sortMode.startsWith("added");
  const isRevenueSort = sortMode === "revenue";
  const sortField = sortMode.startsWith("added") ? "addedDate" : "engagementDate";
  const sortDirection = sortMode.endsWith("asc") ? "asc" : "desc";

  function setQueryParams(next: {
    overdueOnly?: boolean;
    penaltyOnly?: boolean;
    sortMode?: SortMode;
    q?: string;
    op?: DashboardFilter;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextOverdueOnly = next.overdueOnly ?? overdueOnly;
    const nextPenaltyOnly = next.penaltyOnly ?? penaltyOnly;
    const nextSearch = next.q ?? search;
    const nextOp = next.op ?? dashboardFilter;

    params.set("filter", nextPenaltyOnly ? "penalty-box" : nextOverdueOnly ? "overdue-steps" : "all-active");

    if (next.sortMode) {
      const sortQuery = getSortQuery(next.sortMode);
      params.set("sort", sortQuery.sort);
      params.set("direction", sortQuery.direction);
    }

    if (nextSearch.trim()) {
      params.set("q", nextSearch.trim());
    } else {
      params.delete("q");
    }
    if (nextOp !== "none") {
      params.set("op", nextOp);
    } else {
      params.delete("op");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setSort(nextSortMode: SortMode) {
    setSortMode(nextSortMode);
    setQueryParams({ sortMode: nextSortMode });
  }

  function setSortField(nextField: "engagementDate" | "addedDate") {
    const direction = sortDirection === "asc" ? "asc" : "desc";
    const nextSortMode = `${nextField === "engagementDate" ? "engagement" : "added"}-${direction}` as SortMode;
    setSort(nextSortMode);
  }

  function setSortDirection(nextDirection: "asc" | "desc") {
    if (!isDateSort) return;
    const base = sortField === "engagementDate" ? "engagement" : "added";
    const nextSortMode = `${base}-${nextDirection}` as SortMode;
    setSort(nextSortMode);
  }

  function clearSpecialSort() {
    setSort("engagement-desc");
  }

  const matchesDashboardFilter = useCallback((row: HomeMatterRow) => {
    if (dashboardFilter === "none") return true;
    if (dashboardFilter === "all-active") return true;
    if (dashboardFilter === "in-flow") return row.isOnTrack;
    if (dashboardFilter === "needs-attention") return row.isAtRisk;
    if (dashboardFilter === "overdue") return row.isOverdue || row.isBottlenecked;
    if (dashboardFilter === "penalty-box") return row.isPenaltyBox;
    return true;
  }, [dashboardFilter]);

  useEffect(() => {
    const queryFilter = searchParams.get("filter");
    const querySort = searchParams.get("sort");
    const queryDirection = searchParams.get("direction");
    const queryOp = searchParams.get("op");
    const querySearch = searchParams.get("q") ?? "";

    const nextSort = parseSortMode(querySort, queryDirection);
    const nextOp = parseDashboardFilter(queryOp);

    setOverdueOnly(queryFilter === "overdue-steps");
    setPenaltyOnly(queryFilter === "penalty-box");
    setSortMode(nextSort);
    setDashboardFilter(nextOp);
    setSearch(querySearch);
  }, [searchParams]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    const filteredRows = rows.filter((row) => {
      if (overdueOnly && !(row.isOverdue || row.isBottlenecked)) {
        return false;
      }
      if (penaltyOnly && !row.isPenaltyBox) {
        return false;
      }
      if (!matchesDashboardFilter(row)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return (
        row.clientName.toLowerCase().includes(normalized) ||
        row.matterTitle.toLowerCase().includes(normalized)
      );
    });

    return filteredRows.sort((a, b) => {
      if (sortMode === "daysOpen") {
        return b.daysOpen - a.daysOpen;
      }
      if (sortMode === "revenue") {
        return (b.amountPaid ?? 0) - (a.amountPaid ?? 0);
      }

      const aTime =
        sortMode === "engagement-desc" || sortMode === "engagement-asc"
          ? new Date(a.engagementDate).getTime()
          : new Date(a.createdAt).getTime();
      const bTime =
        sortMode === "engagement-desc" || sortMode === "engagement-asc"
          ? new Date(b.engagementDate).getTime()
          : new Date(b.createdAt).getTime();

      return sortMode === "engagement-asc" || sortMode === "added-asc" ? aTime - bTime : bTime - aTime;
    });
  }, [overdueOnly, penaltyOnly, rows, search, sortMode, matchesDashboardFilter]);

  const activeFilterLabel = dashboardFilter === "needs-attention"
    ? "At Flow Risk"
    : dashboardFilter === "overdue"
      ? "Out of Flow"
      : dashboardFilter === "penalty-box"
        ? "Flow Breakdown"
        : dashboardFilter === "in-flow"
          ? "In Flow"
          : dashboardFilter === "all-active"
            ? "All Active"
          : overdueOnly
            ? "Overdue Flow Steps"
            : penaltyOnly
              ? "Flow Breakdown"
              : "All Active";

  function flowStatusText(row: HomeMatterRow) {
    if (row.isPenaltyBox) return "Flow Breakdown";
    if (row.isBottlenecked || row.isOverdue) return "Out of Flow";
    if (row.isAtRisk) return "At Flow Risk";
    return "In Flow";
  }

  function flowStatusClass(row: HomeMatterRow) {
    if (row.isPenaltyBox || row.isOverdue || row.isBottlenecked) return "danger";
    if (row.isAtRisk) return "warning";
    return "success";
  }

  function dueText(row: HomeMatterRow) {
    if (!row.nextStepDueAt) return "No due date";
    const due = new Date(row.nextStepDueAt);
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil((due.getTime() - now.getTime()) / msPerDay);
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  }

  function timeInStage(row: HomeMatterRow) {
    if (row.currentStageElapsedDays === null || row.currentStageExpectedDays === null) {
      return <span className="meta">No stage target</span>;
    }

    const elapsed = row.currentStageElapsedDays;
    const elapsedLabel =
      elapsed <= 0 ? "Started today" : elapsed === 1 ? "1 day in stage" : `${elapsed} days in stage`;
    const target = row.currentStageExpectedDays;
    const grace = Math.max(0, row.currentStageGraceDays ?? 0);
    const limit = target + grace;
    const overLimit = elapsed - limit;

    if (overLimit > 0) {
      return (
        <div>
          <strong>{elapsedLabel}</strong>
          <div className="meta text-danger">{`${overLimit}d over limit`}</div>
        </div>
      );
    }

    const remainingToLimit = Math.max(0, limit - elapsed);
    return (
      <div>
        <strong>{elapsedLabel}</strong>
        <div className="meta">{`${remainingToLimit}d left`}</div>
      </div>
    );
  }

  
  const { data: session, status } = useSession();

  const user = session?.user as { 
    role: string; 
    permissions: {
      viewMatter: string;
    }; 
  } | undefined;

  const isViewMetterPermission = (user?.role === 'STAFF' && !user?.permissions.viewMatter? true: false);
  
  if (mockupLayout) {
    return (
      <div className="flow-mockup-shell">
        <div className="flow-mockup-body">
          <section className="flow-mockup-main">
            <header className="flow-mockup-header">
              <div>
                <h1 style={{ margin: 0 }}>Flow Control</h1>
                <p className="meta">Keep every matter in <span style={{ color: "#059669", fontWeight: 600 }}>Flow</span></p>
              </div>
              <div className="flow-mockup-header-actions">
                <label className="search-wrap">
                  <span className="search-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5653 21.3498C10.8278 21.3498 9.12928 20.8346 7.68459 19.8692C6.23991 18.9039 5.11391 17.5319 4.449 15.9267C3.78408 14.3214 3.61011 12.555 3.94908 10.8509C4.28805 9.1468 5.12474 7.58146 6.35334 6.35286C7.58195 5.12425 9.14729 4.28756 10.8514 3.94859C12.5555 3.60962 14.3219 3.78359 15.9272 4.44851C17.5324 5.11342 18.9044 6.23942 19.8697 7.6841C20.835 9.12879 21.3503 10.8273 21.3503 12.5648C21.3503 13.7185 21.123 14.8608 20.6816 15.9267C20.2401 16.9925 19.593 17.961 18.7772 18.7767C17.9614 19.5925 16.993 20.2396 15.9272 20.6811C14.8613 21.1226 13.7189 21.3498 12.5653 21.3498ZM12.5653 5.54146C11.1808 5.54146 9.82743 5.952 8.67629 6.72117C7.52514 7.49034 6.62793 8.58359 6.09812 9.86267C5.56831 11.1418 5.42968 12.5492 5.69978 13.9071C5.96988 15.265 6.63656 16.5122 7.61553 17.4912C8.5945 18.4702 9.84178 19.1369 11.1996 19.407C12.5575 19.6771 13.965 19.5384 15.2441 19.0086C16.5231 18.4788 17.6164 17.5816 18.3856 16.4304C19.1547 15.2793 19.5653 13.9259 19.5653 12.5415C19.5653 10.6849 18.8278 8.90446 17.515 7.59171C16.2023 6.27895 14.4218 5.54146 12.5653 5.54146Z" fill="black"></path><path d="M23.3336 24.2081C23.2187 24.2087 23.1047 24.1862 22.9986 24.1422C22.8924 24.0981 22.7961 24.0333 22.7153 23.9515L17.8969 19.1331C17.7424 18.9673 17.6582 18.7479 17.6622 18.5212C17.6662 18.2945 17.7581 18.0782 17.9184 17.9179C18.0787 17.7576 18.295 17.6658 18.5217 17.6618C18.7484 17.6578 18.9677 17.7419 19.1336 17.8965L23.9519 22.7148C24.1158 22.8789 24.2078 23.1013 24.2078 23.3331C24.2078 23.565 24.1158 23.7874 23.9519 23.9515C23.8712 24.0333 23.7749 24.0981 23.6687 24.1422C23.5625 24.1862 23.4486 24.2087 23.3336 24.2081Z" fill="black"></path></svg>
                  </span>
                  <input
                    className="input top-search"
                    value={search}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSearch(value);
                      setQueryParams({ q: value });
                    }}
                    placeholder="Search matters, clients, or steps"
                  />
                </label>
                
                <button type="button" className="button" onClick={() => setImportOpen(true)}>
                  Import CSV
                </button>
                <Link href="/matters/new" className="button primary">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.58301 11.0002H10.9997M10.9997 11.0002H17.4163M10.9997 11.0002V4.5835M10.9997 11.0002V17.4168" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  New Matter
                </Link>
                {/*<button type="button" className="button" onClick={() => setMockupLayout(false)}>
                  Switch to Classic Layout
                </button>*/}
              </div>
            </header>

            {dashboardVisible ? (
              <DashboardTriage
                metrics={metrics}
                rows={rows}
                activeAction={dashboardFilter}
                onAction={(action) => {
                  if (action === "needs-attention") {
                    setOverdueOnly(false);
                    setPenaltyOnly(false);
                    setDashboardFilter("needs-attention");
                    setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "needs-attention" });
                    return;
                  }
                  if (action === "overdue") {
                    setOverdueOnly(true);
                    setPenaltyOnly(false);
                    setDashboardFilter("overdue");
                    setQueryParams({ overdueOnly: true, penaltyOnly: false, op: "overdue" });
                    return;
                  }
                  if (action === "penalty-box") {
                    setOverdueOnly(false);
                    setPenaltyOnly(true);
                    setDashboardFilter("penalty-box");
                    setQueryParams({ overdueOnly: false, penaltyOnly: true, op: "penalty-box" });
                    return;
                  }
                  if (action === "in-flow") {
                    setOverdueOnly(false);
                    setPenaltyOnly(false);
                    setDashboardFilter("in-flow");
                    setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "in-flow" });
                    return;
                  }
                  setOverdueOnly(false);
                  setPenaltyOnly(false);
                  setDashboardFilter("all-active");
                  setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "all-active" });
                }}
              />
            ) : null}

            <section className="flow-mockup-toolbar card">
              <div className="home-filter-summary" aria-live="polite">
                <span className="home-filter-label">Flow slice:</span>
                <span className="home-filter-value">{activeFilterLabel}</span>
                {(dashboardFilter !== "none" || overdueOnly || penaltyOnly) ? (
                  <button
                    type="button"
                    className="home-filter-clear"
                    onClick={() => {
                      setOverdueOnly(false);
                      setPenaltyOnly(false);
                      setDashboardFilter("none");
                      setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "none" });
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="flow-mockup-toolbar-right">
                <label className="dashboard-toggle">
                  <span>Flow Control</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dashboardVisible}
                    className={`toggle-switch ${dashboardVisible ? "on" : ""}`}
                    onClick={() => setDashboardVisible((value) => !value)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
                <label className="sort-field-wrap">
                  <span className="home-sort-label">Sort</span>
                  <select
                    className="home-select"
                    value={sortField}
                    onChange={(event) => setSortField(event.target.value as "engagementDate" | "addedDate")}
                  >
                    <option value="engagementDate">Engagement Date</option>
                    <option value="addedDate">Added Date</option>
                  </select>
                </label>
                {!isRevenueSort ? (
                  <label className="sort-field-wrap">
                    <span className="home-sort-label">Direction</span>
                    <select
                      className="home-select"
                      value={sortDirection}
                      onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                      disabled={!isDateSort}
                    >
                      <option value="desc">Newest First</option>
                      <option value="asc">Oldest First</option>
                    </select>
                  </label>
                ) : null}
              </div>
            </section>
            
            {!isViewMetterPermission ? (
              <section className="flow-mockup-table card">
              <div className="flow-table-head">
                <span>Matter</span>
                <span>FlowGuardian</span>
                <span>Flow Stage</span>
                <span>Time in Stage</span>
                <span>Next Step</span>
                <span>Flow Status</span>
              </div>
              {filtered.map((row, index) => {
                const statusClass = flowStatusClass(row);
                return (
                  <a key={`${row.id}-${index}`} href={`/matters/${row.id}?order=${sortMode}`} className="flow-table-row">
                    <div>
                      <strong>{row.clientName} - {row.matterTitle}</strong>
                      <div className="meta">{row.reason}</div>
                    </div>
                    <div><span className="pill flow-matterflow-pill">{row.matterFlowName}</span></div>
                    <div>
                      <strong>{row.currentStageTitle}</strong>
                      <div className="flow-table-progress">
                        <span className={`flow-table-progress-fill ${statusClass}`} style={{ width: `${Math.max(8, row.progressPercent)}%` }} />
                      </div>
                    </div>
                    <div>{timeInStage(row)}</div>
                    <div>
                      <strong>{row.nextStepLabel}</strong>
                      <div className={`meta flow-next-step-meta ${statusClass === "danger" ? "text-danger" : statusClass === "warning" ? "text-warning" : ""}`}>{dueText(row)}</div>
                    </div>
                    <div>
                      <span className={`home-health-badge ${statusClass}`}>{flowStatusText(row)}</span>
                    </div>
                  </a>
                );
              })}
              {filtered.length === 0 ? <div className="meta" style={{ padding: "18px 4px" }}>No active matters found.</div> : null}
            </section>
            ) : (
              null
            )}
            
          </section>
        </div>
        <ImportMattersModal open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    );
  }

  return (
    <div className="home-shell home-shell-mock">
      <section className="home-page-top">
        <div className="home-page-title">
          <h1 style={{ marginBottom: 0 }}>Flow Control</h1>
          <p className="meta">Keep every matter in Flow.</p>
        </div>
        <div className="home-page-actions">
          <button type="button" className="button" onClick={() => setMockupLayout(true)}>
            Use Mockup Layout
          </button>
        </div>
      </section>

      {dashboardVisible ? (
        <DashboardTriage
          metrics={metrics}
          rows={rows}
          activeAction={dashboardFilter}
          onAction={(action) => {
            if (action === "needs-attention") {
              setOverdueOnly(false);
              setPenaltyOnly(false);
              setDashboardFilter("needs-attention");
              setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "needs-attention" });
              return;
            }
            if (action === "overdue") {
              setOverdueOnly(true);
              setPenaltyOnly(false);
              setDashboardFilter("overdue");
              setQueryParams({ overdueOnly: true, penaltyOnly: false, op: "overdue" });
              return;
            }
            if (action === "penalty-box") {
              setOverdueOnly(false);
              setPenaltyOnly(true);
              setDashboardFilter("penalty-box");
              setQueryParams({ overdueOnly: false, penaltyOnly: true, op: "penalty-box" });
              return;
            }
            if (action === "in-flow") {
              setOverdueOnly(false);
              setPenaltyOnly(false);
              setDashboardFilter("in-flow");
              setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "in-flow" });
              return;
            }
            setOverdueOnly(false);
            setPenaltyOnly(false);
            setDashboardFilter("all-active");
            setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "all-active" });
          }}
        />
      ) : null}

      <section className="home-insight-row card">
        <div className="home-insight-text">
          {`Today: ${metrics.triage.todayStrip.todayDueCount} due • ${metrics.triage.todayStrip.todayOverdueCount} overdue`}
          <span aria-hidden="true"> | </span>
          {`This Week: ${metrics.triage.todayStrip.weekDueCount} due`}
          <span aria-hidden="true"> | </span>
          {`New: ${metrics.triage.todayStrip.newIntakeCount} matter created`}
        </div>
        <div className="home-insight-actions">
          <Link href="/matters/new" className="button primary home-primary-cta">
            + New Matter
          </Link>
          <button type="button" className="button" onClick={() => setImportOpen(true)}>
            Import CSV
          </button>
        </div>
      </section>

      <section className="home-workbench">
        <div className="home-controls card">
          <div className="home-filter-summary" aria-live="polite">
            <span className="home-filter-label">Flow slice:</span>
            <span className="home-filter-value">{activeFilterLabel}</span>
            {(dashboardFilter !== "none" || overdueOnly || penaltyOnly) ? (
              <button
                type="button"
                className="home-filter-clear"
                onClick={() => {
                  setOverdueOnly(false);
                  setPenaltyOnly(false);
                  setDashboardFilter("none");
                  setQueryParams({ overdueOnly: false, penaltyOnly: false, op: "none" });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="home-controls-spacer" />

          <div className="home-sort-controls">
            <div className="home-sort-group">
              <div className="home-toggle-strip">
                <label className="dashboard-toggle">
                  <span>Flow Control</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dashboardVisible}
                    className={`toggle-switch ${dashboardVisible ? "on" : ""}`}
                    onClick={() => setDashboardVisible((value) => !value)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
              </div>

              {isRevenueSort ? (
                <span className="state-pill" aria-label="Special sorting active">
                  Revenue (High → Low)
                  <button type="button" onClick={clearSpecialSort} aria-label="Clear special sort">
                    ×
                  </button>
                </span>
              ) : null}

              <label className="sort-field-wrap">
                <span className="home-sort-label">Sort</span>
                <select
                  className="home-select"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as "engagementDate" | "addedDate")}
                >
                  <option value="engagementDate">Engagement Date</option>
                  <option value="addedDate">Added Date</option>
                </select>
              </label>

              {!isRevenueSort ? (
                <label className="sort-field-wrap">
                  <span className="home-sort-label">Direction</span>
                  <select
                    className="home-select"
                    value={sortDirection}
                    onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                    disabled={!isDateSort}
                    title={isDateSort ? "" : "Applies to date sorts"}
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <div className="home-list-scroll" id="home-matter-list">
          <div className="home-list">
            {filtered.map((row, index) => (
              <MatterRowCard key={`${row.id}-${index}`} row={row} sortMode={sortMode} />
            ))}

            {filtered.length === 0 ? (
              <div className="card home-empty">
                <div className="home-empty-illustration">📂</div>
                <div className="card-title">No active matters found</div>
                <div className="meta">Try adjusting your filters or search.</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <ImportMattersModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
