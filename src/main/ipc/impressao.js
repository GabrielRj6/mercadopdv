const { BrowserWindow } = require('electron');
const path = require('path');

// ─── ESC/POS via USB (libusb) ───────────────────────────────────
let escpos = null;
let escposUSB = null;

try {
  escpos = require('escpos');
  escposUSB = require('escpos-usb');
  escpos.USB = escposUSB;
} catch (err) {
  console.warn('Módulo escpos-usb não disponível:', err.message);
}

// ─── Helpers ────────────────────────────────────────────────────
function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora() {
  return new Date().toLocaleString('pt-BR');
}

// ─── Método 1: Impressão via escpos-usb (libusb direto) ────────
function imprimirViaUSB(venda, itens, nomeMercado) {
  return new Promise((resolve) => {
    if (!escpos || !escposUSB) {
      return resolve({ ok: false, metodo: 'usb', erro: 'Módulo escpos-usb não carregado' });
    }

    try {
      const device = new escpos.USB();
      const options = { encoding: 'GB18030' };

      device.open((error) => {
        if (error) {
          return resolve({ ok: false, metodo: 'usb', erro: error.message });
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
              .text(`Data: ${formatarDataHora()}`)
              .text(`Operador: ${venda.operador_nome || 'N/A'}`)
              .text(`Pagamento: ${venda.forma_pagamento || 'N/A'}`)
              .text('--------------------------------')
              .tableCustom([
                { text: 'Item', align: 'LEFT', width: 0.4 },
                { text: 'Qtd', align: 'CENTER', width: 0.2 },
                { text: 'Un', align: 'RIGHT', width: 0.2 },
                { text: 'Total', align: 'RIGHT', width: 0.2 }
              ]);

            itens.forEach(item => {
              const nome = (item.produto_nome || 'Item').substring(0, 15);
              const qtdStr = item.peso_kg > 0 ? item.peso_kg.toFixed(3) : item.qtd.toString();
              printer.tableCustom([
                { text: nome, align: 'LEFT', width: 0.4 },
                { text: qtdStr, align: 'CENTER', width: 0.2 },
                { text: item.preco_unitario.toFixed(2), align: 'RIGHT', width: 0.2 },
                { text: item.subtotal.toFixed(2), align: 'RIGHT', width: 0.2 }
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

          resolve({ ok: true, metodo: 'usb' });
        } catch (printErr) {
          resolve({ ok: false, metodo: 'usb', erro: printErr.message });
        }
      });
    } catch (deviceErr) {
      resolve({ ok: false, metodo: 'usb', erro: deviceErr.message });
    }
  });
}

// ─── Método 2: Impressão via driver do Windows (Electron print) ─
function gerarHTMLCupom(venda, itens, nomeMercado, via) {
  const linhaItem = (item) => {
    const nome = (item.produto_nome || 'Item').substring(0, 18);
    const qtdStr = item.peso_kg > 0 ? item.peso_kg.toFixed(3) : item.qtd.toString();
    return `<tr>
      <td style="text-align:left">${nome}</td>
      <td style="text-align:center">${qtdStr}</td>
      <td style="text-align:right">${item.preco_unitario.toFixed(2)}</td>
      <td style="text-align:right">${item.subtotal.toFixed(2)}</td>
    </tr>`;
  };

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 0; size: 80mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; padding: 2mm; color: #000; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .big { font-size: 18px; font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  td { padding: 1px 0; }
  .total-line { font-size: 16px; font-weight: bold; text-align: right; margin: 4px 0; }
  .footer { margin-top: 8px; text-align: center; font-size: 10px; }
</style></head><body>
  <div class="center big">${nomeMercado}</div>
  <div class="center" style="font-size:10px">NAO E DOCUMENTO FISCAL</div>
  <div class="center" style="font-size:10px; margin:2px 0">--- VIA DO ${via === 1 ? 'ESTABELECIMENTO' : 'CLIENTE'} ---</div>
  <div class="divider"></div>
  <div>Venda: #${venda.id}</div>
  <div>Data: ${formatarDataHora()}</div>
  <div>Operador: ${venda.operador_nome || 'N/A'}</div>
  <div>Pagamento: ${venda.forma_pagamento || 'N/A'}</div>
  <div class="divider"></div>
  <table>
    <tr class="bold">
      <td style="text-align:left">Item</td>
      <td style="text-align:center">Qtd</td>
      <td style="text-align:right">Un</td>
      <td style="text-align:right">Total</td>
    </tr>
    ${itens.map(linhaItem).join('')}
  </table>
  <div class="divider"></div>
  <div class="right">Subtotal: ${formatarMoeda(venda.total + (venda.desconto || 0))}</div>
  <div class="right">Desconto: ${formatarMoeda(venda.desconto || 0)}</div>
  <div class="total-line">TOTAL: ${formatarMoeda(venda.total)}</div>
  <div class="divider"></div>
  <div class="footer">OBRIGADO PELA PREFERENCIA</div>
  <div style="height: 20px"></div>
</body></html>`;
}

function imprimirViaWindows(venda, itens, nomeMercado, nomeImpressora) {
  return new Promise(async (resolve) => {
    let impressorasDisponiveis = [];

    try {
      // Detecta impressoras disponíveis no Windows
      const tempWin = BrowserWindow.getAllWindows()[0];
      if (tempWin) {
        impressorasDisponiveis = tempWin.webContents.getPrinters();
      }
    } catch (err) {
      console.warn('Erro ao listar impressoras:', err.message);
    }

    // Determina qual impressora usar
    let impressoraFinal = nomeImpressora;

    if (!impressoraFinal && impressorasDisponiveis.length > 0) {
      // Tenta encontrar a Elgin ou impressora térmica automaticamente
      const elgin = impressorasDisponiveis.find(p =>
        p.name.toLowerCase().includes('elgin') ||
        p.name.toLowerCase().includes('i8') ||
        p.name.toLowerCase().includes('thermal') ||
        p.name.toLowerCase().includes('pos') ||
        p.name.toLowerCase().includes('generic')
      );

      if (elgin) {
        impressoraFinal = elgin.name;
      } else {
        // Usa a impressora padrão
        const padrao = impressorasDisponiveis.find(p => p.isDefault);
        if (padrao) impressoraFinal = padrao.name;
      }
    }

    if (!impressoraFinal) {
      return resolve({
        ok: false,
        metodo: 'windows',
        erro: 'Nenhuma impressora encontrada no Windows. Verifique se o serviço Spooler está ativo e a impressora instalada.',
        impressoras: impressorasDisponiveis.map(p => p.name)
      });
    }

    console.log(`[Impressão] Usando impressora Windows: "${impressoraFinal}"`);

    // Imprime 2 vias sequencialmente
    let viasImpressas = 0;

    for (let via = 1; via <= 2; via++) {
      try {
        const html = gerarHTMLCupom(venda, itens, nomeMercado, via);
        const sucesso = await imprimirHTML(html, impressoraFinal);
        if (sucesso) viasImpressas++;
      } catch (err) {
        console.warn(`Erro ao imprimir via ${via}:`, err.message);
      }
    }

    if (viasImpressas > 0) {
      resolve({ ok: true, metodo: 'windows', impressora: impressoraFinal, vias: viasImpressas });
    } else {
      resolve({ ok: false, metodo: 'windows', erro: `Falha ao enviar para "${impressoraFinal}"` });
    }
  });
}

function imprimirHTML(html, nomeImpressora) {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      show: false,
      width: 302, // ~80mm
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      }
    });

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    printWin.webContents.on('did-finish-load', () => {
      // Pequeno delay para garantir renderização completa
      setTimeout(() => {
        printWin.webContents.print(
          {
            silent: true,
            deviceName: nomeImpressora,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 80000, height: 297000 } // 80mm x auto (microns)
          },
          (success, errorType) => {
            printWin.close();
            if (success) {
              resolve(true);
            } else {
              console.warn('Falha na impressão Windows:', errorType);
              resolve(false);
            }
          }
        );
      }, 300);
    });

    // Timeout de segurança
    setTimeout(() => {
      try { printWin.close(); } catch (e) { /* já fechou */ }
      resolve(false);
    }, 10000);
  });
}

// ─── Registro dos Handlers IPC ──────────────────────────────────
function registrarHandlersImpressao(ipcMain, db) {

  // Handler principal de impressão
  ipcMain.handle('impressao:imprimirCupom', async (_event, dados) => {
    try {
      const banco = db ? db.obterDb() : null;
      if (!banco) {
        return { ok: false, erro: 'Banco de dados não disponível' };
      }

      // Busca dados da venda
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
      const nomeImpressora = dados.nome_impressora || '';

      // Estratégia 1: Tenta USB direto (escpos-usb)
      console.log('[Impressão] Tentando via USB (escpos-usb)...');
      const resultadoUSB = await imprimirViaUSB(venda, itens, nomeMercado);

      if (resultadoUSB.ok) {
        console.log('[Impressão] Sucesso via USB!');
        return resultadoUSB;
      }

      console.log(`[Impressão] USB falhou: ${resultadoUSB.erro}`);
      console.log('[Impressão] Tentando via driver/spooler do Windows...');

      // Estratégia 2: Tenta via driver Windows (webContents.print)
      const resultadoWin = await imprimirViaWindows(venda, itens, nomeMercado, nomeImpressora);

      if (resultadoWin.ok) {
        console.log(`[Impressão] Sucesso via Windows! Impressora: ${resultadoWin.impressora}`);
        return resultadoWin;
      }

      console.warn('[Impressão] Todas as tentativas falharam.');
      return {
        ok: false,
        erro: resultadoWin.erro || resultadoUSB.erro || 'Não foi possível se comunicar com a impressora Elgin i8'
      };

    } catch (err) {
      console.error('Erro geral na impressão:', err);
      return { ok: false, erro: err.message };
    }
  });

  // Handler para listar impressoras do Windows (para configurações)
  ipcMain.handle('impressao:listarImpressoras', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return [];
      const printers = win.webContents.getPrinters();
      return printers.map(p => ({
        nome: p.name,
        padrao: p.isDefault,
        status: p.status === 0 ? 'Pronta' : 'Offline'
      }));
    } catch (err) {
      console.warn('Erro ao listar impressoras:', err.message);
      return [];
    }
  });
}

module.exports = { registrarHandlersImpressao };
