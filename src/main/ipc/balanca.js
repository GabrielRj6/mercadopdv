const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

let portoBalança = null;
let ultimoPeso = 0;

function inicializarBalanca(config = { path: 'COM1', baudRate: 9600 }) {
  if (portoBalança) {
    portoBalança.close();
  }

  try {
    portoBalança = new SerialPort({
      path: config.path,
      baudRate: config.baudRate,
      autoOpen: true,
    });

    const parser = portoBalança.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
      const match = data.match(/(\d+\.\d+)/);
      if (match) {
        ultimoPeso = parseFloat(match[1]);
      }
    });

    portoBalança.on('error', (err) => {
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
    inicializarBalanca(config);
    return { ok: true };
  });

  ipcMain.handle('balanca:listarPortas', async () => {
    return await SerialPort.list();
  });
}

module.exports = { registrarHandlersBalanca };
