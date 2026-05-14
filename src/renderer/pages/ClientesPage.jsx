import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR');
}

function diasAtras(data) {
  if (!data) return 0;
  const diff = Date.now() - new Date(data).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function ClientesPage() {
  const { operador } = useAuth();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroDevedores, setFiltroDevedores] = useState(false);
  const [modalCadastro, setModalCadastro] = useState(null);
  const [modalExtrato, setModalExtrato] = useState(null);
  const [modalDebito, setModalDebito] = useState(null);
  const [modalPagamento, setModalPagamento] = useState(null);

  useEffect(() => { carregarClientes(); }, []);

  async function carregarClientes() {
    const lista = await window.api.clientes.listar({ busca, apenasDevedores: filtroDevedores });
    setClientes(lista || []);
  }

  function abrirNovoCliente() {
    setModalCadastro({ nome: '', telefone: '', cpf: '', endereco: '', observacoes: '' });
  }

  function abrirEditarCliente(cliente) {
    setModalCadastro({ ...cliente });
  }

  async function salvarCliente() {
    if (!modalCadastro.nome.trim()) {
      toast('Informe o nome do cliente', 'error');
      return;
    }
    try {
      const result = await window.api.clientes.salvar(modalCadastro);
      if (result && result.ok) {
        toast(modalCadastro.id ? 'Cliente atualizado' : 'Cliente cadastrado', 'success');
        setModalCadastro(null);
        carregarClientes();
      } else {
        toast(result?.erro || 'Erro ao salvar', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação', 'error');
    }
  }

  async function excluirCliente(id) {
    if (!window.confirm('Deseja excluir este cliente?')) return;
    await window.api.clientes.excluir(id);
    toast('Cliente excluído', 'success');
    carregarClientes();
  }

  async function abrirExtrato(id) {
    const cliente = await window.api.clientes.buscarPorId(id);
    if (cliente) {
      setModalExtrato(cliente);
    } else {
      toast('Cliente não encontrado', 'warning');
    }
  }

  async function registrarDebito() {
    if (!modalDebito.valor || parseFloat(modalDebito.valor) <= 0) {
      toast('Informe um valor válido', 'error');
      return;
    }
    try {
      const result = await window.api.clientes.registrarDebito({
        clienteId: modalDebito.clienteId,
        valor: parseFloat(modalDebito.valor),
        descricao: modalDebito.descricao || 'Compra fiado',
        operadorId: operador?.id || 1,
      });
      if (result && result.ok) {
        toast('Débito registrado com sucesso', 'success');
        setModalDebito(null);
        carregarClientes();
        if (modalExtrato) abrirExtrato(modalDebito.clienteId);
      } else {
        toast(result?.erro || 'Erro ao registrar', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação', 'error');
    }
  }

  async function registrarPagamento() {
    if (!modalPagamento.valor || parseFloat(modalPagamento.valor) <= 0) {
      toast('Informe um valor válido', 'error');
      return;
    }
    try {
      const result = await window.api.clientes.registrarPagamento({
        clienteId: modalPagamento.clienteId,
        valor: parseFloat(modalPagamento.valor),
        descricao: modalPagamento.descricao || 'Pagamento de conta',
        operadorId: operador?.id || 1,
      });
      if (result && result.ok) {
        toast('Pagamento registrado com sucesso', 'success');
        setModalPagamento(null);
        carregarClientes();
        if (modalExtrato) abrirExtrato(modalPagamento.clienteId);
      } else {
        toast(result?.erro || 'Erro ao registrar', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação', 'error');
    }
  }

  async function cobrarWhatsApp(clienteId) {
    const cliente = await window.api.clientes.buscarPorId(clienteId);
    if (!cliente) { toast('Cliente não encontrado', 'error'); return; }
    if (!cliente.telefone) { toast('Este cliente não tem telefone cadastrado', 'warning'); return; }
    if (cliente.saldo_devedor <= 0) { toast('Este cliente não tem dívidas pendentes', 'info'); return; }

    // Pega o nome do mercado das configurações
    let nomeMercado = 'Mercado';
    try {
      const configSis = localStorage.getItem('config_sistema');
      if (configSis) nomeMercado = JSON.parse(configSis).nomeMercado || 'Mercado';
    } catch(e) {}

    // Filtra apenas débitos não quitados
    const debitos = (cliente.movimentos || []).filter(m => m.tipo === 'debito');
    const pagamentos = (cliente.movimentos || []).filter(m => m.tipo === 'pagamento');

    // Monta a mensagem com acentos e emojis (usando codificacao segura)
    let msg = `Olá *${cliente.nome}*! 👋\n\n`;
    msg += `Passando para lembrar sobre sua conta pendente aqui no *${nomeMercado}*.\n\n`;
    msg += `📋 *Extrato de Compras:*\n`;

    debitos.forEach(d => {
      const dataFormatada = new Date(d.data).toLocaleDateString('pt-BR');
      msg += `▪️ ${dataFormatada} - ${d.descricao || 'Compra fiado'} - R$ ${d.valor.toFixed(2)}\n`;
    });

    if (pagamentos.length > 0) {
      msg += `\n✅ *Pagamentos já realizados:*\n`;
      pagamentos.forEach(p => {
        const dataFormatada = new Date(p.data).toLocaleDateString('pt-BR');
        msg += `▪️ ${dataFormatada} - ${p.descricao || 'Pagamento'} - R$ ${p.valor.toFixed(2)}\n`;
      });
    }

    msg += `\n💰 *Saldo devedor: R$ ${cliente.saldo_devedor.toFixed(2)}*\n\n`;
    msg += `💳 *Formas de pagamento aceitas:*\n`;
    msg += `• Dinheiro\n• PIX\n• Cartão de Débito\n• Cartão de Crédito\n\n`;
    msg += `Pode passar aqui quando puder para regularizar. Obrigado! 😊`;

    // Limpa o telefone para formato internacional
    const telLimpo = cliente.telefone.replace(/\D/g, '');
    const telFormatado = telLimpo.startsWith('55') ? telLimpo : `55${telLimpo}`;

    const url = `https://wa.me/${telFormatado}?text=${encodeURIComponent(msg)}`;
    await window.api.janela.abrirLink(url);
    toast('WhatsApp aberto com a cobrança! Só apertar enviar.', 'success');
  }

  const totalDevido = clientes.reduce((acc, c) => acc + Math.max(0, c.saldo_devedor), 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} clientes • Dívida total: {formatarMoeda(totalDevido)}</p>
        </div>
        <div className="page-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filtroDevedores}
              onChange={(e) => { setFiltroDevedores(e.target.checked); setTimeout(carregarClientes, 0); }}
            />
            Só devedores
          </label>
          <input
            type="text"
            className="input input-search"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregarClientes()}
          />
          <button className="btn btn-primary" onClick={abrirNovoCliente}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th>Saldo Devedor</th>
              <th>Cadastrado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.nome}</td>
                <td>{c.telefone || '—'}</td>
                <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.cpf || '—'}</code></td>
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: c.saldo_devedor > 0 ? 'var(--accent-danger)' : 'var(--accent-success)',
                  }}>
                    {formatarMoeda(c.saldo_devedor)}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatarData(c.criado_em)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-icon" onClick={() => abrirExtrato(c.id)} title="Ver Extrato" style={{ color: 'var(--accent-primary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => setModalDebito({ clienteId: c.id, clienteNome: c.nome, valor: '', descricao: '' })} title="Novo Débito" style={{ color: 'var(--accent-danger)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => setModalPagamento({ clienteId: c.id, clienteNome: c.nome, saldo: c.saldo_devedor, valor: '', descricao: '' })} title="Registrar Pagamento" style={{ color: 'var(--accent-success)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    {c.telefone && c.saldo_devedor > 0 && (
                      <button className="btn-icon" onClick={() => cobrarWhatsApp(c.id)} title="Cobrar via WhatsApp" style={{ color: '#25D366' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => abrirEditarCliente(c)} title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => excluirCliente(c.id)} title="Excluir" style={{ color: 'var(--accent-danger)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Cadastro/Edição */}
      {modalCadastro && (
        <Modal titulo={modalCadastro.id ? 'Editar Cliente' : 'Novo Cliente'} onFechar={() => setModalCadastro(null)} largura="550px">
          <div className="modal-body">
            <div className="form-grid">
              <div className="input-group full-width">
                <label>Nome Completo *</label>
                <input type="text" className="input" value={modalCadastro.nome} onChange={(e) => setModalCadastro({ ...modalCadastro, nome: e.target.value })} placeholder="Nome do cliente" autoFocus />
              </div>
              <div className="input-group">
                <label>Telefone</label>
                <input type="text" className="input" value={modalCadastro.telefone || ''} onChange={(e) => setModalCadastro({ ...modalCadastro, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="input-group">
                <label>CPF</label>
                <input type="text" className="input" value={modalCadastro.cpf || ''} onChange={(e) => setModalCadastro({ ...modalCadastro, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="input-group full-width">
                <label>Endereço</label>
                <input type="text" className="input" value={modalCadastro.endereco || ''} onChange={(e) => setModalCadastro({ ...modalCadastro, endereco: e.target.value })} placeholder="Rua, número, bairro" />
              </div>
              <div className="input-group full-width">
                <label>Observações</label>
                <input type="text" className="input" value={modalCadastro.observacoes || ''} onChange={(e) => setModalCadastro({ ...modalCadastro, observacoes: e.target.value })} placeholder="Alguma anotação..." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalCadastro(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarCliente}>Salvar</button>
          </div>
        </Modal>
      )}

      {/* Modal Extrato */}
      {modalExtrato && (
        <Modal titulo={`Extrato - ${modalExtrato.nome}`} onFechar={() => setModalExtrato(null)} largura="700px">
          <div className="modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo Devedor</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: modalExtrato.saldo_devedor > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                  {formatarMoeda(modalExtrato.saldo_devedor)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger btn-sm" onClick={() => setModalDebito({ clienteId: modalExtrato.id, clienteNome: modalExtrato.nome, valor: '', descricao: '' })}>
                  + Novo Débito
                </button>
                <button className="btn btn-success btn-sm" onClick={() => setModalPagamento({ clienteId: modalExtrato.id, clienteNome: modalExtrato.nome, saldo: modalExtrato.saldo_devedor, valor: '', descricao: '' })}>
                  ✓ Registrar Pagamento
                </button>
                {modalExtrato.telefone && modalExtrato.saldo_devedor > 0 && (
                  <button className="btn btn-sm" style={{ background: '#25D366', color: '#fff', border: 'none' }} onClick={() => cobrarWhatsApp(modalExtrato.id)}>
                    📱 Cobrar WhatsApp
                  </button>
                )}
              </div>
            </div>

            {modalExtrato.telefone && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>📞 {modalExtrato.telefone}</div>}
            {modalExtrato.endereco && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>📍 {modalExtrato.endereco}</div>}

            <div className="table-wrapper" style={{ maxHeight: 350, overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {modalExtrato.movimentos?.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 12 }}>{formatarData(m.data)}</td>
                      <td>
                        <span className={`badge ${m.tipo === 'debito' ? 'badge-danger' : 'badge-success'}`}>
                          {m.tipo === 'debito' ? 'Débito' : 'Pagamento'}
                        </span>
                      </td>
                      <td>{m.descricao}</td>
                      <td style={{ fontWeight: 700, color: m.tipo === 'debito' ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                        {m.tipo === 'debito' ? '+' : '-'}{formatarMoeda(m.valor)}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {diasAtras(m.data) === 0 ? 'Hoje' : `${diasAtras(m.data)} dias atrás`}
                      </td>
                    </tr>
                  ))}
                  {(!modalExtrato.movimentos || modalExtrato.movimentos.length === 0) && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Nenhuma movimentação</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalExtrato(null)}>Fechar</button>
          </div>
        </Modal>
      )}

      {/* Modal Novo Débito */}
      {modalDebito && (
        <Modal titulo={`Novo Débito - ${modalDebito.clienteNome}`} onFechar={() => setModalDebito(null)}>
          <div className="modal-body">
            <div className="input-group">
              <label>Valor (R$)</label>
              <input
                type="number"
                className="input"
                style={{ fontSize: 24, fontWeight: 700, textAlign: 'center' }}
                value={modalDebito.valor}
                onChange={(e) => setModalDebito({ ...modalDebito, valor: e.target.value })}
                min="0.01"
                step="0.01"
                autoFocus
                placeholder="0,00"
              />
            </div>
            <div className="input-group">
              <label>Descrição</label>
              <input type="text" className="input" value={modalDebito.descricao} onChange={(e) => setModalDebito({ ...modalDebito, descricao: e.target.value })} placeholder="Ex: Compras do dia 13/05" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalDebito(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={registrarDebito}>Registrar Débito</button>
          </div>
        </Modal>
      )}

      {/* Modal Pagamento */}
      {modalPagamento && (
        <Modal titulo={`Pagamento - ${modalPagamento.clienteNome}`} onFechar={() => setModalPagamento(null)}>
          <div className="modal-body">
            <div style={{ textAlign: 'center', marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo Devedor Atual</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-danger)' }}>{formatarMoeda(modalPagamento.saldo)}</div>
            </div>
            <div className="input-group">
              <label>Valor do Pagamento (R$)</label>
              <input
                type="number"
                className="input"
                style={{ fontSize: 24, fontWeight: 700, textAlign: 'center' }}
                value={modalPagamento.valor}
                onChange={(e) => setModalPagamento({ ...modalPagamento, valor: e.target.value })}
                min="0.01"
                step="0.01"
                autoFocus
                placeholder="0,00"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalPagamento({ ...modalPagamento, valor: modalPagamento.saldo.toString() })}>
                Pagar Tudo ({formatarMoeda(modalPagamento.saldo)})
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalPagamento({ ...modalPagamento, valor: (modalPagamento.saldo / 2).toFixed(2).toString() })}>
                Pagar Metade ({formatarMoeda(modalPagamento.saldo / 2)})
              </button>
            </div>
            <div className="input-group">
              <label>Descrição (opcional)</label>
              <input type="text" className="input" value={modalPagamento.descricao} onChange={(e) => setModalPagamento({ ...modalPagamento, descricao: e.target.value })} placeholder="Ex: Pagamento parcial" />
            </div>
            {modalPagamento.valor && parseFloat(modalPagamento.valor) > 0 && (
              <div style={{ textAlign: 'center', marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(0, 184, 148, 0.1)', border: '1px solid rgba(0, 184, 148, 0.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo Após Pagamento</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-success)' }}>
                  {formatarMoeda(Math.max(0, modalPagamento.saldo - parseFloat(modalPagamento.valor)))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalPagamento(null)}>Cancelar</button>
            <button className="btn btn-success" onClick={registrarPagamento}>Confirmar Pagamento</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
