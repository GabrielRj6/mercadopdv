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
  const [nomeImpressora, setNomeImpressora] = useState('');
  const [impressoras, setImpressoras] = useState([]);
  const [carregandoImpressoras, setCarregandoImpressoras] = useState(false);

  useEffect(() => {
    carregarDados();

    const cleanup = window.api.on('updater:status', (status) => {
      setChecandoUpdate(status);
      toast(status, 'info');
      // Se for a mensagem de conclusão, aguarda um pouco e reinicia
      if (status.toLowerCase().includes('concluída') || status.toLowerCase().includes('reiniciando')) {
        setTimeout(() => window.api.invoke('updater:instalar'), 3000);
      }
    });

    return cleanup;
  }, [toast]);

  async function carregarDados() {
    try {
      const p = await window.api.balanca.listarPortas();
      setPortas(p || []);
    } catch (err) {
      console.warn('Não foi possível listar portas:', err);
      setPortas([]);
    }
    
    // Carrega impressoras disponíveis
    await carregarImpressoras();

    // Tenta carregar configs salvas no localStorage (simples)
    try {
      const saved = localStorage.getItem('config_hardware');
      const systemSettings = localStorage.getItem('config_sistema');
      
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setUsaBalanca(parsed.usaBalanca || false);
        setNomeImpressora(parsed.nomeImpressora || '');
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

  async function carregarImpressoras() {
    setCarregandoImpressoras(true);
    try {
      const lista = await window.api.impressao.listarImpressoras();
      setImpressoras(lista || []);
    } catch (err) {
      console.warn('Erro ao listar impressoras:', err);
      setImpressoras([]);
    }
    setCarregandoImpressoras(false);
  }

  async function testarImpressao() {
    try {
      toast('Enviando teste de impressão...', 'info');
      // Cria uma venda fictícia para teste
      const resultado = await window.api.impressao.cupom({
        venda_id: -1, // ID fictício - o handler vai tratar
        nome_mercado: nomeMercado,
        nome_impressora: nomeImpressora,
        teste: true
      });
      if (resultado && resultado.ok) {
        toast(`Impressão OK! Método: ${resultado.metodo || 'auto'} | Impressora: ${resultado.impressora || 'USB'}`, 'success');
      } else {
        toast(`Falha: ${resultado?.erro || 'Erro desconhecido'}`, 'error');
      }
    } catch (err) {
      toast('Erro ao testar impressão: ' + err.message, 'error');
    }
  }

  async function salvar() {
    try {
      const hardwareConfig = { ...config, usaBalanca, nomeImpressora };
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

      <div className="card" style={{ maxWidth: 900, marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">🖨️ Impressora Térmica</h3>
          <button className="btn btn-sm btn-secondary" onClick={carregarImpressoras} disabled={carregandoImpressoras}>
            {carregandoImpressoras ? '⏳ Buscando...' : '🔄 Redetectar'}
          </button>
        </div>
        <div className="modal-body">
          <div className="input-group">
            <label>Impressora (deixe em branco para auto-detectar)</label>
            <select
              className="input"
              value={nomeImpressora}
              onChange={(e) => setNomeImpressora(e.target.value)}
            >
              <option value="">🔍 Auto-detectar (Elgin i8 / Padrão)</option>
              {impressoras.map(imp => (
                <option key={imp.nome} value={imp.nome}>
                  {imp.nome} {imp.padrao ? '(Padrão)' : ''} — {imp.status}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {impressoras.length === 0
                ? '⚠️ Nenhuma impressora detectada. Verifique se o serviço "Spooler de Impressão" está ativo.'
                : `${impressoras.length} impressora(s) encontrada(s). O sistema tenta USB direto primeiro, depois o driver Windows.`
              }
            </p>
          </div>
          <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={testarImpressao}>
            🧪 Testar Impressão
          </button>
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
                  setChecandoUpdate('Buscando atualizações...');
                  try {
                    await window.api.invoke('updater:verificar');
                  } catch (err) {
                    setChecandoUpdate('');
                    toast('Erro ao iniciar verificação', 'error');
                  }
                }}
                disabled={checandoUpdate !== false && checandoUpdate !== ''}
              >
                {checandoUpdate || 'Verificar Atualizações'}
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
