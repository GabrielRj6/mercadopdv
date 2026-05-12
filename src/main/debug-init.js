const { app } = require('electron');

console.log('--- Debug de Inicializacao ---');
try {
  console.log('Testando better-sqlite3...');
  require('better-sqlite3');
  console.log('OK: better-sqlite3');
} catch (e) {
  console.error('ERRO: better-sqlite3', e.message);
}

try {
  console.log('Testando serialport...');
  require('serialport');
  console.log('OK: serialport');
} catch (e) {
  console.error('ERRO: serialport', e.message);
}

try {
  console.log('Testando escpos...');
  require('escpos');
  console.log('OK: escpos');
} catch (e) {
  console.error('ERRO: escpos', e.message);
}

app.whenReady().then(() => {
  console.log('App ready. UserData path:', app.getPath('userData'));
  app.quit();
});
