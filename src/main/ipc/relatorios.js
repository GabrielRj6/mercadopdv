function registrarHandlersRelatorios(ipcMain, db) {
  ipcMain.handle('relatorios:vendasPorPeriodo', (_event, filtros = {}) => {
    const banco = db.obterDb();
    let sql = `
      SELECT DATE(v.data) as dia, COUNT(*) as quantidade, SUM(v.total) as total
      FROM vendas v
      WHERE v.status = 'finalizada'
    `;
    const params = [];

    if (filtros.dataInicio) { sql += ' AND v.data >= ?'; params.push(filtros.dataInicio); }
    if (filtros.dataFim) { sql += ' AND v.data <= ?'; params.push(filtros.dataFim); }

    sql += ' GROUP BY DATE(v.data) ORDER BY dia DESC';
    return banco.prepare(sql).all(...params);
  });

  ipcMain.handle('relatorios:vendasPorCategoria', (_event, filtros = {}) => {
    const banco = db.obterDb();
    let sql = `
      SELECT p.categoria, COUNT(DISTINCT v.id) as vendas, SUM(vi.subtotal) as total
      FROM venda_itens vi
      JOIN vendas v ON vi.venda_id = v.id
      JOIN produtos p ON vi.produto_id = p.id
      WHERE v.status = 'finalizada'
    `;
    const params = [];

    if (filtros.dataInicio) { sql += ' AND v.data >= ?'; params.push(filtros.dataInicio); }
    if (filtros.dataFim) { sql += ' AND v.data <= ?'; params.push(filtros.dataFim); }

    sql += ' GROUP BY p.categoria ORDER BY total DESC';
    return banco.prepare(sql).all(...params);
  });

  ipcMain.handle('relatorios:vendasPorOperador', (_event, filtros = {}) => {
    const banco = db.obterDb();
    let sql = `
      SELECT o.nome as operador, COUNT(v.id) as vendas, SUM(v.total) as total
      FROM vendas v
      JOIN operadores o ON v.operador_id = o.id
      WHERE v.status = 'finalizada'
    `;
    const params = [];

    if (filtros.dataInicio) { sql += ' AND v.data >= ?'; params.push(filtros.dataInicio); }
    if (filtros.dataFim) { sql += ' AND v.data <= ?'; params.push(filtros.dataFim); }

    sql += ' GROUP BY v.operador_id ORDER BY total DESC';
    return banco.prepare(sql).all(...params);
  });

  ipcMain.handle('relatorios:produtosMaisVendidos', (_event, filtros = {}) => {
    const banco = db.obterDb();
    let sql = `
      SELECT p.nome, p.tipo, SUM(vi.qtd) as qtd_total, SUM(vi.peso_kg) as peso_total,
             SUM(vi.subtotal) as receita_total, COUNT(DISTINCT vi.venda_id) as num_vendas
      FROM venda_itens vi
      JOIN vendas v ON vi.venda_id = v.id
      JOIN produtos p ON vi.produto_id = p.id
      WHERE v.status = 'finalizada'
    `;
    const params = [];

    if (filtros.dataInicio) { sql += ' AND v.data >= ?'; params.push(filtros.dataInicio); }
    if (filtros.dataFim) { sql += ' AND v.data <= ?'; params.push(filtros.dataFim); }

    sql += ' GROUP BY vi.produto_id ORDER BY receita_total DESC LIMIT 20';
    return banco.prepare(sql).all(...params);
  });
}

module.exports = { registrarHandlersRelatorios };
