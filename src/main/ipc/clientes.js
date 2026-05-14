function registrarHandlersClientes(ipcMain, db) {
  // Listar clientes
  ipcMain.handle('clientes:listar', (_event, filtros = {}) => {
    try {
      const banco = db.obterDb();
      let sql = `
        SELECT c.*,
          COALESCE((SELECT SUM(CASE WHEN tipo = 'debito' THEN valor ELSE -valor END) FROM cliente_contas WHERE cliente_id = c.id), 0) as saldo_devedor
        FROM clientes c
        WHERE c.ativo = 1
      `;
      const params = [];

      if (filtros.busca) {
        sql += ' AND (c.nome LIKE ? OR c.telefone LIKE ? OR c.cpf LIKE ?)';
        params.push(`%${filtros.busca}%`, `%${filtros.busca}%`, `%${filtros.busca}%`);
      }

      if (filtros.apenasDevedores) {
        sql += ' HAVING saldo_devedor > 0';
      }

      sql += ' ORDER BY c.nome ASC';
      return banco.prepare(sql).all(...params);
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      return [];
    }
  });

  // Buscar cliente por ID (com extrato)
  ipcMain.handle('clientes:buscarPorId', (_event, id) => {
    try {
      const banco = db.obterDb();
      const cliente = banco.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
      if (!cliente) return null;

      cliente.movimentos = banco.prepare(`
        SELECT cc.*, o.nome as operador_nome
        FROM cliente_contas cc
        LEFT JOIN operadores o ON cc.operador_id = o.id
        WHERE cc.cliente_id = ?
        ORDER BY cc.data DESC
      `).all(id);

      const saldo = banco.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo = 'debito' THEN valor ELSE -valor END), 0) as saldo
        FROM cliente_contas WHERE cliente_id = ?
      `).get(id);

      cliente.saldo_devedor = saldo.saldo;
      return cliente;
    } catch (err) {
      console.error('Erro ao buscar cliente:', err);
      return null;
    }
  });

  // Salvar cliente (criar ou atualizar)
  ipcMain.handle('clientes:salvar', (_event, cliente) => {
    try {
      const banco = db.obterDb();

      if (cliente.id) {
        banco.prepare(`
          UPDATE clientes SET nome = ?, telefone = ?, cpf = ?, endereco = ?, observacoes = ?
          WHERE id = ?
        `).run(cliente.nome, cliente.telefone || null, cliente.cpf || null, cliente.endereco || null, cliente.observacoes || null, cliente.id);
        return { ok: true, id: cliente.id };
      }

      const result = banco.prepare(`
        INSERT INTO clientes (nome, telefone, cpf, endereco, observacoes)
        VALUES (?, ?, ?, ?, ?)
      `).run(cliente.nome, cliente.telefone || null, cliente.cpf || null, cliente.endereco || null, cliente.observacoes || null);
      return { ok: true, id: result.lastInsertRowid };
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      return { ok: false, erro: err.message };
    }
  });

  // Excluir cliente (soft delete)
  ipcMain.handle('clientes:excluir', (_event, id) => {
    try {
      const banco = db.obterDb();
      banco.prepare('UPDATE clientes SET ativo = 0 WHERE id = ?').run(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  // Registrar débito (compra fiado)
  ipcMain.handle('clientes:registrarDebito', (_event, dados) => {
    try {
      const banco = db.obterDb();
      banco.prepare(`
        INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
        VALUES (?, 'debito', ?, ?, ?)
      `).run(dados.clienteId, Math.abs(dados.valor), dados.descricao || 'Compra fiado', dados.operadorId || 1);
      return { ok: true };
    } catch (err) {
      console.error('Erro ao registrar débito:', err);
      return { ok: false, erro: err.message };
    }
  });

  // Registrar pagamento (abater dívida)
  ipcMain.handle('clientes:registrarPagamento', (_event, dados) => {
    try {
      const banco = db.obterDb();
      banco.prepare(`
        INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
        VALUES (?, 'pagamento', ?, ?, ?)
      `).run(dados.clienteId, Math.abs(dados.valor), dados.descricao || 'Pagamento de conta', dados.operadorId || 1);
      return { ok: true };
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
      return { ok: false, erro: err.message };
    }
  });
}

module.exports = { registrarHandlersClientes };
