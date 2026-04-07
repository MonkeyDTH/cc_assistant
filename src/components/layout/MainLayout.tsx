import { lazy, Suspense, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/stores/app-store";

// 懒加载各页面，减小首屏 bundle
const Dashboard    = lazy(() => import("@/components/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const PromptPage   = lazy(() => import("@/components/prompt/PromptPage").then((m) => ({ default: m.PromptPage })));
const MemoryPage   = lazy(() => import("@/components/memory/MemoryPage").then((m) => ({ default: m.MemoryPage })));
const SkillsPage   = lazy(() => import("@/components/skills/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const PluginsPage  = lazy(() => import("@/components/plugins/PluginsPage").then((m) => ({ default: m.PluginsPage })));
const HooksPage    = lazy(() => import("@/components/hooks/HooksPage").then((m) => ({ default: m.HooksPage })));
const SessionsPage   = lazy(() => import("@/components/sessions/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const ModelPage      = lazy(() => import("@/components/model/ModelPage").then((m) => ({ default: m.ModelPage })));
const PermissionPage = lazy(() => import("@/components/permission/PermissionPage").then((m) => ({ default: m.PermissionPage })));
const ProfilesPage   = lazy(() => import("@/components/profiles/ProfilesPage").then((m) => ({ default: m.ProfilesPage })));

const PAGE_MAP = {
  dashboard:  Dashboard,
  prompt:     PromptPage,
  memory:     MemoryPage,
  skills:     SkillsPage,
  plugins:    PluginsPage,
  hooks:      HooksPage,
  sessions:   SessionsPage,
  model:      ModelPage,
  permission: PermissionPage,
  profiles:   ProfilesPage,
} as const;

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
        <div className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        加载中…
      </div>
    </div>
  );
}

// 轮询间隔（ms）：活跃会话每 30s 刷新一次
const SESSION_POLL_INTERVAL = 30_000;

export function MainLayout() {
  const { activeNav, fetchProjects } = useAppStore();

  // 启动时初始加载
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 窗口/标签页重新激活时刷新项目状态
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchProjects();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchProjects]);

  // 定时轮询活跃会话（仅刷新活跃会话，不重建项目列表）
  useEffect(() => {
    const { getState } = useAppStore;
    const timer = setInterval(() => {
      // 只有窗口可见时才轮询，避免后台无效请求
      if (document.visibilityState === "visible") {
        getState().fetchProjects();
      }
    }, SESSION_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const PageComponent = PAGE_MAP[activeNav];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden" style={{ background: "var(--surface)" }}>
        <Suspense fallback={<PageFallback />}>
          <PageComponent />
        </Suspense>
      </main>
    </div>
  );
}
