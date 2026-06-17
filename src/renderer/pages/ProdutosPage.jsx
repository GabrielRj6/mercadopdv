import { useState, useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const tiposLabel = { UNIDADE: 'Unidade', PESO: 'Peso (kg)', AVULSO: 'Avulso' };

export default function ProdutosPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modal, setModal] = useState(null);
  const [buscandoApi, setBuscandoApi] = useState(false);
  const barcodeInputRef = useRef(null);


  useEffect(() => { carregarProdutos(); }, []);

  async function carregarProdutos() {
    const lista = await window.api.produtos.listar({ busca, tipo: filtroTipo || undefined });
    setProdutos(lista);
  }

  function abrirNovoProduto() {
    setModal({
      nome: '', categoria: 'Geral', codigo_barras: '', tipo: 'UNIDADE',
      preco_venda: '', preco_custo: '', estoque: '', estoque_minimo: '', foto: '',
    });
    // Foca no input apos renderizar o modal
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  }

  function abrirEditarProduto(produto) {
    setModal({ ...produto });
  }

  async function salvarProduto() {
    if (!modal.nome || !modal.preco_venda) {
      toast('Preencha nome e preço de venda', 'error');
      return;
    }

    try {
      const result = await window.api.produtos.salvar({
        ...modal,
        preco_venda: parseFloat(modal.preco_venda),
        preco_custo: parseFloat(modal.preco_custo) || 0,
        estoque: parseFloat(modal.estoque) || 0,
        estoque_minimo: parseFloat(modal.estoque_minimo) || 0,
        categoria: modal.categoria || 'Geral'
      });

      if (result && result.ok) {
        toast(modal.id ? 'Produto atualizado' : 'Produto cadastrado', 'success');
        setModal(null);
        carregarProdutos();
      } else {
        toast(`Erro ao salvar: ${result?.erro || 'Erro desconhecido'}`, 'error');
      }
    } catch (err) {
      toast('Falha crítica na comunicação com o banco', 'error');
    }
  }

  async function excluirProduto(id) {
    await window.api.produtos.excluir(id);
    toast('Produto excluído', 'success');
    carregarProdutos();
  }

  async function buscarCodigoApi() {
    if (!modal.codigo_barras) {
      toast('Digite o código de barras primeiro', 'warning');
      return;
    }

    setBuscandoApi(true);
    const resultado = await window.api.produtos.buscarApi(modal.codigo_barras);
    setBuscandoApi(false);

    if (resultado) {
      setModal((prev) => ({
        ...prev,
        nome: resultado.nome || prev.nome,
        categoria: resultado.categoria || prev.categoria,
        foto: resultado.foto || prev.foto,
      }));
      toast(`Produto encontrado via ${resultado.fonte}`, 'success');
    } else {
      toast('Produto não encontrado nas APIs', 'warning');
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="page-subtitle">{produtos.length} produtos cadastrados</p>
        </div>
        <div className="page-actions">
          <select className="input" value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setTimeout(carregarProdutos, 0); }}>
            <option value="">Todos os tipos</option>
            <option value="UNIDADE">Unidade</option>
            <option value="PESO">Peso</option>
            <option value="AVULSO">Avulso</option>
          </select>
          <input
            type="text"
            className="input input-search"
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregarProdutos()}
          />
          <button className="btn btn-primary" onClick={abrirNovoProduto}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Produto
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Código</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Preço Venda</th>
              <th>Custo</th>
              <th>Estoque</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.foto ? (
                        <img src={p.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 18 }}>📦</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 600 }}>{p.nome}</span>
                  </div>
                </td>
                <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.codigo_barras || '—'}</code></td>
                <td><span className={`badge ${p.tipo === 'PESO' ? 'badge-teal' : p.tipo === 'AVULSO' ? 'badge-warning' : 'badge-info'}`}>{p.tipo}</span></td>
                <td>{p.categoria}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{formatarMoeda(p.preco_venda)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatarMoeda(p.preco_custo)}</td>
                <td>
                  <span style={{ fontWeight: 600, color: p.estoque <= p.estoque_minimo && p.estoque_minimo > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                    {p.tipo === 'PESO' ? `${p.estoque.toFixed(1)} kg` : p.estoque}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-icon" onClick={() => abrirEditarProduto(p)} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => excluirProduto(p.id)} title="Excluir" style={{ color: 'var(--accent-danger)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhum produto encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo={modal.id ? 'Editar Produto' : 'Novo Produto'} onFechar={() => setModal(null)} largura="600px">
          <div className="modal-body">
            <div className="form-grid">
              <div className="input-group full-width">
                <label>Código de Barras</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    ref={barcodeInputRef}
                    type="text" 
                    className="input" 
                    style={{ flex: 1 }} 
                    value={modal.codigo_barras || ''} 
                    onChange={(e) => setModal({ ...modal, codigo_barras: e.target.value })} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        buscarCodigoApi();
                      }
                    }}
                    placeholder="Escaneie ou digite" 
                    autoFocus
                  />
                  <button className="btn btn-secondary" onClick={buscarCodigoApi} disabled={buscandoApi}>
                    {buscandoApi ? <span className="loader" style={{ width: 16, height: 16 }} /> : '🔍 Buscar API'}
                  </button>
                </div>
              </div>
              <div className="input-group full-width">
                <label>Nome</label>
                <input type="text" className="input" value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} placeholder="Nome do produto" />
              </div>
              <div className="input-group">
                <label>Tipo</label>
                <select className="input" value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value })}>
                  <option value="UNIDADE">Unidade</option>
                  <option value="PESO">Peso (kg)</option>
                  <option value="AVULSO">Avulso</option>
                </select>
              </div>
              <div className="input-group">
                <label>Categoria</label>
                <select className="input" value={modal.categoria} onChange={(e) => setModal({ ...modal, categoria: e.target.value })}>
                  <option value="Geral">Geral</option>
                  <option value="Açougue">Açougue</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Higiene">Higiene / Perfumaria</option>
                  <option value="Hortifruti">Hortifruti</option>
                  <option value="Laticínios">Laticínios</option>
                  <option value="Limpeza">Limpeza</option>
                  <option value="Mercearia">Mercearia</option>
                  <option value="Padaria">Padaria</option>
                  <option value="Pet Shop">Pet Shop</option>
                  <option value="Congelados">Congelados</option>
                </select>
              </div>
              <div className="input-group full-width">
                <label>Foto do Produto</label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div className="product-photo-preview" style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    {modal.foto ? (
                      <img src={modal.foto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 24 }}>🖼️</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="file"
                      id="upload-foto"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setModal({ ...modal, foto: reader.result });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="upload-foto" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      📁 Escolher Foto
                    </label>
                    {modal.foto && (
                      <button className="btn btn-danger btn-sm" onClick={() => setModal({ ...modal, foto: '' })}>
                        🗑️ Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Preço de Venda (R$)</label>
                <input type="number" className="input" value={modal.preco_venda || ''} onChange={(e) => setModal({ ...modal, preco_venda: e.target.value })} step="0.01" min="0" />
              </div>
              <div className="input-group">
                <label>Preço de Custo (R$)</label>
                <input type="number" className="input" value={modal.preco_custo || ''} onChange={(e) => setModal({ ...modal, preco_custo: e.target.value })} step="0.01" min="0" />
              </div>
              <div className="input-group">
                <label>Estoque</label>
                <input type="number" className="input" value={modal.estoque || ''} onChange={(e) => setModal({ ...modal, estoque: e.target.value })} step={modal.tipo === 'PESO' ? '0.1' : '1'} min="0" />
              </div>
              <div className="input-group">
                <label>Estoque Mínimo</label>
                <input type="number" className="input" value={modal.estoque_minimo || ''} onChange={(e) => setModal({ ...modal, estoque_minimo: e.target.value })} step={modal.tipo === 'PESO' ? '0.1' : '1'} min="0" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarProduto}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
