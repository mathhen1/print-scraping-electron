import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('printScraping', {
  onCapture: (callback: (dataUrl: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dataUrl: string) => callback(dataUrl);
    ipcRenderer.on('capture:ready', listener);
    return () => ipcRenderer.removeListener('capture:ready', listener);
  },
  toggleBackground: (enabled: boolean) => ipcRenderer.invoke('app:toggle-background', enabled) as Promise<boolean>,
  requestCapture: () => ipcRenderer.invoke('capture:request') as Promise<void>,
  saveImage: (dataUrl: string) => ipcRenderer.invoke('image:save', dataUrl) as Promise<string>,
  copyImage: (dataUrl: string) => ipcRenderer.invoke('image:copy', dataUrl) as Promise<boolean>,
});
