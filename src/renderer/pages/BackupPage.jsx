import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function BackupPage() {
  const toast = useToast();
  const [carregando, setCarregando] = useState(false);

  async function criarBackup() {
    try {
      setCarregando(true);
      const resultado = await window.api.backup.criar();
      if (resultado && resultado.ok) {
        toast(`Backup criado em: ${resultado.caminho}`, 'success');
      } else {
        toast(`Erro ao criar backup: ${resultado?.erro || 'Desconhecido'}`, 'error');
      }
    } catch (err) {
      toast('Falha ao processar backup', 'error');
    } finally {
      setCarregando(false);
    }
  }

  async function restaurarBackup() {
    try {
      const caminho = await window.api.backup.selecionarArquivo();
      if (!caminho) return;

      setCarregando(true);
      const resultado = await window.api.backup.restaurar(caminho);
      if (resultado && resultado.ok) {
        toast('Backup restaurado com sucesso!', 'success');
      } else {
        toast(`Erro ao restaurar: ${resultado?.erro || 'Arquivo corrompido'}`, 'error');
      }
    } catch (err) {
      toast('Falha ao restaurar banco de dados', 'error');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Backup & Restauração</h1>
          <p className="page-subtitle">Gerencie a segurança dos seus dados</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 700 }}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💾</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Criar Backup</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Salva uma cópia do banco de dados na área de trabalho
          </p>
          <button className="btn btn-primary btn-lg" onClick={criarBackup} disabled={carregando} style={{ width: '100%' }}>
            {carregando ? <span className="loader" style={{ width: 18, height: 18 }} /> : 'Criar Backup'}
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Restaurar Backup</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Restaura o banco a partir de um arquivo .db anterior
          </p>
          <button className="btn btn-secondary btn-lg" onClick={restaurarBackup} disabled={carregando} style={{ width: '100%' }}>
            {carregando ? <span className="loader" style={{ width: 18, height: 18 }} /> : 'Selecionar Arquivo'}
          </button>
        </div>
      </div>

      <div className="alert-box warning" style={{ marginTop: 24, maxWidth: 700 }}>
        ⚠️ A restauração substitui todos os dados atuais. Crie um backup antes de restaurar.
      </div>
    </div>
  );
}
