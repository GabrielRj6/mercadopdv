const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

function registrarHandlersBackup(ipcMain, db) {
  ipcMain.handle('backup:criar', async () => {
    try {
      const caminhoBanco = db.obterCaminho();
      const pastaBackup = path.join(app.getPath('desktop'), 'MercadoPDV_Backups');

      if (!fs.existsSync(pastaBackup)) {
        fs.mkdirSync(pastaBackup, { recursive: true });
      }

      const agora = new Date();
      const nomeArquivo = `backup_${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}_${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}.db`;
      const destino = path.join(pastaBackup, nomeArquivo);

      const banco = db.obterDb();
      await banco.backup(destino);

      return { ok: true, caminho: destino };
    } catch (err) {
      console.error("Erro no backup:", err);
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('backup:selecionarArquivo', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar backup para restaurar',
      filters: [{ name: 'Banco SQLite', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('backup:restaurar', (_event, caminho) => {
    if (!caminho || !fs.existsSync(caminho)) {
      return { ok: false, erro: 'Arquivo não encontrado' };
    }

    const caminhoBanco = db.obterCaminho();

    db.fechar();
    fs.copyFileSync(caminho, caminhoBanco);
    db.inicializar();

    return { ok: true };
  });
}

module.exports = { registrarHandlersBackup };
