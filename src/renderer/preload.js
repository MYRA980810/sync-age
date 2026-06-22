import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('syncAgent', {
  detectAspel: () => ipcRenderer.invoke('detect-aspel'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  authenticateAgent: (email, password) => ipcRenderer.invoke('authenticate-agent', email, password),
  startOnboarding: (posType) => ipcRenderer.invoke('start-onboarding', posType),
  completeOnboarding: (config) => ipcRenderer.invoke('complete-onboarding', config),
  onForceSync: (callback) => ipcRenderer.on('force-sync', callback),
  onSyncUpdate: (callback) => ipcRenderer.on('sync-update', callback)
});
