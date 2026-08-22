const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

function obterCaminhoBanco() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mercadopdv.db');
}

function inicializar() {
  try {
    db = new Database(obterCaminhoBanco());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    criarTabelas();
    migrarSchema();
    inserirOperadorPadrao();
    console.log("Banco inicializado com sucesso");
  } catch (err) {
    console.error("Erro ao inicializar banco:", err);
  }
}

function migrarSchema() {
  const colunasProdutos = db.prepare("PRAGMA table_info(produtos)").all();
  const nomesColunas = colunasProdutos.map(c => c.name);
  
  if (!nomesColunas.includes('criado_em')) {
    db.exec("ALTER TABLE produtos ADD COLUMN criado_em TEXT DEFAULT (datetime('now', 'localtime'))");
  }
  if (!nomesColunas.includes('atualizado_em')) {
    db.exec("ALTER TABLE produtos ADD COLUMN atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))");
  }
  if (!nomesColunas.includes('ativo')) {
    db.exec("ALTER TABLE produtos ADD COLUMN ativo INTEGER DEFAULT 1");
  }
  if (!nomesColunas.includes('foto')) {
    db.exec("ALTER TABLE produtos ADD COLUMN foto TEXT NULL");
  }

  const colunasVendaItens = db.prepare("PRAGMA table_info(venda_itens)").all();
  const nomesColunasItens = colunasVendaItens.map(c => c.name);
  if (!nomesColunasItens.includes('status')) {
    db.exec("ALTER TABLE venda_itens ADD COLUMN status TEXT DEFAULT 'ativo'");
  }

  // Migration v1.5.0: Adicionar cliente_id nas vendas (para vendas fiado/conta)
  const colunasVendas = db.prepare("PRAGMA table_info(vendas)").all();
  const nomesColunasVendas = colunasVendas.map(c => c.name);
  if (!nomesColunasVendas.includes('cliente_id')) {
    db.exec("ALTER TABLE vendas ADD COLUMN cliente_id INTEGER NULL REFERENCES clientes(id)");
  }

  // Migration v1.5.0: Tabela para pagamentos mistos (split payment)
  db.exec(`
    CREATE TABLE IF NOT EXISTS venda_pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      forma TEXT NOT NULL,
      valor REAL NOT NULL,
      FOREIGN KEY (venda_id) REFERENCES vendas(id)
    )
  `);
}

function criarTabelas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      categoria TEXT DEFAULT 'Geral',
      codigo_barras TEXT UNIQUE,
      tipo TEXT NOT NULL CHECK(tipo IN ('UNIDADE', 'PESO', 'AVULSO')),
      preco_venda REAL NOT NULL,
      preco_custo REAL DEFAULT 0,
      estoque REAL DEFAULT 0,
      estoque_minimo REAL DEFAULT 0,
      foto TEXT NULL,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      nivel_acesso TEXT NOT NULL CHECK(nivel_acesso IN ('admin', 'operador')),
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT DEFAULT (datetime('now', 'localtime')),
      operador_id INTEGER NOT NULL,
      total REAL NOT NULL,
      desconto REAL DEFAULT 0,
      forma_pagamento TEXT DEFAULT 'dinheiro',
      cliente_id INTEGER NULL,
      status TEXT DEFAULT 'finalizada',
      FOREIGN KEY (operador_id) REFERENCES operadores(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      qtd REAL DEFAULT 0,
      peso_kg REAL DEFAULT 0,
      preco_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venda_id) REFERENCES vendas(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );

    CREATE TABLE IF NOT EXISTS venda_pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      forma TEXT NOT NULL,
      valor REAL NOT NULL,
      FOREIGN KEY (venda_id) REFERENCES vendas(id)
    );

    CREATE TABLE IF NOT EXISTS caixa_movimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('abertura', 'fechamento', 'sangria', 'suprimento', 'venda')),
      valor REAL NOT NULL,
      descricao TEXT,
      data TEXT DEFAULT (datetime('now', 'localtime')),
      operador_id INTEGER NOT NULL,
      FOREIGN KEY (operador_id) REFERENCES operadores(id)
    );

    CREATE TABLE IF NOT EXISTS licenca (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      chave TEXT,
      hwid TEXT,
      ativada_em TEXT,
      status TEXT DEFAULT 'inativa'
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      cpf TEXT,
      endereco TEXT,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cliente_contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('debito', 'pagamento')),
      valor REAL NOT NULL,
      descricao TEXT,
      data TEXT DEFAULT (datetime('now', 'localtime')),
      operador_id INTEGER,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (operador_id) REFERENCES operadores(id)
    );
  `);
}

function inserirOperadorPadrao() {
  const existe = db.prepare('SELECT id FROM operadores WHERE id = 1').get();
  if (!existe) {
    const crypto = require('crypto');
    const pinPadrao = '1234';
    const pinHash = crypto.createHash('sha256').update(pinPadrao).digest('hex');
    db.prepare('INSERT INTO operadores (nome, pin_hash, nivel_acesso) VALUES (?, ?, ?)').run('Administrador', pinHash, 'admin');
    console.log('Operador padrão criado com PIN: 1234. Altere no primeiro acesso.');
  }
}

function obterDb() { return db; }
function fechar() { if (db) db.close(); }

module.exports = { inicializar, obterDb, fechar, obterCaminhoBanco };
