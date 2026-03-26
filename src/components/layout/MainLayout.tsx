import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/stores/app-store";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PromptPage } from "@/components/prompt/PromptPage";
import { SkillsPage } from "@/components/skills/SkillsPage";
import { PluginsPage } from "@/components/plugins/PluginsPage";
import { HooksPage } from "@/components/hooks/HooksPage";
import { SessionsPage } from "@/components/sessions/SessionsPage";
import { SettingsPage } from "@/components/settings/SettingsPage";

const PAGE_MAP = {
  dashboard: Dashboard,
  prompt:    PromptPage,
  skills:    SkillsPage,
  plugins:   PluginsPage,
  hooks:     HooksPage,
  sessions:  SessionsPage,
  settings:  SettingsPage,
} as const;

export function MainLayout() {
  const { activeNav, fetchProjects } = useAppStore();

  // 启动时加载项目列表
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const PageComponent = PAGE_MAP[activeNav];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <PageComponent />
      </main>
    </div>
  );
}
