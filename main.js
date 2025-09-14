const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let splashWindow;
let mainWindow;
let userDataPath;

// Otomatik güncelleyici ayarları
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    transparent: false,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile('splash.html');
  
  const mainScreen = screen.getPrimaryDisplay();
  const dimensions = mainScreen.size;
  splashWindow.setPosition(
    Math.floor(dimensions.width / 2 - 250),
    Math.floor(dimensions.height / 2 - 175)
  );

  // Splash ekranında otomatik güncelleme kontrolü
  setTimeout(() => {
    checkForUpdates();
  }, 1000);
}

function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates();
  } catch (error) {
    console.log('Update check failed:', error);
  }
}

// Güncelleme event'leri
autoUpdater.on('checking-for-update', () => {
  if (splashWindow) {
    splashWindow.webContents.send('update-message', 'Güncellemeler kontrol ediliyor...');
  }
});

autoUpdater.on('update-available', (info) => {
  if (splashWindow) {
    splashWindow.webContents.send('update-message', `Yeni sürüm mevcut: v${info.version}`);
    splashWindow.webContents.send('update-progress', 'Güncelleme indiriliyor...');
    
    // Otomatik indir
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-not-available', (info) => {
  if (splashWindow) {
    splashWindow.webContents.send('update-message', 'En son sürüm kullanılıyor');
    setTimeout(() => {
      if (splashWindow) {
        createMainWindow();
      }
    }, 1000);
  }
});

autoUpdater.on('error', (err) => {
  console.log('Update error:', err);
  if (splashWindow) {
    splashWindow.webContents.send('update-message', 'Güncelleme hatası oluştu');
    setTimeout(() => {
      if (splashWindow) {
        createMainWindow();
      }
    }, 1000);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (splashWindow) {
    const percent = Math.round(progressObj.percent);
    splashWindow.webContents.send('update-progress', `İndiriliyor... ${percent}%`);
    splashWindow.webContents.send('update-progress-value', percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (splashWindow) {
    splashWindow.webContents.send('update-message', 'Güncelleme tamamlandı!');
    splashWindow.webContents.send('update-progress', 'Uygulama yeniden başlatılıyor...');
    
    setTimeout(() => {
      setImmediate(() => autoUpdater.quitAndInstall());
    }, 2000);
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('app.html');

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
      }
      mainWindow.show();
      userDataPath = app.getPath('userData');
      mainWindow.webContents.send('user-data-path', userDataPath);
      
      // Uygulama içinde periyodik güncelleme kontrolü
      setInterval(() => {
        checkForUpdatesInApp();
      }, 30 * 60 * 1000); // 30 dakikada bir
    }, 500);
  });

  // IPC handlers
  ipcMain.handle('save-note', async (event, noteData) => {
    try {
      const notesDir = path.join(userDataPath, 'notes');
      if (!fs.existsSync(notesDir)) {
        fs.mkdirSync(notesDir, { recursive: true });
      }
      
      const fileName = `${noteData.id}.json`;
      const filePath = path.join(notesDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(noteData, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-notes', async () => {
    try {
      const notesDir = path.join(userDataPath, 'notes');
      if (!fs.existsSync(notesDir)) {
        return { success: true, notes: [] };
      }
      
      const files = fs.readdirSync(notesDir);
      const notes = [];
      
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(notesDir, file);
          const data = fs.readFileSync(filePath, 'utf8');
          notes.push(JSON.parse(data));
        }
      });
      
      return { success: true, notes: notes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-note', async (event, noteId) => {
    try {
      const notesDir = path.join(userDataPath, 'notes');
      const fileName = `${noteId}.json`;
      const filePath = path.join(notesDir, fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: 'Not bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Güncelleme kontrolü için IPC
  ipcMain.handle('check-for-updates', async () => {
    return checkForUpdatesInApp();
  });
}

// Uygulama içinde güncelleme kontrolü
async function checkForUpdatesInApp() {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? { available: true, version: result.updateInfo.version } : { available: false };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

app.whenReady().then(() => {
  createSplashScreen();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplashScreen();
  }
});