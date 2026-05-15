let escpos = null;
let escposUSB = null;

try {
  escpos = require('escpos');
  escposUSB = require('escpos-usb');
  escpos.USB = escposUSB;
} catch (err) {
  console.warn('Módulo escpos não disponível - impressão desabilitada:', err.message);
}

function registrarHandlersImpressao(ipcMain, db) {
  ipcMain.handle('impressao:imprimirCupom', async (_event, dados) => {
    if (!escpos || !escposUSB) {
      return { ok: false, erro: 'Módulo de impressão não disponível' };
    }

    try {
      const banco = db ? db.obterDb() : null;
      if (!banco) {
        return { ok: false, erro: 'Banco de dados não disponível' };
      }

      // Busca os dados completos da venda
      const venda = banco.prepare(`
        SELECT v.*, o.nome as operador_nome
        FROM vendas v
        LEFT JOIN operadores o ON v.operador_id = o.id
        WHERE v.id = ?
      `).get(dados.venda_id);

      if (!venda) {
        return { ok: false, erro: 'Venda não encontrada' };
      }

      const itens = banco.prepare(`
        SELECT vi.*, p.nome as produto_nome, p.tipo as produto_tipo
        FROM venda_itens vi
        LEFT JOIN produtos p ON vi.produto_id = p.id
        WHERE vi.venda_id = ?
      `).all(dados.venda_id);

      const nomeMercado = dados.nome_mercado || 'MERCADO PDV';
      const formatarMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      return new Promise((resolve) => {
        try {
          const device = new escpos.USB();
          const options = { encoding: "GB18030" };

          device.open((error) => {
            if (error) {
              console.warn('Impressora não detectada:', error.message);
              return resolve({ ok: false, erro: 'Impressora não detectada: ' + error.message });
            }

            try {
              for (let via = 1; via <= 2; via++) {
                const printer = new escpos.Printer(device, options);

                printer
                  .font('a').align('ct').style('bu').size(1, 1).text(nomeMercado)
                  .size(0, 0).style('normal').text('NAO E DOCUMENTO FISCAL')
                  .text(`--- VIA DO ${via === 1 ? 'ESTABELECIMENTO' : 'CLIENTE'} ---`)
                  .text('--------------------------------')
                  .align('lt').text(`Venda: #${venda.id}`)
                  .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
                  .text(`Operador: ${venda.operador_nome || 'N/A'}`)
                  .text(`Pagamento: ${venda.forma_pagamento || 'N/A'}`)
                  .text('--------------------------------')
                  .tableCustom([
                    { text: "Item", align: "LEFT", width: 0.4 },
                    { text: "Qtd", align: "CENTER", width: 0.2 },
                    { text: "Un", align: "RIGHT", width: 0.2 },
                    { text: "Total", align: "RIGHT", width: 0.2 }
                  ]);

                itens.forEach(item => {
                  const nome = (item.produto_nome || 'Item').substring(0, 15);
                  const qtdStr = item.peso_kg > 0 ? item.peso_kg.toFixed(3) : item.qtd.toString();
                  printer.tableCustom([
                    { text: nome, align: "LEFT", width: 0.4 },
                    { text: qtdStr, align: "CENTER", width: 0.2 },
                    { text: item.preco_unitario.toFixed(2), align: "RIGHT", width: 0.2 },
                    { text: item.subtotal.toFixed(2), align: "RIGHT", width: 0.2 }
                  ]);
                });

                printer
                  .text('--------------------------------').align('rt')
                  .text(`Subtotal: ${formatarMoeda(venda.total + (venda.desconto || 0))}`)
                  .text(`Desconto: ${formatarMoeda(venda.desconto || 0)}`)
                  .style('b').size(1, 1).text(`TOTAL: ${formatarMoeda(venda.total)}`)
                  .size(0, 0).style('normal').align('ct')
                  .text('--------------------------------').text('OBRIGADO PELA PREFERENCIA')
                  .feed(3).cut();

                printer.close();
              }

              resolve({ ok: true });
            } catch (printErr) {
              console.error('Erro durante impressão:', printErr);
              resolve({ ok: false, erro: printErr.message });
            }
          });
        } catch (deviceErr) {
          console.warn('Erro ao acessar dispositivo USB:', deviceErr.message);
          resolve({ ok: false, erro: 'Impressora USB não encontrada' });
        }
      });
    } catch (err) {
      console.error('Erro geral na impressão:', err);
      return { ok: false, erro: err.message };
    }
  });
}

module.exports = { registrarHandlersImpressao };
