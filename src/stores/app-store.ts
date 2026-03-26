import { create } from "zustand";
import type { Project, ActiveSession, Settings, NavItem } from "@/lib/types";
import { api } from "@/lib/tauri-api";

interface AppState {
  // 导航
  activeNav: NavItem;
  setActiveNav: (nav: NavItem) => void;

  // 项目
  projects: Project[];
  activeSessions: ActiveSession[];
  projectsLoading: boolean;
  fetchProjects: () => Promise<void>;

  // 选中的项目（用于 Sessions / Prompt 页面）
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;

  // Settings
  settings: Settings | null;
  settingsLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;

  // 派生选择器（不存入 store state，仅作运行时函数）
  isProjectActive: (projectId: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 导航
  activeNav: "dashboard",
  setActiveNav: (nav) => set({ activeNav: nav }),

  // 项目
  projects: [],
  activeSessions: [],
  projectsLoading: false,
  fetchProjects: async () => {
    set({ projectsLoading: true });
    try {
      const [projects, activeSessions] = await Promise.all([
        api.listProjects(),
        api.getActiveSessions(),
      ]);
      set({ projects, activeSessions });
    } finally {
      set({ projectsLoading: false });
    }
  },

  selectedProjectId: null,
  setSelectedProject: (id) => set({ selectedProjectId: id }),

  // Settings
  settings: null,
  settingsLoading: false,
  fetchSettings: async () => {
    set({ settingsLoading: true });
    try {
      const settings = await api.readSettings();
      set({ settings });
    } finally {
      set({ settingsLoading: false });
    }
  },
  updateSettings: async (settings) => {
    await api.writeSettings(settings);
    set({ settings });
  },

  // 根据活跃会话判断某项目是否正在运行
  isProjectActive: (projectId: string) => {
    const { activeSessions } = get();
    return activeSessions.some((s) => {
      // cwd 解码比较（简单包含匹配）
      return s.cwd.replace(/\\/g, "/").includes(projectId.replace(/--/g, "/"));
    });
  },
}));
