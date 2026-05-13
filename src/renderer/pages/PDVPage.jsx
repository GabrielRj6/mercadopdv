import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PDVPage(props) {
  const { operador } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const inputTimerRef = useRef(null);

  const [codigoInput, setCodigoInput] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [desconto, setDesconto] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState('RS'); // 'RS' ou '%'
  const [produtoPreview, setProdutoPreview] = useState(null);
  const [modalPeso, setModalPeso] = useState(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [valorRecebido, setValorRecebido] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [produtosRapidos, setProdutosRapidos] = useState([]);
  const [buscaTexto, setBuscaTexto] = useState('');

  useEffect(() => {
    carregarProdutosRapidos();
    focarInput();
  }, []);

  async function carregarProdutosRapidos() {
    try {
      const produtos = await window.api.produtos.listar({ limite: 30 });
      setProdutosRapidos(produtos || []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setProdutosRapidos([]);
    }
  }

  function focarInput() {
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const processarCodigo = useCallback(async (codigo) => {
    if (!codigo.trim()) return;

    try {
      const produto = await window.api.produtos.buscarPorCodigo(codigo.trim());
      if (!produto) {
        toast('Produto não encontrado: ' + codigo, 'warning');
        setProdutoPreview(null);
        return;
      }

      adicionarAoCarrinho(produto);
    } catch (err) {
      toast('Erro ao buscar produto', 'error');
    }
  }, [toast]);

  function handleInputChange(e) {
    const valor = e.target.value;
    setCodigoInput(valor);

    clearTimeout(inputTimerRef.current);
    inputTimerRef.current = setTimeout(() => {
      if (valor.length >= 8) {
        processarCodigo(valor);
        setCodigoInput('');
      }
    }, 200);
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(inputTimerRef.current);
      if (codigoInput.trim()) {
        processarCodigo(codigoInput.trim());
        setCodigoInput('');
      }
    }
  }

  function adicionarAoCarrinho(produto) {
    if (produto.tipo === 'PESO') {
      setModalPeso({ produto, peso: '' });
      return;
    }

    const existente = carrinho.find((i) => i.produto_id === produto.id);
    if (existente) {
      setCarrinho((prev) =>
        prev.map((i) =>
          i.produto_id === produto.id
            ? { ...i, qtd: i.qtd + 1, subtotal: (i.qtd + 1) * i.preco_unitario }
            : i
        )
      );
    } else {
      setCarrinho((prev) => [
        ...prev,
        {
          produto_id: produto.id,
          nome: produto.nome,
          tipo: produto.tipo,
          qtd: 1,
          peso_kg: 0,
          preco_unitario: produto.preco_venda,
          subtotal: produto.preco_venda,
        },
      ]);
    }

    setProdutoPreview(produto);
    setTimeout(() => setProdutoPreview(null), 2000);
    focarInput();
  }

  function confirmarPeso() {
    const peso = parseFloat(modalPeso.peso);
    if (!peso || peso <= 0) {
      toast('Peso inválido', 'error');
      return;
    }

    const produto = modalPeso.produto;
    setCarrinho((prev) => [
      ...prev,
      {
        produto_id: produto.id,
        nome: produto.nome,
        tipo: produto.tipo,
        qtd: 0,
        peso_kg: peso,
        preco_unitario: produto.preco_venda,
        subtotal: peso * produto.preco_venda,
      },
    ]);

    setModalPeso(null);
    focarInput();
  }

  async function lerDaBalanca() {
    try {
      const pesoVal = await window.api.balanca.lerPeso();
      if (pesoVal > 0) {
        setModalPeso({ ...modalPeso, peso: pesoVal.toString() });
        toast(`Peso capturado: ${pesoVal.toFixed(3)}kg`, 'info');
      } else {
        toast('Balança zerada ou não detectada', 'warning');
      }
    } catch (e) {
      toast('Erro ao ler balança', 'error');
    }
  }

  function alterarQuantidade(index, novaQtd) {
    if (novaQtd <= 0) {
      removerItem(index);
      return;
    }
    setCarrinho((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, qtd: novaQtd, subtotal: novaQtd * item.preco_unitario }
          : item
      )
    );
  }

  function removerItem(index) {
    setCarrinho((prev) => prev.filter((_, i) => i !== index));
  }

  function calcularTotal() {
    const subtotal = calcularSubtotal();
    if (tipoDesconto === '%') {
      return Math.max(0, subtotal - (subtotal * (desconto / 100)));
    }
    return Math.max(0, subtotal - desconto);
  }

  function calcularValorDesconto() {
    const subtotal = calcularSubtotal();
    if (tipoDesconto === '%') {
      return subtotal * (desconto / 100);
    }
    return desconto;
  }

  function calcularSubtotal() {
    return carrinho.reduce((acc, item) => acc + item.subtotal, 0);
  }

  function abrirPagamento() {
    if (carrinho.length === 0) {
      toast('Carrinho vazio', 'warning');
      return;
    }
    setFormaPagamento('dinheiro');
    setValorRecebido('');
    setParcelas(1);
    setModalPagamento(true);
  }

  async function finalizarVenda() {
    if (carrinho.length === 0) {
      toast('Carrinho vazio', 'error');
      return;
    }

    const venda = {
      operador_id: operador?.id || 1,
      total: calcularTotal(),
      desconto: desconto,
      forma_pagamento: formaPagamento,
      itens: carrinho.map(i => ({
        produto_id: i.produto_id,
        qtd: i.qtd || 0,
        peso_kg: i.peso_kg || 0,
        preco_unitario: i.preco_unitario,
        subtotal: i.subtotal
      }))
    };

    try {
      const resultado = await window.api.vendas.registrar(venda);
      
      if (resultado && resultado.ok) {
        toast('Venda finalizada com sucesso!', 'success');
        
        // Tenta imprimir o cupom
        try {
          const configSis = localStorage.getItem('config_sistema');
          const nomeMercado = configSis ? JSON.parse(configSis).nomeMercado : 'MERCADO PDV';
          
          await window.api.impressao.cupom({
            venda_id: resultado.id,
            nome_mercado: nomeMercado
          });
        } catch (printErr) {
          console.warn('Erro ao imprimir cupom:', printErr);
        }

        setCarrinho([]);
        setDesconto(0);
        setModalPagamento(false);
        setFormaPagamento('dinheiro');
        setValorRecebido('');
        setParcelas(1);
        carregarProdutosRapidos();
        focarInput();
      } else {
        toast(`Erro ao registrar: ${resultado?.erro || 'Erro no banco de dados'}`, 'error');
      }
    } catch (err) {
      toast('Falha crítica na comunicação com o sistema', 'error');
    }
  }

  async function buscarProdutoTexto() {
    if (!buscaTexto.trim()) {
      carregarProdutosRapidos();
      return;
    }
    try {
      const produtos = await window.api.produtos.listar({ busca: buscaTexto });
      setProdutosRapidos(produtos || []);
    } catch (err) {
      toast('Erro ao buscar produtos', 'error');
    }
  }

  return (
    <div className="pdv-layout">
      <div className="pdv-main">
        <div className="pdv-input-container">
          <input
            ref={inputRef}
            type="text"
            className="input"
            placeholder="Escanear código de barras ou digitar código..."
            value={codigoInput}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => props.onNavegar && props.onNavegar('produtos')} title="Menu Administrativo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              Menu
            </button>
            <button className="btn btn-primary btn-lg" onClick={abrirPagamento} disabled={carrinho.length === 0}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Pagamento
            </button>
          </div>
        </div>

        {produtoPreview && (
          <div className="pdv-product-preview">
            <div className="pdv-product-preview-photo" style={{ width: 140, height: 140, borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', marginRight: 20 }}>
              {produtoPreview.foto ? (
                <img src={produtoPreview.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📦</div>
              )}
            </div>
            <div className="pdv-product-preview-info" style={{ flex: 1 }}>
              <div className="pdv-product-preview-name" style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{produtoPreview.nome}</div>
              <div className="pdv-product-preview-type" style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>{produtoPreview.tipo}</div>
              <div className="pdv-product-preview-price" style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent-success)' }}>{formatarMoeda(produtoPreview.preco_venda)}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            className="input input-search"
            placeholder="Buscar produto por nome..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarProdutoTexto()}
            style={{ flex: 1 }}
          />
        </div>

        <div className="pdv-products-grid">
          {produtosRapidos.map((p) => (
            <div key={p.id} className="pdv-product-card" onClick={() => adicionarAoCarrinho(p)}>
              <div className="pdv-product-card-photo" style={{ height: 100, width: '100%', overflow: 'hidden', borderRadius: '8px 8px 0 0', backgroundColor: 'var(--bg-secondary)' }}>
                {p.foto ? (
                  <img src={p.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>
                )}
              </div>
              <div className="pdv-product-card-content" style={{ padding: 12 }}>
                <div className="pdv-product-card-name" style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.nome}</div>
                <div className="pdv-product-card-price" style={{ color: 'var(--accent-success)', fontWeight: 800 }}>{formatarMoeda(p.preco_venda)}</div>
                <div className="pdv-product-card-type" style={{ fontSize: 10, opacity: 0.6 }}>{p.tipo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pdv-cart">
        <div className="pdv-cart-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            🛒 Carrinho ({carrinho.length})
          </span>
          {carrinho.length > 0 && (
            <button className="btn btn-sm btn-danger" onClick={() => setCarrinho([])}>Limpar</button>
          )}
        </div>

        <div className="pdv-cart-items">
          {carrinho.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              <div className="empty-state-text">Escaneie ou selecione produtos</div>
            </div>
          ) : (
            carrinho.map((item, index) => (
              <div key={index} className="pdv-cart-item">
                <div className="pdv-cart-item-info">
                  <div className="pdv-cart-item-name">{item.nome}</div>
                  <div className="pdv-cart-item-detail">
                    {item.tipo === 'PESO'
                      ? `${item.peso_kg.toFixed(3)} kg × ${formatarMoeda(item.preco_unitario)}/kg`
                      : `${item.qtd}× ${formatarMoeda(item.preco_unitario)}`}
                  </div>
                </div>
                {item.tipo !== 'PESO' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="btn-icon" onClick={() => alterarQuantidade(index, item.qtd - 1)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span style={{ width: 28, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{item.qtd}</span>
                    <button className="btn-icon" onClick={() => alterarQuantidade(index, item.qtd + 1)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                )}
                <div className="pdv-cart-item-price">{formatarMoeda(item.subtotal)}</div>
                <button className="pdv-cart-item-remove" onClick={() => removerItem(index)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pdv-cart-footer">
          <div className="pdv-total-row">
            <span className="pdv-total-label">Subtotal</span>
            <span className="pdv-total-value">{formatarMoeda(calcularSubtotal())}</span>
          </div>
          <div className="pdv-total-row">
            <span className="pdv-total-label">Desconto</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <select 
                className="input" 
                style={{ width: 50, padding: '4px', fontSize: 12 }} 
                value={tipoDesconto} 
                onChange={(e) => setTipoDesconto(e.target.value)}
              >
                <option value="RS">R$</option>
                <option value="%">%</option>
              </select>
              <input
                type="number"
                className="input"
                style={{ width: 70, padding: '4px 8px', textAlign: 'right', fontSize: 13 }}
                value={desconto || ''}
                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="pdv-grand-total">
            <span className="pdv-total-label">Total</span>
            <span className="pdv-total-value">{formatarMoeda(calcularTotal())}</span>
          </div>
        </div>
      </div>

      {modalPeso && (
        <Modal titulo={`Peso - ${modalPeso.produto.nome}`} onFechar={() => { setModalPeso(null); focarInput(); }}>
          <div className="modal-body">
            <div className="input-group">
              <label>Peso em Kg</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="number"
                  className="input qty-input"
                  style={{ flex: 1 }}
                  value={modalPeso.peso}
                  onChange={(e) => setModalPeso({ ...modalPeso, peso: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && confirmarPeso()}
                  autoFocus
                  step="0.001"
                  min="0.001"
                  placeholder="0.000"
                />
                <button className="btn btn-secondary" onClick={lerDaBalanca} title="Ler da Balança">
                  ⚖️ Ler
                </button>
              </div>
            </div>
            {modalPeso.peso && parseFloat(modalPeso.peso) > 0 && (
              <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent-success)' }}>
                {formatarMoeda(parseFloat(modalPeso.peso) * modalPeso.produto.preco_venda)}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setModalPeso(null); focarInput(); }}>Cancelar</button>
            <button className="btn btn-success" onClick={confirmarPeso}>Confirmar</button>
          </div>
        </Modal>
      )}

      {modalPagamento && (
        <Modal titulo="Finalizar Venda" onFechar={() => setModalPagamento(false)} largura="500px">
          <div className="modal-body">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total a Pagar</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--accent-success)' }}>
                {formatarMoeda(calcularTotal())}
              </div>
              {desconto > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent-warning)', fontWeight: 600 }}>
                  Economia de {formatarMoeda(calcularValorDesconto())} ({tipoDesconto === '%' ? `${desconto}%` : 'Valor Fixo'})
                </div>
              )}
            </div>

            <div className="payment-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { id: 'dinheiro', icone: '💵', label: 'Dinheiro' },
                { id: 'pix', icone: '📱', label: 'PIX' },
                { id: 'debito', icone: '💳', label: 'Débito' },
                { id: 'credito', icone: '💳', label: 'Crédito' },
              ].map((forma) => (
                <div
                  key={forma.id}
                  className={`payment-option ${formaPagamento === forma.id ? 'selected' : ''}`}
                  onClick={() => {
                    setFormaPagamento(forma.id);
                    setValorRecebido('');
                    setParcelas(1);
                  }}
                  style={{ 
                    padding: 12, 
                    borderRadius: 12, 
                    border: '2px solid var(--border-color)', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: formaPagamento === forma.id ? 'var(--accent-primary-transparent, rgba(108, 92, 231, 0.1))' : 'transparent',
                    borderColor: formaPagamento === forma.id ? 'var(--accent-primary)' : 'var(--border-color)'
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{forma.icone}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{forma.label}</div>
                </div>
              ))}
            </div>

            {formaPagamento === 'dinheiro' && (
              <div className="card" style={{ padding: 15, background: 'var(--bg-secondary)' }}>
                <div className="input-group">
                  <label>Valor Recebido (R$)</label>
                  <input 
                    type="number" 
                    className="input btn-lg" 
                    style={{ fontSize: 24, fontWeight: 700, textAlign: 'center' }}
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                {valorRecebido && parseFloat(valorRecebido) > calcularTotal() && (
                  <div style={{ marginTop: 15, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Troco a Devolver</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent-warning)' }}>
                      {formatarMoeda(parseFloat(valorRecebido) - calcularTotal())}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formaPagamento === 'credito' && (
              <div className="card" style={{ padding: 15, background: 'var(--bg-secondary)' }}>
                <div className="input-group">
                  <label>Número de Parcelas</label>
                  <select 
                    className="input" 
                    value={parcelas} 
                    onChange={(e) => setParcelas(parseInt(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n}x {n > 1 ? `de ${formatarMoeda(calcularTotal() / n)}` : '(À vista)'}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={() => setModalPagamento(false)}>Voltar</button>
            <button 
              className="btn btn-success btn-lg" 
              onClick={finalizarVenda}
              disabled={formaPagamento === 'dinheiro' && (!valorRecebido || parseFloat(valorRecebido) < calcularTotal())}
              style={{ flex: 1 }}
            >
              ✓ Confirmar e Finalizar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
