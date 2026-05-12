const escpos = require('escpos');
escpos.USB = require('escpos-usb');

function imprimirCupom(venda, operadorNome) {
  return new Promise((resolve, reject) => {
    try {
      const device = new escpos.USB();
      const options = { encoding: "GB18030" };
      const printer = new escpos.Printer(device, options);

      const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      device.open((error) => {
        if (error) return reject(error);

        printer
          .font('a').align('ct').style('bu').size(1, 1).text('MERCADO PDV')
          .size(0, 0).style('normal').text('NAO E DOCUMENTO FISCAL')
          .text('--------------------------------')
          .align('lt').text(`Venda: #${venda.id}`)
          .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
          .text(`Operador: ${operadorNome}`)
          .text('--------------------------------')
          .tableCustom([
            { text: "Item", align: "LEFT", width: 0.4 },
            { text: "Qtd", align: "CENTER", width: 0.2 },
            { text: "Un", align: "RIGHT", width: 0.2 },
            { text: "Total", align: "RIGHT", width: 0.2 }
          ]);

        venda.itens.forEach(item => {
          const qtdStr = item.peso_kg > 0 ? item.peso_kg.toFixed(3) : item.qtd.toString();
          printer.tableCustom([
            { text: item.nome.substring(0, 15), align: "LEFT", width: 0.4 },
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
          .feed(3).cut().close();

        resolve(true);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function registrarHandlersImpressao(ipcMain) {
  ipcMain.handle('impressao:imprimirCupom', async (_event, { venda, operadorNome }) => {
    try {
      await imprimirCupom(venda, operadorNome);
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error.message };
    }
  });
}

module.exports = { registrarHandlersImpressao };
