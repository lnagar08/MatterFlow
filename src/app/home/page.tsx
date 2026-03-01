import { HomeMattersList } from "@/components/home-matters-list";
import { AppNav } from "@/components/app-nav";
import { requireFirmMembership } from "@/lib/firm-access";
import { getHomeData } from "@/lib/home-data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string; direction?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { membership, user } = await requireFirmMembership();
  const params = await searchParams;
  const initialSearch = (params.q ?? "").trim();
  const initialFilter =
    params.filter === "at-risk" ||
    params.filter === "bottlenecked" ||
    params.filter === "on-track" ||
    params.filter === "due-soon" ||
    params.filter === "needs-attention" ||
    params.filter === "aging-matters" ||
    params.filter === "all-active" ||
    params.filter === "overdue-steps" ||
    params.filter === "penalty-box"
      ? params.filter
      : "all-active";
  const initialSort = params.sort ?? "engagementDate";
  const initialDirection = params.direction ?? "desc";
  const prefKey = user?.id
    ? `matterflow.dashboardVisible.${user.id}.${membership.firmId}`
    : "matterflow.dashboardVisible";
  const compactPrefKey = user?.id
    ? `matterflow.compactMode.${user.id}.${membership.firmId}`
    : "matterflow.compactMode";

  const { rows, metrics } = await getHomeData({
    firmId: membership.firmId,
    query: initialSearch
  });

  return (
    <main className="overflow-x-hidden home-main">
      <HomeMattersList
        rows={rows}
        metrics={metrics}
        dashboardPreferenceKey={prefKey}
        compactPreferenceKey={compactPrefKey}
        initialFilter={initialFilter}
        initialSort={initialSort}
        initialDirection={initialDirection}
        initialSearch={initialSearch}
        navBar={<AppNav active="home" userName={user?.name ?? user?.email ?? "Admin"} />}
      />
    </main>
  );
}
