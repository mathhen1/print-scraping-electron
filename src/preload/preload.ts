import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('printScraping', {
  onCapture: (callback: (dataUrl: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dataUrl: string) => callback(dataUrl);
    ipcRenderer.on('capture:ready', listener);
    return () => ipcRenderer.removeListener('capture:ready', listener);
  },
  onSaveDirectoryChanged: (callback: (directory: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, directory: string) => callback(directory);
    ipcRenderer.on('image:save-directory-changed', listener);
    return () => ipcRenderer.removeListener('image:save-directory-changed', listener);
  },
  toggleBackground: (enabled: boolean) => ipcRenderer.invoke('app:toggle-background', enabled) as Promise<boolean>,
  requestCapture: () => ipcRenderer.invoke('capture:request') as Promise<void>,
  saveImage: (dataUrl: string) => ipcRenderer.invoke('image:save', dataUrl) as Promise<string>,
  getSaveDirectory: () => ipcRenderer.invoke('image:get-save-directory') as Promise<string>,
  copyImage: (dataUrl: string) => ipcRenderer.invoke('image:copy', dataUrl) as Promise<boolean>,
});
