import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function ConfiguracoesPage() {
  const toast = useToast();
  const [portas, setPortas] = useState([]);
  const [config, setConfig] = useState({
    balancaPorta: '',
    balancaBaud: '9600'
  });
  const [hwid, setHwid] = useState('');
  const [versao, setVersao] = useState('...');
  const [checandoUpdate, setChecandoUpdate] = useState(false);

  const [nomeMercado, setNomeMercado] = useState('MERCADO PDV');
  const [usaBalanca, setUsaBalanca] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const p = await window.api.balanca.listarPortas();
      setPortas(p || []);
    } catch (err) {
      console.warn('Não foi possível listar portas:', err);
      setPortas([]);
    }
    
    // Tenta carregar configs salvas no localStorage (simples)
    try {
      const saved = localStorage.getItem('config_hardware');
      const systemSettings = localStorage.getItem('config_sistema');
      
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setUsaBalanca(parsed.usaBalanca || false);
        if (parsed.usaBalanca && parsed.balancaPorta) {
          window.api.balanca.configurar({ path: parsed.balancaPorta, baudRate: parseInt(parsed.balancaBaud) });
        }
      }

      if (systemSettings) {
        const parsed = JSON.parse(systemSettings);
        setNomeMercado(parsed.nomeMercado || 'MERCADO PDV');
      }
    } catch (err) {
      console.warn('Erro ao carregar configurações locais:', err);
    }

    try {
      const h = await window.api.licenca.hwid();
      setHwid(h || '');
    } catch (err) {
      setHwid('Não disponível');
    }

    try {
      const v = await window.api.invoke('app:versao');
      setVersao(v || '?.?.?');
    } catch (err) {
      setVersao('?.?.?');
    }
  }

  async function salvar() {
    try {
      const hardwareConfig = { ...config, usaBalanca };
      localStorage.setItem('config_hardware', JSON.stringify(hardwareConfig));
      localStorage.setItem('config_sistema', JSON.stringify({ nomeMercado }));
      
      if (usaBalanca && config.balancaPorta) {
        await window.api.balanca.configurar({ path: config.balancaPorta, baudRate: parseInt(config.balancaBaud) });
      }
      
      toast('Configurações aplicadas e salvas', 'success');
    } catch (err) {
      toast('Erro ao salvar configurações', 'error');
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Personalização e Hardware</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 900, marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">🏪 Identificação do Estabelecimento</h3>
        </div>
        <div className="modal-body">
          <div className="input-group">
            <label>Nome do Mercado (Exibido no Cabeçalho)</label>
            <input 
              type="text" 
              className="input" 
              value={nomeMercado} 
              onChange={(e) => setNomeMercado(e.target.value.toUpperCase())}
              placeholder="NOME DO SEU MERCADO"
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">⚖️ Balança</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={usaBalanca} onChange={(e) => setUsaBalanca(e.target.checked)} />
              Habilitar Integração
            </label>
          </div>
          <div className="modal-body">
            {!usaBalanca ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>Integração com balança digital está desativada.</p>
                <p style={{ fontSize: 11 }}>Ative se possuir uma balança conectada via cabo Serial/USB.</p>
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label>Porta Serial</label>
                  <select 
                    className="input" 
                    value={config.balancaPorta} 
                    onChange={(e) => setConfig({...config, balancaPorta: e.target.value})}
                  >
                    <option value="">Selecione uma porta</option>
                    {portas.map(p => (
                      <option key={p.path} value={p.path}>{p.path} ({p.friendlyName})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginTop: 12 }}>
                  <label>Baud Rate</label>
                  <select 
                    className="input" 
                    value={config.balancaBaud} 
                    onChange={(e) => setConfig({...config, balancaBaud: e.target.value})}
                  >
                    <option value="2400">2400</option>
                    <option value="4800">4800</option>
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🔑 Licenciamento</h3>
          </div>
          <div className="modal-body">
            <div className="input-group">
              <label>ID do Hardware (HWID)</label>
              <code style={{ 
                background: 'var(--bg-input)', 
                padding: '10px', 
                borderRadius: '8px', 
                fontSize: '11px',
                wordBreak: 'break-all',
                color: 'var(--accent-secondary)'
              }}>
                {hwid}
              </code>
            </div>
            <div className="alert-box success" style={{ marginTop: 16 }}>
              Sistema Ativo e Licenciado
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🚀 Atualizações</h3>
          </div>
          <div className="modal-body">
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Versão Atual</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>v{versao}</div>
              
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ marginTop: 16, width: '100%' }}
                onClick={async () => {
                  setChecandoUpdate(true);
                  try {
                    await window.api.invoke('updater:verificar');
                    toast('Verificando por novas versões...', 'info');
                  } catch (err) {
                    toast('Erro ao verificar atualizações', 'error');
                  }
                  setTimeout(() => setChecandoUpdate(false), 2000);
                }}
                disabled={checandoUpdate}
              >
                {checandoUpdate ? 'Buscando...' : 'Verificar Atualizações'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={salvar}>Salvar Configurações</button>
      </div>
    </div>
  );
}
