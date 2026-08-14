const { BrowserWindow } = require('electron');
const { execSync } = require('child_process');
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

// Helper para obter impressoras do Windows (Electron API + PowerShell fallback)
async function obterImpressorasWindows() {
  // 1. Tenta API do Electron (getPrintersAsync / getPrinters)
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (typeof win.webContents.getPrintersAsync === 'function') {
        const list = await win.webContents.getPrintersAsync();
        if (list && list.length > 0) return list;
      }
      if (typeof win.webContents.getPrinters === 'function') {
        const list = win.webContents.getPrinters();
        if (list && list.length > 0) return list;
      }
    }
  } catch (err) {
    console.warn('Erro ao obter impressoras via Electron API:', err.message);
  }

  // 2. Fallback via PowerShell
  try {
    const psOutput = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, IsDefault | ConvertTo-Json"',
      { timeout: 4000, encoding: 'utf8' }
    );
    if (psOutput && psOutput.trim()) {
      const parsed = JSON.parse(psOutput.trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map(p => ({
        name: p.Name,
        isDefault: Boolean(p.IsDefault)
      }));
    }
  } catch (psErr) {
    console.warn('Erro ao obter impressoras via PowerShell:', psErr.message);
  }

  return [];
}

// ─── Método 1: Impressão via escpos-usb (libusb direto) ────────
function imprimirViaUSB(venda, itens, nomeMercado) {
  return new Promise((resolve) => {
    if (!escpos || !escposUSB) {
      return resolve({ ok: false, metodo: 'usb', erro: 'Módulo escpos-usb não disponível' });
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

async function imprimirViaWindows(venda, itens, nomeMercado, nomeImpressora) {
  const impressorasDisponiveis = await obterImpressorasWindows();
  let impressoraFinal = nomeImpressora;

  if (!impressoraFinal && impressorasDisponiveis.length > 0) {
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
      const padrao = impressorasDisponiveis.find(p => p.isDefault);
      if (padrao) impressoraFinal = padrao.name;
    }
  }

  console.log(`[Impressão] Usando impressora Windows: "${impressoraFinal || 'Padrão do Sistema'}"`);

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
    return { ok: true, metodo: 'windows', impressora: impressoraFinal || 'Padrão do Sistema', vias: viasImpressas };
  } else {
    return { ok: false, metodo: 'windows', erro: 'Não foi possível imprimir via driver Windows' };
  }
}

function imprimirHTML(html, nomeImpressora) {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      show: false,
      width: 302,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      }
    });

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    printWin.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        const printOptions = {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 297000 }
        };

        if (nomeImpressora && nomeImpressora.trim()) {
          printOptions.deviceName = nomeImpressora.trim();
        }

        printWin.webContents.print(
          printOptions,
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
      let venda = null;
      let itens = [];

      // Tratamento para Teste de Impressão
      if (dados.venda_id === -1 || dados.teste) {
        venda = {
          id: 'TESTE',
          operador_nome: 'ADMIN',
          forma_pagamento: 'DINHEIRO',
          total: 10.00,
          desconto: 0.00
        };
        itens = [
          { produto_nome: 'PRODUTO TESTE', qtd: 1, peso_kg: 0, preco_unitario: 10.00, subtotal: 10.00 }
        ];
      } else {
        const banco = db ? db.obterDb() : null;
        if (!banco) {
          return { ok: false, erro: 'Banco de dados não disponível' };
        }

        venda = banco.prepare(`
          SELECT v.*, o.nome as operador_nome
          FROM vendas v
          LEFT JOIN operadores o ON v.operador_id = o.id
          WHERE v.id = ?
        `).get(dados.venda_id);

        if (!venda) {
          return { ok: false, erro: 'Venda não encontrada' };
        }

        itens = banco.prepare(`
          SELECT vi.*, p.nome as produto_nome, p.tipo as produto_tipo
          FROM venda_itens vi
          LEFT JOIN produtos p ON vi.produto_id = p.id
          WHERE vi.venda_id = ?
        `).all(dados.venda_id);
      }

      const nomeMercado = dados.nome_mercado || 'MERCADO PDV';
      const nomeImpressora = dados.nome_impressora || '';

      // Estratégia 1: USB direto
      console.log('[Impressão] Tentando via USB (escpos-usb)...');
      const resultadoUSB = await imprimirViaUSB(venda, itens, nomeMercado);
      if (resultadoUSB.ok) {
        return resultadoUSB;
      }

      // Estratégia 2: Driver / Spooler do Windows
      console.log('[Impressão] USB falhou. Tentando via driver Windows...');
      const resultadoWin = await imprimirViaWindows(venda, itens, nomeMercado, nomeImpressora);
      if (resultadoWin.ok) {
        return resultadoWin;
      }

      return {
        ok: false,
        erro: resultadoWin.erro || 'Falha ao comunicar com impressora Elgin i8'
      };

    } catch (err) {
      console.error('Erro geral na impressão:', err);
      return { ok: false, erro: err.message };
    }
  });

  // Handler para listar impressoras do Windows (para configurações)
  ipcMain.handle('impressao:listarImpressoras', async () => {
    try {
      const list = await obterImpressorasWindows();
      return list.map(p => ({
        nome: p.name,
        padrao: Boolean(p.isDefault),
        status: 'Pronta'
      }));
    } catch (err) {
      console.warn('Erro ao listar impressoras:', err.message);
      return [];
    }
  });
}

module.exports = { registrarHandlersImpressao };
