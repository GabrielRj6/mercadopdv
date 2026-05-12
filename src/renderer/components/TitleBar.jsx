export default function TitleBar() {
  const settings = JSON.parse(localStorage.getItem('config_sistema') || '{}');
  const nomeExibicao = settings.nomeMercado || 'MERCADO PDV';

  return (
    <div className="title-bar">
      <div className="title-bar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
        {nomeExibicao}
      </div>
      <div className="title-bar-controls">
        <button className="title-bar-btn" onClick={() => window.api.janela.minimizar()} title="Minimizar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button className="title-bar-btn" onClick={() => window.api.janela.maximizar()} title="Maximizar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
        </button>
        <button className="title-bar-btn close" onClick={() => window.api.janela.fechar()} title="Fechar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  );
}
