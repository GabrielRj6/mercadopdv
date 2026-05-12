import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import PDVPage from './pages/PDVPage';
import ProdutosPage from './pages/ProdutosPage';
import VendasPage from './pages/VendasPage';
import CaixaPage from './pages/CaixaPage';
import RelatoriosPage from './pages/RelatoriosPage';
import OperadoresPage from './pages/OperadoresPage';
import BackupPage from './pages/BackupPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';

function AppContent() {
  const { operador } = useAuth();
  const [paginaAtual, setPaginaAtual] = useState('pdv');

  if (!operador) return <LoginPage />;

  function renderizarPagina() {
    switch (paginaAtual) {
      case 'pdv': return <PDVPage onNavegar={setPaginaAtual} />;
      case 'produtos': return <ProdutosPage />;
      case 'vendas': return <VendasPage />;
      case 'caixa': return <CaixaPage />;
      case 'relatorios': return <RelatoriosPage />;
      case 'operadores': return <OperadoresPage />;
      case 'backup': return <BackupPage />;
      case 'config': return <ConfiguracoesPage />;
      default: return <PDVPage onNavegar={setPaginaAtual} />;
    }
  }

  if (paginaAtual === 'pdv') {
    return (
      <div className="app-layout">
        <TitleBar />
        <PDVPage onNavegar={setPaginaAtual} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <TitleBar />
      <div className="app-content">
        <Sidebar paginaAtual={paginaAtual} onNavegar={setPaginaAtual} />
        {renderizarPagina()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
