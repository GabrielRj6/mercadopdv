import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

export default function OperadoresPage() {
  const { operador: operadorLogado } = useAuth();
  const toast = useToast();
  const [operadores, setOperadores] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => { carregarOperadores(); }, []);

  async function carregarOperadores() {
    const lista = await window.api.operadores.listar();
    setOperadores(lista);
  }

  function abrirNovo() {
    setModal({ nome: '', pin: '', nivel_acesso: 'operador' });
  }

  function abrirEditar(op) {
    setModal({ ...op, pin: '' });
  }

  async function salvar() {
    if (!modal.nome || (!modal.id && !modal.pin)) {
      toast('Preencha nome e PIN', 'error');
      return;
    }

    try {
      const result = await window.api.operadores.salvar(modal);
      if (result && result.ok) {
        toast(modal.id ? 'Operador atualizado' : 'Operador cadastrado', 'success');
        setModal(null);
        carregarOperadores();
      } else {
        toast(`Erro ao salvar: ${result?.erro || 'Erro desconhecido'}`, 'error');
      }
    } catch (err) {
      toast('Falha na comunicação com o banco', 'error');
    }
  }

  async function excluir(id) {
    const resultado = await window.api.operadores.excluir(id);
    if (resultado.ok) {
      toast('Operador excluído', 'success');
      carregarOperadores();
    } else {
      toast(resultado.erro, 'error');
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operadores</h1>
          <p className="page-subtitle">{operadores.length} operadores cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Operador
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {operadores.map((op) => (
          <div key={op.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: op.nivel_acesso === 'admin'
                  ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                  : 'var(--bg-card-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18, color: 'white',
              }}>
                {op.nome.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{op.nome}</div>
                <span className={`badge ${op.nivel_acesso === 'admin' ? 'badge-info' : 'badge-teal'}`}>
                  {op.nivel_acesso}
                </span>
              </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" onClick={() => abrirEditar(op)} title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {op.id !== 1 && (
                    <button className="btn-icon" onClick={() => excluir(op.id)} title="Excluir" style={{ color: 'var(--accent-danger)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  )}
                </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal titulo={modal.id ? 'Editar Operador' : 'Novo Operador'} onFechar={() => setModal(null)}>
          <div className="modal-body">
            <div className="input-group">
              <label>Nome</label>
              <input type="text" className="input" value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} />
            </div>
            <div className="input-group">
              <label>{modal.id ? 'Novo PIN (deixe vazio para manter)' : 'PIN'}</label>
              <input type="password" className="input" value={modal.pin} onChange={(e) => setModal({ ...modal, pin: e.target.value })} maxLength={6} placeholder="4-6 dígitos" />
            </div>
            <div className="input-group">
              <label>Nível de Acesso</label>
              <select className="input" value={modal.nivel_acesso} onChange={(e) => setModal({ ...modal, nivel_acesso: e.target.value })}>
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
