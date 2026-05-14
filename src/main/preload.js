const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  produtos: {
    listar: (filtros) => ipcRenderer.invoke('produtos:listar', filtros),
    buscarPorCodigo: (codigo) => ipcRenderer.invoke('produtos:buscarPorCodigo', codigo),
    buscarPorId: (id) => ipcRenderer.invoke('produtos:buscarPorId', id),
    salvar: (produto) => ipcRenderer.invoke('produtos:salvar', produto),
    excluir: (id) => ipcRenderer.invoke('produtos:excluir', id),
    alertasEstoque: () => ipcRenderer.invoke('produtos:alertasEstoque'),
    buscarApi: (codigo) => ipcRenderer.invoke('produtos:buscarApi', codigo),
  },
  vendas: {
    registrar: (venda) => ipcRenderer.invoke('vendas:registrar', venda),
    listar: (filtros) => ipcRenderer.invoke('vendas:listar', filtros),
    buscarPorId: (id) => ipcRenderer.invoke('vendas:buscarPorId', id),
    cancelar: (id) => ipcRenderer.invoke('vendas:cancelar', id),
    cancelarItem: (itemId) => ipcRenderer.invoke('vendas:cancelarItem', itemId),
  },
  caixa: {
    abrir: (operadorId) => ipcRenderer.invoke('caixa:abrir', operadorId),
    fechar: (operadorId) => ipcRenderer.invoke('caixa:fechar', operadorId),
    sangria: (dados) => ipcRenderer.invoke('caixa:sangria', dados),
    suprimento: (dados) => ipcRenderer.invoke('caixa:suprimento', dados),
    status: () => ipcRenderer.invoke('caixa:status'),
    movimentos: (filtros) => ipcRenderer.invoke('caixa:movimentos', filtros),
  },
  operadores: {
    listar: () => ipcRenderer.invoke('operadores:listar'),
    autenticar: (pin) => ipcRenderer.invoke('operadores:autenticar', pin),
    salvar: (operador) => ipcRenderer.invoke('operadores:salvar', operador),
    excluir: (id) => ipcRenderer.invoke('operadores:excluir', id),
  },
  clientes: {
    listar: (filtros) => ipcRenderer.invoke('clientes:listar', filtros),
    buscarPorId: (id) => ipcRenderer.invoke('clientes:buscarPorId', id),
    salvar: (cliente) => ipcRenderer.invoke('clientes:salvar', cliente),
    excluir: (id) => ipcRenderer.invoke('clientes:excluir', id),
    registrarDebito: (dados) => ipcRenderer.invoke('clientes:registrarDebito', dados),
    registrarPagamento: (dados) => ipcRenderer.invoke('clientes:registrarPagamento', dados),
  },
  relatorios: {
    vendasPorPeriodo: (filtros) => ipcRenderer.invoke('relatorios:vendasPorPeriodo', filtros),
    vendasPorCategoria: (filtros) => ipcRenderer.invoke('relatorios:vendasPorCategoria', filtros),
    vendasPorOperador: (filtros) => ipcRenderer.invoke('relatorios:vendasPorOperador', filtros),
    produtosMaisVendidos: (filtros) => ipcRenderer.invoke('relatorios:produtosMaisVendidos', filtros),
  },
  backup: {
    criar: () => ipcRenderer.invoke('backup:criar'),
    restaurar: (caminho) => ipcRenderer.invoke('backup:restaurar', caminho),
    selecionarArquivo: () => ipcRenderer.invoke('backup:selecionarArquivo'),
  },
  licenca: {
    verificar: () => ipcRenderer.invoke('licenca:verificar'),
    ativar: (chave) => ipcRenderer.invoke('licenca:ativar', chave),
    hwid: () => ipcRenderer.invoke('licenca:hwid'),
  },
  impressao: {
    cupom: (dados) => ipcRenderer.invoke('impressao:imprimirCupom', dados),
  },
  balanca: {
    lerPeso: () => ipcRenderer.invoke('balanca:lerPeso'),
    configurar: (config) => ipcRenderer.invoke('balanca:configurar', config),
    listarPortas: () => ipcRenderer.invoke('balanca:listarPortas'),
  },
  janela: {
    minimizar: () => ipcRenderer.send('janela:minimizar'),
    maximizar: () => ipcRenderer.send('janela:maximizar'),
    fechar: () => ipcRenderer.send('janela:fechar'),
    abrirLink: (url) => ipcRenderer.invoke('janela:abrirLink', url),
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
});
