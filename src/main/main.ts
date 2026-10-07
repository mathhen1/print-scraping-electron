import { app, BrowserWindow, ClipboardItem, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, OpenDialogOptions, screen } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

let window: BrowserWindow | null = null;
let backgroundMode = false;
let isQuitting = false;
let saveDirectory = '';

function getDefaultSaveDirectory(): string {
  return path.join(app.getPath('pictures'), 'PrintScraping');
}

async function loadPreferences(): Promise<void> {
  saveDirectory = getDefaultSaveDirectory();
  const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
  try {
    const preferences = JSON.parse(await readFile(preferencesPath, 'utf8')) as { saveDirectory?: unknown };
    if (typeof preferences.saveDirectory === 'string' && preferences.saveDirectory.trim()) {
      saveDirectory = preferences.saveDirectory;
    }
  } catch {
    // Missing or invalid preferences use the default save location.
  }
}

async function chooseSaveDirectory(): Promise<void> {

  const options: OpenDialogOptions = {
    title: 'Select folder to save',
    properties: ['openDirectory', 'createDirectory'],
  } as const;

  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return;

  const selectedDirectory = result.filePaths[0];
  const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
  await mkdir(path.dirname(preferencesPath), { recursive: true });
  await writeFile(preferencesPath, JSON.stringify({ saveDirectory: selectedDirectory }, null, 2), 'utf8');
  saveDirectory = selectedDirectory;
  window?.webContents.send('image:save-directory-changed', saveDirectory);
}

function createApplicationMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Select folder to save', click: () => { void chooseSaveDirectory(); } },
        { type: 'separator' },
        { label: 'Exit', click: () => app.quit() },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PrintScraping',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'About PrintScraping',
              message: 'PrintScraping',
              detail: `Version ${app.getVersion()}`,
            });
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

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
  let display = screen.getPrimaryDisplay();
  try {
    display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  } catch {
    // Some Linux display servers do not expose the global cursor position.
  }
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

app.whenReady().then(async () => {
  await loadPreferences();
  createApplicationMenu();
  window = createWindow();
  globalShortcut.register('PrintScreen', () => { void captureScreen(); });
  ipcMain.handle('app:toggle-background', (_event, enabled: boolean) => {
    backgroundMode = enabled;
    return backgroundMode;
  });
  ipcMain.handle('capture:request', () => captureScreen());
  ipcMain.handle('image:get-save-directory', () => saveDirectory || getDefaultSaveDirectory());
  ipcMain.handle('image:save', async (_event, dataUrl: string) => {
    const match = /^data:image\/png;base64,([\s\S]+)$/.exec(dataUrl);
    if (!match) throw new Error('Formato de imagem inválido.');
    const directory = saveDirectory || getDefaultSaveDirectory();
    await mkdir(directory, { recursive: true });
    const filename = `print-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const filepath = path.join(directory, filename);
    await writeFile(filepath, Buffer.from(match[1], 'base64'));
    return filepath;
  });
  ipcMain.handle('image:copy', async (_event, dataUrl: string) => {
    await clipboardWriteImage(dataUrl);
    return true;
  });
});

async function clipboardWriteImage(dataUrl: string): Promise<void> {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) throw new Error('Imagem inválida para copiar.');
  const png = image.toPNG();
  const pngArrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  await clipboard.write([
    new ClipboardItem({ 'image/png': new Blob([pngArrayBuffer], { type: 'image/png' }) }),
  ]);
}

app.on('activate', () => { showWindow(); });
app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !backgroundMode) app.quit(); });
