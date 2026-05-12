const crypto = require('crypto');

function registrarHandlersOperadores(ipcMain, db) {
  ipcMain.handle('operadores:listar', () => {
    try {
      const banco = db.obterDb();
      return banco.prepare('SELECT id, nome, nivel_acesso, ativo, criado_em FROM operadores WHERE ativo = 1').all();
    } catch (err) {
      return [];
    }
  });

  ipcMain.handle('operadores:autenticar', (_event, pin) => {
    try {
      const banco = db.obterDb();
      const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
      const operador = banco.prepare('SELECT id, nome, nivel_acesso FROM operadores WHERE pin_hash = ? AND ativo = 1').get(pinHash);
      if (!operador) return { ok: false, erro: 'PIN inválido' };
      return { ok: true, operador };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('operadores:salvar', (_event, operador) => {
    try {
      const banco = db.obterDb();
      if (operador.id) {
        if (operador.pin) {
          const pinHash = crypto.createHash('sha256').update(operador.pin).digest('hex');
          banco.prepare('UPDATE operadores SET nome = ?, pin_hash = ?, nivel_acesso = ? WHERE id = ?').run(operador.nome, pinHash, operador.nivel_acesso, operador.id);
        } else {
          banco.prepare('UPDATE operadores SET nome = ?, nivel_acesso = ? WHERE id = ?').run(operador.nome, operador.nivel_acesso, operador.id);
        }
        return { ok: true, id: operador.id };
      }
      const pinHash = crypto.createHash('sha256').update(operador.pin).digest('hex');
      const result = banco.prepare('INSERT INTO operadores (nome, pin_hash, nivel_acesso) VALUES (?, ?, ?)').run(operador.nome, pinHash, operador.nivel_acesso || 'operador');
      return { ok: true, id: result.lastInsertRowid };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('operadores:excluir', (_event, id) => {
    try {
      const banco = db.obterDb();
      if (id === 1) return { ok: false, erro: 'Não pode excluir o administrador padrão' };
      banco.prepare('UPDATE operadores SET ativo = 0 WHERE id = ?').run(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });
}

module.exports = { registrarHandlersOperadores };
