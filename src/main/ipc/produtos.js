const https = require('https');

function buscarNaCosmosApi(codigo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.cosmos.bluesoft.com.br',
      path: `/gtins/${codigo}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            let catOriginal = json.ncm?.full_description || 'Geral';
            let categoriaFinal = 'Geral';
            const desc = catOriginal.toLowerCase();
            if (desc.includes('bebida') || desc.includes('agua') || desc.includes('suco')) categoriaFinal = 'Bebidas';
            else if (desc.includes('carne') || desc.includes('frango')) categoriaFinal = 'Açougue';
            else if (desc.includes('limpeza')) categoriaFinal = 'Limpeza';
            else if (desc.includes('higiene') || desc.includes('shampoo')) categoriaFinal = 'Higiene';
            else if (desc.includes('leite') || desc.includes('queijo')) categoriaFinal = 'Laticínios';
            else if (desc.includes('pão') || desc.includes('bolo')) categoriaFinal = 'Padaria';
            else if (desc.includes('ração') || desc.includes('animal')) categoriaFinal = 'Pet Shop';
            else if (desc.includes('congelado')) categoriaFinal = 'Congelados';
            else categoriaFinal = 'Mercearia';

            resolve({
              nome: json.description || '',
              foto: json.thumbnail || '',
              categoria: categoriaFinal,
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

// Alternativa poderosa: OpenFoodFacts (Gratuita e sem limites)
function buscarNaOpenFoodFacts(codigo) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'world.openfoodfacts.org',
      path: `/api/v0/product/${codigo}.json`,
      method: 'GET',
      headers: { 'User-Agent': 'MercadoPDV - Android - Version 1.0' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === 1) {
              const p = json.product;
              resolve({
                nome: p.product_name || p.generic_name || '',
                foto: p.image_url || p.image_front_url || '',
                categoria: p.categories ? p.categories.split(',')[0] : 'Mercearia',
              });
            } else {
              resolve(null);
            }
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
      return banco.prepare('SELECT * FROM produtos WHERE id = ? AND ativo = 1').get(id);
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
        INSERT INTO produtos (nome, categoria, preco_custo, preco_venda, estoque, estoque_minimo, tipo, codigo_barras, foto, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
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
    // 1. Tenta OpenFoodFacts (Melhor para marcas globais como Coca/Antarctica)
    const resultadoOff = await buscarNaOpenFoodFacts(codigo);
    if (resultadoOff) return { fonte: 'openfoodfacts', ...resultadoOff };

    // 2. Tenta Cosmos (Melhor para marcas brasileiras regionais)
    const resultadoCosmos = await buscarNaCosmosApi(codigo);
    if (resultadoCosmos) return { fonte: 'cosmos', ...resultadoCosmos };

    return null;
  });
}

module.exports = { registrarHandlersProdutos };
