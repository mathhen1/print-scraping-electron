import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, nativeImage, screen } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

let window: BrowserWindow | null = null;
let backgroundMode = false;
let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 680,
    minHeight: 520,
    show: false,
    backgroundColor: '#111318',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (event) => {
    if (backgroundMode && !isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { if (window === win) window = null; });
  return win;
}

function showWindow(): BrowserWindow {
  if (!window) window = createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return window;
}

async function captureScreen(): Promise<void> {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: display.size.width * display.scaleFactor, height: display.size.height * display.scaleFactor },
  });
  const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) return;
  const dataUrl = source.thumbnail.toDataURL();
  const win = showWindow();
  win.webContents.send('capture:ready', dataUrl);
}

app.whenReady().then(() => {
  window = createWindow();
  globalShortcut.register('PrintScreen', () => { void captureScreen(); });
  ipcMain.handle('app:toggle-background', (_event, enabled: boolean) => {
    backgroundMode = enabled;
    return backgroundMode;
  });
  ipcMain.handle('capture:request', () => captureScreen());
  ipcMain.handle('image:save', async (_event, dataUrl: string) => {
    const match = /^data:image\/png;base64,([\s\S]+)$/.exec(dataUrl);
    if (!match) throw new Error('Formato de imagem inválido.');
    const directory = path.join(app.getPath('pictures'), 'PrintScraping');
    await mkdir(directory, { recursive: true });
    const filename = `print-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const filepath = path.join(directory, filename);
    await writeFile(filepath, Buffer.from(match[1], 'base64'));
    return filepath;
  });
  ipcMain.handle('image:copy', async (_event, dataUrl: string) => {
    clipboardWriteImage(dataUrl);
    return true;
  });
});

function clipboardWriteImage(dataUrl: string): void {
  // Lazy import keeps the renderer isolated from Electron APIs.
  const { clipboard } = require('electron') as typeof import('electron');
  clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
}

app.on('activate', () => { showWindow(); });
app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !backgroundMode) app.quit(); });
