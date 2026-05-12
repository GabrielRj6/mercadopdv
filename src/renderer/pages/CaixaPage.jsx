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

export default function CaixaPage() {
  const { operador } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [modalSangria, setModalSangria] = useState(false);
  const [modalSuprimento, setModalSuprimento] = useState(false);
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    try {
      const s = await window.api.caixa.status();
      setStatus(s);
      const m = await window.api.caixa.movimentos({});
      setMovimentos(m);
    } catch (err) {
      toast('Erro ao carregar dados do caixa', 'error');
    }
  }

  async function abrirCaixa() {
    try {
      const resultado = await window.api.caixa.abrir(operador.id);
      if (resultado && resultado.ok) {
        toast('Caixa aberto', 'success');
        carregarDados();
      } else {
        toast(resultado?.erro || 'Erro ao abrir caixa', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação com o banco de dados', 'error');
    }
  }

  async function fecharCaixa() {
    try {
      const resultado = await window.api.caixa.fechar(operador.id);
      if (resultado && resultado.ok) {
        toast(`Caixa fechado. Saldo: ${formatarMoeda(resultado.resumo.saldo)}`, 'success');
        carregarDados();
      } else {
        toast(resultado?.erro || 'Erro ao fechar caixa', 'error');
      }
    } catch (err) {
      toast('Falha na comunicação com o banco de dados', 'error');
    }
  }

  async function registrarSangria() {
    if (!valor || parseFloat(valor) <= 0) {
      toast('Informe um valor', 'error');
      return;
    }
    try {
      const resultado = await window.api.caixa.sangria({
        valor: parseFloat(valor),
        descricao: descricao || 'Sangria',
        operadorId: operador.id,
      });
      if (resultado && resultado.ok) {
        toast('Sangria registrada', 'success');
        setModalSangria(false);
        setValor('');
        setDescricao('');
        carregarDados();
      } else {
        toast(resultado?.erro || 'Erro ao registrar sangria', 'error');
      }
    } catch (err) {
      toast('Erro de comunicação', 'error');
    }
  }

  async function registrarSuprimento() {
    if (!valor || parseFloat(valor) <= 0) {
      toast('Informe um valor', 'error');
      return;
    }
    try {
      const resultado = await window.api.caixa.suprimento({
        valor: parseFloat(valor),
        descricao: descricao || 'Suprimento',
        operadorId: operador.id,
      });
      if (resultado && resultado.ok) {
        toast('Suprimento registrado', 'success');
        setModalSuprimento(false);
        setValor('');
        setDescricao('');
        carregarDados();
      } else {
        toast(resultado?.erro || 'Erro ao registrar suprimento', 'error');
      }
    } catch (err) {
      toast('Erro de comunicação', 'error');
    }
  }

  const tipoIcons = {
    abertura: '🟢',
    fechamento: '🔴',
    sangria: '📤',
    suprimento: '📥',
    venda: '💰',
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controle de Caixa</h1>
          <p className="page-subtitle">
            Status: {status?.aberto
              ? <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>Aberto</span>
              : <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>Fechado</span>}
          </p>
        </div>
        <div className="page-actions">
          {status?.aberto ? (
            <>
              <button className="btn btn-secondary" onClick={() => setModalSuprimento(true)}>📥 Suprimento</button>
              <button className="btn btn-secondary" onClick={() => setModalSangria(true)}>📤 Sangria</button>
              <button className="btn btn-danger" onClick={fecharCaixa}>Fechar Caixa</button>
            </>
          ) : (
            <button className="btn btn-success" onClick={abrirCaixa}>Abrir Caixa</button>
          )}
        </div>
      </div>

      {status?.aberto && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green">💰</div>
            <div className="stat-info">
              <div className="stat-value">{formatarMoeda(status.totalVendas)}</div>
              <div className="stat-label">Total em Vendas</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">📤</div>
            <div className="stat-info">
              <div className="stat-value">{formatarMoeda(status.totalSangrias)}</div>
              <div className="stat-label">Sangrias</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon teal">📥</div>
            <div className="stat-info">
              <div className="stat-value">{formatarMoeda(status.totalSuprimentos)}</div>
              <div className="stat-label">Suprimentos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">💵</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: status.saldo >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                {formatarMoeda(status.saldo)}
              </div>
              <div className="stat-label">Saldo Atual</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Movimentações</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Operador</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id}>
                  <td>{tipoIcons[m.tipo] || '•'} {m.tipo}</td>
                  <td>{m.descricao}</td>
                  <td style={{ fontWeight: 700, color: m.valor >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {formatarMoeda(m.valor)}
                  </td>
                  <td>{m.operador_nome}</td>
                  <td>{formatarData(m.data)}</td>
                </tr>
              ))}
              {movimentos.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma movimentação</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalSangria && (
        <Modal titulo="Registrar Sangria" onFechar={() => setModalSangria(false)}>
          <div className="modal-body">
            <div className="input-group">
              <label>Valor (R$)</label>
              <input type="number" className="input" value={valor} onChange={(e) => setValor(e.target.value)} min="0.01" step="0.01" autoFocus />
            </div>
            <div className="input-group">
              <label>Descrição (opcional)</label>
              <input type="text" className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Motivo da sangria" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalSangria(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={registrarSangria}>Confirmar</button>
          </div>
        </Modal>
      )}

      {modalSuprimento && (
        <Modal titulo="Registrar Suprimento" onFechar={() => setModalSuprimento(false)}>
          <div className="modal-body">
            <div className="input-group">
              <label>Valor (R$)</label>
              <input type="number" className="input" value={valor} onChange={(e) => setValor(e.target.value)} min="0.01" step="0.01" autoFocus />
            </div>
            <div className="input-group">
              <label>Descrição (opcional)</label>
              <input type="text" className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Motivo do suprimento" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalSuprimento(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={registrarSuprimento}>Confirmar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
