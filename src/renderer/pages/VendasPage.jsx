import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR');
}

export default function VendasPage() {
  const toast = useToast();
  const [vendas, setVendas] = useState([]);
  const [detalhes, setDetalhes] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => { carregarVendas(); }, []);

  async function carregarVendas() {
    try {
      const lista = await window.api.vendas.listar({ status: filtroStatus || undefined, limite: 100 });
      setVendas(lista || []);
    } catch (err) {
      toast('Erro ao carregar vendas', 'error');
    }
  }

  async function verDetalhes(id) {
    try {
      const venda = await window.api.vendas.buscarPorId(id);
      if (venda) {
        setDetalhes(venda);
      } else {
        toast('Venda não encontrada', 'warning');
      }
    } catch (err) {
      toast('Erro ao buscar detalhes da venda', 'error');
    }
  }

  async function cancelarVenda(id) {
    if (!window.confirm('Tem certeza que deseja cancelar esta venda? O estoque será devolvido.')) return;
    
    try {
      const resultado = await window.api.vendas.cancelar(id);
      if (resultado && resultado.ok) {
        toast('Venda cancelada com sucesso', 'success');
        carregarVendas();
        setDetalhes(null);
      } else {
        toast(resultado?.erro || 'Erro ao cancelar venda', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação com o servidor', 'error');
    }
  }

  async function cancelarItem(itemId, subtotal) {
    if (!window.confirm(`Deseja realmente cancelar este item? Valor a devolver: ${formatarMoeda(subtotal)}`)) return;

    try {
      const resultado = await window.api.vendas.cancelarItem(itemId);
      if (resultado && resultado.ok) {
        toast(`Item cancelado! Devolver ${formatarMoeda(subtotal)} ao cliente.`, 'success');
        verDetalhes(detalhes.id); // Recarrega detalhes
        carregarVendas(); // Recarrega lista
      } else {
        toast(resultado?.erro || 'Erro ao cancelar item', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação com o servidor', 'error');
    }
  }

  async function reimprimirCupom(id) {
    try {
      const configSis = localStorage.getItem('config_sistema');
      const nomeMercado = configSis ? JSON.parse(configSis).nomeMercado : 'MERCADO PDV';
      
      const resultado = await window.api.impressao.cupom({
        venda_id: id,
        nome_mercado: nomeMercado
      });

      if (resultado && resultado.ok) {
        toast('Cupom enviado para impressão com sucesso!', 'success');
      } else {
        toast(`Erro na impressão: ${resultado?.erro || 'Módulo indisponível'}`, 'error');
      }
    } catch (err) {
      toast('Erro ao tentar imprimir cupom', 'error');
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Histórico de Vendas</h1>
          <p className="page-subtitle">{vendas.length} vendas encontradas</p>
        </div>
        <div className="page-actions">
          <select className="input" value={filtroStatus} onChange={(e) => { setFiltroStatus(e.target.value); setTimeout(carregarVendas, 0); }}>
            <option value="">Todos os status</option>
            <option value="finalizada">Finalizadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          <button className="btn btn-secondary" onClick={carregarVendas}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Operador</th>
              <th>Itens</th>
              <th>Desconto</th>
              <th>Total</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id}>
                <td style={{ fontWeight: 700 }}>#{v.id}</td>
                <td>{formatarData(v.data)}</td>
                <td>{v.operador_nome}</td>
                <td>{v.total_itens}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatarMoeda(v.desconto)}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatarMoeda(v.total)}</td>
                <td><span className="badge badge-info">{v.forma_pagamento}</span></td>
                <td>
                  <span className={`badge ${v.status === 'finalizada' ? 'badge-success' : 'badge-danger'}`}>
                    {v.status}
                  </span>
                </td>
                <td>
                  <button className="btn-icon" onClick={() => verDetalhes(v.id)} title="Ver detalhes">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma venda encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detalhes && (
        <Modal titulo={`Venda #${detalhes.id}`} onFechar={() => setDetalhes(null)} largura="650px">
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Data</span><div style={{ fontWeight: 600 }}>{formatarData(detalhes.data)}</div></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Operador</span><div style={{ fontWeight: 600 }}>{detalhes.operador_nome}</div></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Pagamento</span><div style={{ fontWeight: 600 }}>{detalhes.forma_pagamento}</div></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Status</span><div><span className={`badge ${detalhes.status === 'finalizada' ? 'badge-success' : 'badge-danger'}`}>{detalhes.status}</span></div></div>
            </div>

            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Tipo</th>
                    <th>Qtd/Peso</th>
                    <th>Unitário</th>
                    <th>Subtotal</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhes.itens?.map((item) => (
                    <tr key={item.id} style={item.status === 'cancelado' ? { textDecoration: 'line-through', opacity: 0.5 } : {}}>
                      <td style={{ fontWeight: 600 }}>{item.produto_nome}</td>
                      <td><span className="badge badge-info">{item.produto_tipo}</span></td>
                      <td>{item.peso_kg > 0 ? `${item.peso_kg.toFixed(3)} kg` : item.qtd}</td>
                      <td>{formatarMoeda(item.preco_unitario)}</td>
                      <td style={{ fontWeight: 600 }}>{formatarMoeda(item.subtotal)}</td>
                      <td>
                        {item.status === 'ativo' && detalhes.status === 'finalizada' && (
                          <button className="btn-icon" title="Cancelar Item" onClick={() => cancelarItem(item.id, item.subtotal)} style={{ color: 'var(--accent-danger)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desconto: {formatarMoeda(detalhes.desconto)}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-success)' }}>{formatarMoeda(detalhes.total)}</span>
            </div>
          </div>
          <div className="modal-footer">
            {detalhes.status === 'finalizada' && (
              <>
                <button className="btn btn-primary" onClick={() => reimprimirCupom(detalhes.id)}>
                  🖨️ Reimprimir Cupom
                </button>
                <button className="btn btn-danger" onClick={() => cancelarVenda(detalhes.id)}>
                  Cancelar Venda
                </button>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => setDetalhes(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
