const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const db = require('./database');

const { registrarHandlersBackup } = require('./ipc/backup');
const { registrarHandlersBalanca } = require('./ipc/balanca');
const { registrarHandlersCaixa } = require('./ipc/caixa');
const { registrarHandlersImpressao } = require('./ipc/impressao');
const { registrarHandlersLicenca } = require('./ipc/licenca');
const { registrarHandlersOperadores } = require('./ipc/operadores');
const { registrarHandlersProdutos } = require('./ipc/produtos');
const { registrarHandlersRelatorios } = require('./ipc/relatorios');
const { registrarHandlersVendas } = require('./ipc/vendas');

let mainWindow;

// Configuração básica do autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function createWindow() {
  Menu.setApplicationMenu(null); // Remove o menu 'File, Edit...'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // REMOVE A BARRA PADRÃO DO WINDOWS
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  const indexPath = path.join(__dirname, '../../dist/index.html');
  mainWindow.loadFile(indexPath).catch(err => {
    console.error("Erro ao carregar:", err);
  });

  // DEVTOOLS DESATIVADO
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const registrarTodosHandlers = () => {
  registrarHandlersBackup(ipcMain, db);
  registrarHandlersProdutos(ipcMain, db);
  registrarHandlersVendas(ipcMain, db);
  registrarHandlersCaixa(ipcMain, db);
  registrarHandlersOperadores(ipcMain, db);
  registrarHandlersBackup(ipcMain, db);
  registrarHandlersLicenca(ipcMain, db);
  registrarHandlersBalanca(ipcMain, db);
  registrarHandlersImpressao(ipcMain, db);

  // Handlers do Updater
  ipcMain.handle('app:versao', () => app.getVersion());
  ipcMain.handle('updater:verificar', () => {
    autoUpdater.checkForUpdatesAndNotify();
    return { ok: true };
  });

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('updater:status', 'Uma nova atualização esta disponível. Baixando...');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:status', 'Atualização baixada. Reinicie para instalar.');
    // Se quiser forçar a instalação: autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro no updater:', err);
  });
};

  app.whenReady().then(() => {
  db.inicializar();
  registrarTodosHandlers();
  
  // Handlers para controle da janela (Minimize, Maximize, Close)
  ipcMain.on('janela:minimizar', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('janela:maximizar', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('janela:fechar', () => {
    if (mainWindow) mainWindow.close();
  });

  createWindow();
});

app.on('window-all-closed', () => {
  db.fechar();
  if (process.platform !== 'darwin') app.quit();
});

