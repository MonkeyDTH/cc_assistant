import { create } from "zustand";
import type { Project, ActiveSession, Settings, NavItem, ProfilesConfig, AppConfig } from "@/lib/types";
import { api } from "@/lib/tauri-api";
import { encodeCwdToProjectId } from "@/lib/utils";

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

  // 从 Dashboard 点击活跃会话后，传递给 SessionsPage 自动选中
  preselectedSessionId: string | null;
  setPreselectedSession: (id: string | null) => void;

  // Settings
  settings: Settings | null;
  settingsLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;

  // API Profiles
  profilesConfig: ProfilesConfig | null;
  profilesLoading: boolean;
  fetchProfiles: () => Promise<void>;
  saveProfiles: (config: ProfilesConfig) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;

  // App 偏好设置
  appConfig: AppConfig | null;
  appConfigLoading: boolean;
  fetchAppConfig: () => Promise<void>;
  updateAppConfig: (config: AppConfig) => Promise<void>;

  // 删除项目
  deleteProject: (projectId: string) => Promise<void>;

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

  preselectedSessionId: null,
  setPreselectedSession: (id) => set({ preselectedSessionId: id }),

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

  // API Profiles
  profilesConfig: null,
  profilesLoading: false,
  fetchProfiles: async () => {
    set({ profilesLoading: true });
    try {
      const profilesConfig = await api.readProfiles();
      set({ profilesConfig });
    } finally {
      set({ profilesLoading: false });
    }
  },
  saveProfiles: async (config) => {
    await api.writeProfiles(config);
    set({ profilesConfig: config });
  },
  switchProfile: async (profileId) => {
    await api.activateProfile(profileId);
    // 更新本地状态中的 activeProfileId
    const current = get().profilesConfig;
    if (current) {
      set({ profilesConfig: { ...current, activeProfileId: profileId } });
    }
  },

  // App 偏好设置
  appConfig: null,
  appConfigLoading: false,
  fetchAppConfig: async () => {
    set({ appConfigLoading: true });
    try {
      const appConfig = await api.readAppConfig();
      set({ appConfig });
    } finally {
      set({ appConfigLoading: false });
    }
  },
  updateAppConfig: async (config) => {
    await api.writeAppConfig(config);
    set({ appConfig: config });
  },

  // 删除项目：删除后从列表移除
  deleteProject: async (projectId: string) => {
    await api.deleteProject(projectId);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== projectId) }));
  },

  // 根据活跃会话判断某项目是否正在运行
  isProjectActive: (projectId: string) => {
    const { activeSessions } = get();
    return activeSessions.some((s) =>
      encodeCwdToProjectId(s.cwd).toLowerCase() === projectId.toLowerCase()
    );
  },
}));
