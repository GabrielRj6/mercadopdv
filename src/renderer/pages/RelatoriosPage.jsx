import { useState, useEffect } from 'react';

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RelatoriosPage() {
  const [aba, setAba] = useState('periodo');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dados, setDados] = useState([]);

  useEffect(() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) carregarDados();
  }, [aba, dataInicio, dataFim]);

  async function carregarDados() {
    const filtros = { dataInicio: dataInicio + ' 00:00:00', dataFim: dataFim + ' 23:59:59' };
    let resultado;

    switch (aba) {
      case 'periodo':
        resultado = await window.api.relatorios.vendasPorPeriodo(filtros);
        break;
      case 'categoria':
        resultado = await window.api.relatorios.vendasPorCategoria(filtros);
        break;
      case 'operador':
        resultado = await window.api.relatorios.vendasPorOperador(filtros);
        break;
      case 'produtos':
        resultado = await window.api.relatorios.produtosMaisVendidos(filtros);
        break;
      default:
        resultado = [];
    }

    setDados(resultado);
  }

  function renderizarTabela() {
    if (dados.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Sem dados para o período selecionado</div>;
    }

    switch (aba) {
      case 'periodo':
        return (
          <table className="table">
            <thead><tr><th>Data</th><th>Vendas</th><th>Total</th></tr></thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.dia}>
                  <td style={{ fontWeight: 600 }}>{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>{d.quantidade}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatarMoeda(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'categoria':
        return (
          <table className="table">
            <thead><tr><th>Categoria</th><th>Vendas</th><th>Total</th></tr></thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.categoria}>
                  <td style={{ fontWeight: 600 }}>{d.categoria}</td>
                  <td>{d.vendas}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatarMoeda(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'operador':
        return (
          <table className="table">
            <thead><tr><th>Operador</th><th>Vendas</th><th>Total</th></tr></thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.operador}>
                  <td style={{ fontWeight: 600 }}>{d.operador}</td>
                  <td>{d.vendas}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatarMoeda(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'produtos':
        return (
          <table className="table">
            <thead><tr><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Peso</th><th>Vendas</th><th>Receita</th></tr></thead>
            <tbody>
              {dados.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{d.nome}</td>
                  <td><span className="badge badge-info">{d.tipo}</span></td>
                  <td>{d.qtd_total || 0}</td>
                  <td>{d.peso_total ? `${d.peso_total.toFixed(2)} kg` : '—'}</td>
                  <td>{d.num_vendas}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatarMoeda(d.receita_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
    }
  }

  const totalGeral = dados.reduce((acc, d) => acc + (d.total || d.receita_total || 0), 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise de vendas e desempenho</p>
        </div>
        <div className="page-actions" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const hoje = new Date().toISOString().split('T')[0];
            setDataInicio(hoje);
            setDataFim(hoje);
          }}>Hoje</button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const dataStr = ontem.toISOString().split('T')[0];
            setDataInicio(dataStr);
            setDataFim(dataStr);
          }}>Ontem</button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const hoje = new Date();
            const inicio = new Date();
            inicio.setDate(hoje.getDate() - 7);
            setDataInicio(inicio.toISOString().split('T')[0]);
            setDataFim(hoje.toISOString().split('T')[0]);
          }}>7 dias</button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const hoje = new Date();
            const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            setDataInicio(inicio.toISOString().split('T')[0]);
            setDataFim(hoje.toISOString().split('T')[0]);
          }}>Mês Atual</button>
          <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 8px' }}></div>
          <input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon green">📊</div>
          <div className="stat-info">
            <div className="stat-value">{formatarMoeda(totalGeral)}</div>
            <div className="stat-label">Faturamento Total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📋</div>
          <div className="stat-info">
            <div className="stat-value">{dados.length}</div>
            <div className="stat-label">Entradas/Registros</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal">📉</div>
          <div className="stat-info">
            <div className="stat-value">{formatarMoeda(dados.length > 0 ? totalGeral / dados.length : 0)}</div>
            <div className="stat-label">Ticket Médio</div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { id: 'periodo', label: 'Por Período' },
          { id: 'categoria', label: 'Por Categoria' },
          { id: 'operador', label: 'Por Operador' },
          { id: 'produtos', label: 'Top Produtos' },
        ].map((t) => (
          <button key={t.id} className={`tab ${aba === t.id ? 'active' : ''}`} onClick={() => setAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="table-wrapper">
        {renderizarTabela()}
      </div>
    </div>
  );
}
