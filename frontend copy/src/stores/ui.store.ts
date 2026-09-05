import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  workspaceView: 'list' | 'pipeline';
  setWorkspaceView: (view: 'list' | 'pipeline') => void;
  activeNavTab: 'QUOTATIONS' | 'PIPELINE' | 'DASHBOARD' | 'REPORTS' | 'ADMIN';
  setActiveNavTab: (tab: 'QUOTATIONS' | 'PIPELINE' | 'DASHBOARD' | 'REPORTS' | 'ADMIN') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  workspaceView: 'list',
  setWorkspaceView: (view) => set({ workspaceView: view }),
  activeNavTab: 'QUOTATIONS',
  setActiveNavTab: (tab) => set({ activeNavTab: tab }),
}));
