const https = require('https');
const http = require('http');

function buscarNaCosmosApi(codigo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.cosmos.bluesoft.com.br',
      path: `/gtins/${codigo}`,
      method: 'GET',
      headers: {
        'X-Cosmos-Token': '',
        'User-Agent': 'MercadoPDV/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({
              nome: json.description || '',
              foto: json.thumbnail || '',
              categoria: json.ncm?.full_description || 'Geral',
            });
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function buscarNaProdutoXyz(codigo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'produto.xyz',
      path: `/v1/gtin/${codigo}`,
      method: 'GET',
      headers: { 'User-Agent': 'MercadoPDV/1.0' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({
              nome: json.name || json.description || '',
              foto: json.thumbnail || json.image || '',
              categoria: json.category || 'Geral',
            });
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function registrarHandlersProdutos(ipcMain, db) {
  ipcMain.handle('produtos:listar', (_event, filtros = {}) => {
    try {
      const banco = db.obterDb();
      let sql = 'SELECT * FROM produtos WHERE ativo = 1';
      const params = [];

      if (filtros.busca) {
        sql += ' AND (nome LIKE ? OR codigo_barras LIKE ?)';
        params.push(`%${filtros.busca}%`, `%${filtros.busca}%`);
      }
      if (filtros.categoria) {
        sql += ' AND categoria = ?';
        params.push(filtros.categoria);
      }
      if (filtros.tipo) {
        sql += ' AND tipo = ?';
        params.push(filtros.tipo);
      }

      sql += ' ORDER BY nome ASC';

      if (filtros.limite) {
        sql += ' LIMIT ?';
        params.push(filtros.limite);
      }

      return banco.prepare(sql).all(...params);
    } catch (err) {
      console.error("Erro ao listar:", err);
      return [];
    }
  });

  ipcMain.handle('produtos:buscarPorCodigo', (_event, codigo) => {
    try {
      const banco = db.obterDb();
      return banco.prepare('SELECT * FROM produtos WHERE codigo_barras = ? AND ativo = 1').get(codigo);
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('produtos:buscarPorId', (_event, id) => {
    try {
      const banco = db.obterDb();
      return banco.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('produtos:salvar', (_event, produto) => {
    try {
      const banco = db.obterDb();

      if (produto.id) {
        banco.prepare(`
          UPDATE produtos 
          SET nome = ?, categoria = ?, preco_custo = ?, preco_venda = ?, 
              estoque = ?, estoque_minimo = ?, tipo = ?, codigo_barras = ?, foto = ?,
              atualizado_em = datetime('now', 'localtime')
          WHERE id = ?
        `).run(
          produto.nome, produto.categoria, produto.preco_custo || 0, produto.preco_venda,
          produto.estoque || 0, produto.estoque_minimo || 0, produto.tipo, produto.codigo_barras || null, produto.foto || null,
          produto.id
        );
        return { ok: true, id: produto.id };
      }

      const result = banco.prepare(`
        INSERT INTO produtos (nome, categoria, preco_custo, preco_venda, estoque, estoque_minimo, tipo, codigo_barras, foto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        produto.nome, produto.categoria || 'Geral', produto.preco_custo || 0, produto.preco_venda,
        produto.estoque || 0, produto.estoque_minimo || 0, produto.tipo, produto.codigo_barras || null, produto.foto || null
      );
      return { ok: true, id: result.lastInsertRowid };
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('produtos:excluir', (_event, id) => {
    try {
      const banco = db.obterDb();
      banco.prepare('UPDATE produtos SET ativo = 0 WHERE id = ?').run(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('produtos:alertasEstoque', () => {
    const banco = db.obterDb();
    return banco.prepare(
      'SELECT * FROM produtos WHERE ativo = 1 AND estoque <= estoque_minimo AND estoque_minimo > 0 ORDER BY estoque ASC'
    ).all();
  });

  ipcMain.handle('produtos:buscarApi', async (_event, codigo) => {
    const resultado = await buscarNaCosmosApi(codigo);
    if (resultado) return { fonte: 'cosmos', ...resultado };

    const resultadoXyz = await buscarNaProdutoXyz(codigo);
    if (resultadoXyz) return { fonte: 'produto_xyz', ...resultadoXyz };

    return null;
  });
}

module.exports = { registrarHandlersProdutos };
