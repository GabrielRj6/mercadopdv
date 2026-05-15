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
    try {
      if (!caminho || !fs.existsSync(caminho)) {
        return { ok: false, erro: 'Arquivo não encontrado' };
      }

      const caminhoBanco = db.obterCaminho();
      const caminhoBackup = caminhoBanco + '.backup_temp';

      if (fs.existsSync(caminhoBackup)) {
        fs.unlinkSync(caminhoBackup);
      }

      fs.copyFileSync(caminhoBanco, caminhoBackup);

      try {
        db.fechar();
        fs.copyFileSync(caminho, caminhoBanco);
        db.inicializar();

        const banco = db.obterDb();
        if (!banco) {
          throw new Error('Falha ao reabrir banco após restauração');
        }

        banco.prepare('SELECT 1').get();

        return { ok: true };
      } catch (restoreErr) {
        console.error('Erro na restauração, tentando reverter:', restoreErr);
        if (fs.existsSync(caminhoBackup)) {
          fs.copyFileSync(caminhoBackup, caminhoBanco);
          db.inicializar();
        }
        return { ok: false, erro: 'Falha na restauração: ' + restoreErr.message + '. Backup original mantido.' };
      } finally {
        if (fs.existsSync(caminhoBackup)) {
          try { fs.unlinkSync(caminhoBackup); } catch (e) { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Erro geral na restauração:', err);
      return { ok: false, erro: err.message };
    }
  });
}

module.exports = { registrarHandlersBackup };
