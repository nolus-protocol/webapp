import { RouteNames } from "@/router";

export const sidebarIconMap: Record<string, string> = {
  [RouteNames.LEASES]: "leases",
  [RouteNames.HISTORY]: "history"
};

export const mainMenuRoutes = Object.values(RouteNames).filter(
  (name) => ![RouteNames.STATS, RouteNames.DASHBOARD, RouteNames.VOTE].includes(name)
);

export function routePath(item: RouteNames): string {
  return item === RouteNames.DASHBOARD ? "/" : `/${item}`;
}
