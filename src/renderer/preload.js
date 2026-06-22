import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('livecomerceAgent', {
  login: (email, password) =>
    ipcRenderer.invoke('agent:login', { email, password }),
  getStatus: () =>
    ipcRenderer.invoke('agent:getStatus'),
  onSyncUpdate: (callback) =>
    ipcRenderer.on('agent:syncUpdate', (_, data) => callback(data)),
  detectPOS: () =>
    ipcRenderer.invoke('agent:detectPOS'),
});
