function registrarHandlersVendas(ipcMain, db) {
  ipcMain.handle('vendas:registrar', (_event, venda) => {
    try {
      const banco = db.obterDb();

      const inserirVenda = banco.transaction((v) => {
        const result = banco.prepare(`
          INSERT INTO vendas (operador_id, total, desconto, forma_pagamento, cliente_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(v.operador_id, v.total, v.desconto || 0, v.forma_pagamento, v.cliente_id || null);

        const vendaId = Number(result.lastInsertRowid);

        const inserirItem = banco.prepare(`
          INSERT INTO venda_itens (venda_id, produto_id, qtd, peso_kg, preco_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const atualizarEstoque = banco.prepare(
          'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?'
        );

        const verificarEstoque = banco.prepare(
          'SELECT estoque FROM produtos WHERE id = ?'
        );

        for (const item of v.itens) {
          const quantidadeBaixa = item.peso_kg > 0 ? item.peso_kg : item.qtd;
          if (quantidadeBaixa > 0) {
            const produto = verificarEstoque.get(item.produto_id);
            if (!produto || produto.estoque < quantidadeBaixa) {
              throw new Error(`Estoque insuficiente para produto ID ${item.produto_id}. Disponível: ${produto?.estoque || 0}, Necessário: ${quantidadeBaixa}`);
            }
            atualizarEstoque.run(quantidadeBaixa, item.produto_id, quantidadeBaixa);
          }

          inserirItem.run(
            vendaId, item.produto_id, item.qtd || 0,
            item.peso_kg || 0, item.preco_unitario, item.subtotal
          );
        }

        // Registrar pagamentos mistos (split payment)
        if (v.forma_pagamento === 'misto' && v.pagamentos && v.pagamentos.length > 0) {
          const inserirPagamento = banco.prepare(`
            INSERT INTO venda_pagamentos (venda_id, forma, valor)
            VALUES (?, ?, ?)
          `);
          for (const pag of v.pagamentos) {
            inserirPagamento.run(vendaId, pag.forma, pag.valor);
          }
        }

        // Se for venda fiado (conta 100%), registrar débito do total
        if (v.forma_pagamento === 'conta' && v.cliente_id) {
          banco.prepare(`
            INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
            VALUES (?, 'debito', ?, ?, ?)
          `).run(v.cliente_id, v.total, `Venda #${vendaId} - Compra na conta`, v.operador_id);
        }

        // Se for venda mista com parcela na conta, registrar débito da parcela
        if (v.forma_pagamento === 'misto' && v.cliente_id && v.pagamentos) {
          const pagConta = v.pagamentos.find(p => p.forma === 'conta');
          if (pagConta && pagConta.valor > 0) {
            banco.prepare(`
              INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
              VALUES (?, 'debito', ?, ?, ?)
            `).run(v.cliente_id, pagConta.valor, `Venda #${vendaId} - Parcela na conta`, v.operador_id);
          }
        }

        banco.prepare(`
          INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id)
          VALUES ('venda', ?, ?, ?)
        `).run(v.total, `Venda #${vendaId}`, v.operador_id);

        return { ok: true, id: vendaId };
      });

      return inserirVenda(venda);
    } catch (err) {
      console.error("Erro ao registrar venda:", err);
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('vendas:listar', (_event, filtros = {}) => {
    try {
      const banco = db.obterDb();
      let sql = `
        SELECT v.*, o.nome as operador_nome, c.nome as cliente_nome,
          (SELECT COUNT(*) FROM venda_itens WHERE venda_id = v.id) as total_itens
        FROM vendas v
        LEFT JOIN operadores o ON v.operador_id = o.id
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filtros.dataInicio) {
        sql += ' AND v.data >= ?';
        params.push(filtros.dataInicio);
      }
      if (filtros.dataFim) {
        sql += ' AND v.data <= ?';
        params.push(filtros.dataFim);
      }
      if (filtros.status) {
        sql += ' AND v.status = ?';
        params.push(filtros.status);
      }
      if (filtros.operadorId) {
        sql += ' AND v.operador_id = ?';
        params.push(filtros.operadorId);
      }

      sql += ' ORDER BY v.data DESC';

      if (filtros.limite) {
        sql += ' LIMIT ?';
        params.push(filtros.limite);
      }

      return banco.prepare(sql).all(...params);
    } catch (err) {
      return [];
    }
  });

  ipcMain.handle('vendas:buscarPorId', (_event, id) => {
    try {
      const banco = db.obterDb();
      const venda = banco.prepare(`
        SELECT v.*, o.nome as operador_nome, c.nome as cliente_nome
        FROM vendas v
        LEFT JOIN operadores o ON v.operador_id = o.id
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.id = ?
      `).get(id);

      if (!venda) return null;

      venda.itens = banco.prepare(`
        SELECT vi.*, p.nome as produto_nome, p.tipo as produto_tipo
        FROM venda_itens vi
        LEFT JOIN produtos p ON vi.produto_id = p.id
        WHERE vi.venda_id = ?
      `).all(id);

      // Carregar pagamentos mistos se existirem
      venda.pagamentos = banco.prepare(`
        SELECT * FROM venda_pagamentos WHERE venda_id = ?
      `).all(id);

      return venda;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('vendas:cancelar', (_event, id) => {
    try {
      const banco = db.obterDb();

      const cancelar = banco.transaction((vendaId) => {
        const venda = banco.prepare('SELECT * FROM vendas WHERE id = ?').get(vendaId);
        if (!venda || venda.status === 'cancelada') return { ok: false, erro: 'Venda não encontrada ou já cancelada' };

        // Só devolve estoque de itens que ainda estão ativos (não cancelados individualmente)
        const itens = banco.prepare("SELECT * FROM venda_itens WHERE venda_id = ? AND (status = 'ativo' OR status IS NULL)").all(vendaId);
        const devolverEstoque = banco.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');

        for (const item of itens) {
          const quantidade = item.peso_kg > 0 ? item.peso_kg : item.qtd;
          if (quantidade > 0) {
            devolverEstoque.run(quantidade, item.produto_id);
          }
        }

        // Marca todos os itens como cancelados
        banco.prepare("UPDATE venda_itens SET status = 'cancelado' WHERE venda_id = ? AND status = 'ativo'").run(vendaId);

        banco.prepare("UPDATE vendas SET status = 'cancelada' WHERE id = ?").run(vendaId);

        // Se era venda fiado (100% ou parcela), reverter débito na conta do cliente
        if (venda.cliente_id) {
          if (venda.forma_pagamento === 'conta') {
            banco.prepare(`
              INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
              VALUES (?, 'pagamento', ?, ?, ?)
            `).run(venda.cliente_id, venda.total, `Estorno Venda #${vendaId} (cancelada)`, venda.operador_id);
          } else if (venda.forma_pagamento === 'misto') {
            const pagConta = banco.prepare("SELECT valor FROM venda_pagamentos WHERE venda_id = ? AND forma = 'conta'").get(vendaId);
            if (pagConta && pagConta.valor > 0) {
              banco.prepare(`
                INSERT INTO cliente_contas (cliente_id, tipo, valor, descricao, operador_id)
                VALUES (?, 'pagamento', ?, ?, ?)
              `).run(venda.cliente_id, pagConta.valor, `Estorno Parcela Venda #${vendaId} (cancelada)`, venda.operador_id);
            }
          }
        }

        banco.prepare(`
          INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id)
          VALUES ('sangria', ?, ?, ?)
        `).run(-venda.total, `Cancelamento Venda #${vendaId}`, venda.operador_id);

        return { ok: true };
      });

      return cancelar(id);
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  });

  ipcMain.handle('vendas:cancelarItem', (_event, itemId) => {
    try {
      const banco = db.obterDb();

      const cancelarItem = banco.transaction((id) => {
        const item = banco.prepare('SELECT * FROM venda_itens WHERE id = ?').get(id);
        if (!item || item.status === 'cancelado') return { ok: false, erro: 'Item não encontrado ou já cancelado' };

        const venda = banco.prepare('SELECT * FROM vendas WHERE id = ?').get(item.venda_id);
        if (!venda || venda.status === 'cancelada') return { ok: false, erro: 'Venda cancelada ou não encontrada' };

        // Devolve estoque
        const quantidade = item.peso_kg > 0 ? item.peso_kg : item.qtd;
        if (quantidade > 0) {
          banco.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?')
            .run(quantidade, item.produto_id);
        }

        // Marca item como cancelado
        banco.prepare("UPDATE venda_itens SET status = 'cancelado' WHERE id = ?").run(id);

        // Atualiza o total da venda
        const novoTotal = venda.total - item.subtotal;
        banco.prepare('UPDATE vendas SET total = ? WHERE id = ?').run(novoTotal, item.venda_id);

        // Se todos os itens forem cancelados, a venda inteira deve ser cancelada
        const ativos = banco.prepare("SELECT COUNT(*) as total FROM venda_itens WHERE venda_id = ? AND status = 'ativo'").get(item.venda_id);
        if (ativos.total === 0) {
          banco.prepare("UPDATE vendas SET status = 'cancelada' WHERE id = ?").run(item.venda_id);
        }

        // Registra a sangria do valor devolvido
        banco.prepare(`
          INSERT INTO caixa_movimentos (tipo, valor, descricao, operador_id)
          VALUES ('sangria', ?, ?, ?)
        `).run(-item.subtotal, `Devolução Item: ID #${id} da Venda #${item.venda_id}`, venda.operador_id);

        return { ok: true, valorDevolver: item.subtotal };
      });

      return cancelarItem(itemId);
    } catch (err) {
      console.error("Erro ao cancelar item:", err);
      return { ok: false, erro: err.message };
    }
  });
}

module.exports = { registrarHandlersVendas };
