function registrarHandlersCaixa(ipcMain, db) {
  ipcMain.handle('caixa:abrir', (_event, { operadorId, valorInicial }) => {
    try {
      const banco = db.obterDb();
      const status = obterStatusCaixa(banco);
      if (status.aberto) return { ok: false, erro: 'Caixa já está aberto' };

      banco.prepare("INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id) VALUES ('abertura', ?, 'Abertura de caixa', ?)").run(valorInicial || 0, operadorId);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('caixa:fechar', (_event, operadorId) => {
    try {
      const banco = db.obterDb();
      const status = obterStatusCaixa(banco);
      if (!status.aberto) return { ok: false, erro: 'Caixa não está aberto' };

      const resumo = calcularResumoCaixa(banco, status.aberturaId);
      banco.prepare("INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id) VALUES ('fechamento', ?, ?, ?)").run(resumo.saldo, `Fechamento - Vendas: ${resumo.totalVendas}, Saldo: ${resumo.saldo.toFixed(2)}`, operadorId);
      return { ok: true, resumo };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('caixa:sangria', (_event, dados) => {
    try {
      const banco = db.obterDb();
      const status = obterStatusCaixa(banco);
      if (!status.aberto) return { ok: false, erro: 'Caixa não está aberto' };

      banco.prepare("INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id) VALUES ('sangria', ?, ?, ?)").run(-Math.abs(dados.valor), dados.descricao || 'Sangria', dados.operadorId);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('caixa:suprimento', (_event, dados) => {
    try {
      const banco = db.obterDb();
      const status = obterStatusCaixa(banco);
      if (!status.aberto) return { ok: false, erro: 'Caixa não está aberto' };

      banco.prepare("INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id) VALUES ('suprimento', ?, ?, ?)").run(Math.abs(dados.valor), dados.descricao || 'Suprimento', dados.operadorId);
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('caixa:status', () => {
    try {
      const banco = db.obterDb();
      const status = obterStatusCaixa(banco);
      if (!status.aberto) return { aberto: false };
      const resumo = calcularResumoCaixa(banco, status.aberturaId);
      return { aberto: true, ...resumo };
    } catch (err) {
      return { aberto: false, erro: err.message };
    }
  });

  ipcMain.handle('caixa:movimentos', (_event, filtros = {}) => {
    try {
      const banco = db.obterDb();
      let sql = `SELECT cm.*, o.nome as operador_nome FROM caixa_movimentos cm LEFT JOIN operadores o ON cm.operador_id = o.id WHERE 1=1`;
      const params = [];
      if (filtros.dataInicio) { sql += ' AND cm.data >= ?'; params.push(filtros.dataInicio); }
      if (filtros.dataFim) { sql += ' AND cm.data <= ?'; params.push(filtros.dataFim); }
      sql += ' ORDER BY cm.data DESC LIMIT 100';
      return banco.prepare(sql).all(...params);
    } catch (err) {
      return [];
    }
  });
}

function obterStatusCaixa(banco) {
  const ultimo = banco.prepare(
    "SELECT id, tipo, data FROM caixa_movimentos WHERE tipo IN ('abertura', 'fechamento') ORDER BY id DESC LIMIT 1"
  ).get();

  if (!ultimo || ultimo.tipo === 'fechamento') {
    return { aberto: false };
  }

  return { aberto: true, aberturaId: ultimo.id, aberturaData: ultimo.data };
}

function calcularResumoCaixa(banco, aberturaId) {
  const movimentos = banco.prepare(
    'SELECT tipo, valor FROM caixa_movimentos WHERE id >= ?'
  ).all(aberturaId);

  let totalVendas = 0;
  let totalSangrias = 0;
  let totalSuprimentos = 0;
  let totalAbertura = 0;

  for (const mov of movimentos) {
    if (mov.tipo === 'venda') totalVendas += mov.valor;
    if (mov.tipo === 'sangria') totalSangrias += Math.abs(mov.valor);
    if (mov.tipo === 'suprimento') totalSuprimentos += mov.valor;
    if (mov.tipo === 'abertura') totalAbertura += mov.valor;
  }

  return {
    totalVendas,
    totalSangrias,
    totalSuprimentos,
    totalAbertura,
    saldo: totalAbertura + totalVendas - totalSangrias + totalSuprimentos,
    quantidadeMovimentos: movimentos.length,
  };
}

module.exports = { registrarHandlersCaixa };
