const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const db = require('./database');

// Importação de Handlers
const { registrarHandlersBackup } = require('./ipc/backup');
const { registrarHandlersBalanca } = require('./ipc/balanca');
const { registrarHandlersCaixa } = require('./ipc/caixa');
const { registrarHandlersImpressao } = require('./ipc/impressao');
const { registrarHandlersLicenca } = require('./ipc/licenca');
const { registrarHandlersOperadores } = require('./ipc/operadores');
const { registrarHandlersProdutos } = require('./ipc/produtos');
const { registrarHandlersRelatorios } = require('./ipc/relatorios');
const { registrarHandlersVendas } = require('./ipc/vendas');
const { registrarHandlersClientes } = require('./ipc/clientes');

let mainWindow;

// Configuração básica do autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Inicia oculta para evitar "flashing"
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  const indexPath = path.join(__dirname, '../../dist/index.html');
  mainWindow.loadFile(indexPath).catch(err => console.error("Erro ao carregar HTML:", err));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registrarTodosHandlers() {
  try {
    registrarHandlersBackup(ipcMain, db);
    registrarHandlersProdutos(ipcMain, db);
    registrarHandlersVendas(ipcMain, db);
    registrarHandlersCaixa(ipcMain, db);
    registrarHandlersOperadores(ipcMain, db);
    registrarHandlersLicenca(ipcMain, db);
    registrarHandlersRelatorios(ipcMain, db);
    registrarHandlersClientes(ipcMain, db);
    
    // Handlers sem dependência de DB
    try {
      registrarHandlersBalanca(ipcMain);
    } catch (err) {
      console.warn('Balança não disponível:', err.message);
    }
    registrarHandlersImpressao(ipcMain, db);

    // Handlers do Updater
    ipcMain.handle('app:versao', () => app.getVersion());
    ipcMain.handle('updater:verificar', () => {
      autoUpdater.checkForUpdatesAndNotify();
      return { ok: true };
    });
    ipcMain.handle('updater:instalar', () => {
      autoUpdater.quitAndInstall();
      return { ok: true };
    });

    autoUpdater.on('update-available', () => {
      if (mainWindow) mainWindow.webContents.send('updater:status', 'Uma nova atualização está disponível. Baixando...');
    });

    autoUpdater.on('update-downloaded', () => {
      if (mainWindow) mainWindow.webContents.send('updater:status', 'Atualização concluída. Reiniciando para instalar...');
    });

    autoUpdater.on('error', (err) => console.error('Erro no updater:', err));

  } catch (err) {
    console.error("Erro ao registrar handlers:", err);
  }
}

app.whenReady().then(() => {
  try {
    db.inicializar();
    registrarTodosHandlers();
    
    ipcMain.on('janela:minimizar', () => mainWindow?.minimize());
    ipcMain.on('janela:maximizar', () => {
      if (!mainWindow) return;
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    });
    ipcMain.on('janela:fechar', () => mainWindow?.close());
    ipcMain.handle('janela:abrirLink', (_event, url) => {
      shell.openExternal(url);
      return { ok: true };
    });
    ipcMain.handle('janela:abrirWhatsApp', (_event, url) => {
      shell.openExternal(url);
      return { ok: true };
    });

    createWindow();
  } catch (err) {
    console.error("Falha crítica no startup:", err);
    createWindow(); // Tenta abrir a janela mesmo assim
  }
});

app.on('window-all-closed', () => {
  db.fechar();
  if (process.platform !== 'darwin') app.quit();
});

// Tratamento de erros não capturados para evitar que o app morra silenciosamente
process.on('uncaughtException', (err) => {
  console.error('Excessão não capturada:', err);
});

