import { app, BrowserWindow, Menu, dialog } from 'electron';
import path from 'path';
import { closeDatabase } from './db/database';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  try {
    // Register IPC handlers (Database opens only after Gate unlock or setup!)
    registerIpcHandlers();
  } catch (err: any) {
    dialog.showErrorBox('Sistem Başlatma Hatası', err?.message || String(err));
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 740,
    title: 'Nakliye Defterim',
    backgroundColor: '#141716',
    icon: path.join(__dirname, '../../build/icon.ico'),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).catch((err) => {
      dialog.showErrorBox('Arayüz Yükleme Hatası', err?.message || String(err));
    });
  }

  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
