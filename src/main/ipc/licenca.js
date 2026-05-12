const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');

function obterHwid() {
  const id = machineIdSync();
  return crypto.createHash('sha256').update(id).digest('hex');
}

function registrarHandlersLicenca(ipcMain) {
  ipcMain.handle('licenca:hwid', () => {
    return obterHwid();
  });

  ipcMain.handle('licenca:verificar', () => {
    return { ativa: true, tipo: 'local' };
  });

  ipcMain.handle('licenca:ativar', (_event, chave) => {
    return { ok: true };
  });
}

module.exports = { registrarHandlersLicenca };
