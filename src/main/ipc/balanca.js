let SerialPort = null;
let ReadlineParser = null;

try {
  SerialPort = require('serialport').SerialPort;
  ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
} catch (err) {
  console.warn('Módulo serialport não disponível - balança desabilitada:', err.message);
}

let portoBalanca = null;
let ultimoPeso = 0;

function inicializarBalanca(config = { path: 'COM1', baudRate: 9600 }) {
  if (!SerialPort) {
    console.warn('SerialPort não disponível');
    return;
  }

  if (portoBalanca) {
    try { portoBalanca.close(); } catch (e) { /* ignore */ }
  }

  try {
    portoBalanca = new SerialPort({
      path: config.path,
      baudRate: config.baudRate,
      autoOpen: true,
    });

    const parser = portoBalanca.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
      const match = data.match(/(\d+\.?\d*)/);
      if (match) {
        ultimoPeso = parseFloat(match[1]);
      }
    });

    portoBalanca.on('error', (err) => {
      console.error('Erro na Balança:', err.message);
    });
  } catch (err) {
    console.error('Falha ao abrir porta serial da balança:', err);
  }
}

function registrarHandlersBalanca(ipcMain) {
  ipcMain.handle('balanca:lerPeso', () => {
    return ultimoPeso;
  });

  ipcMain.handle('balanca:configurar', (_event, config) => {
    if (!SerialPort) {
      return { ok: false, erro: 'Módulo serialport não disponível' };
    }
    try {
      inicializarBalanca(config);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('balanca:listarPortas', async () => {
    if (!SerialPort) {
      return [];
    }
    try {
      return await SerialPort.list();
    } catch (err) {
      console.error('Erro ao listar portas:', err);
      return [];
    }
  });
}

module.exports = { registrarHandlersBalanca };
