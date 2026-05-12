import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();

  const processarLogin = useCallback(async (pinCompleto) => {
    setCarregando(true);
    setErro('');
    const resultado = await login(pinCompleto);
    if (!resultado.ok) {
      setErro(resultado.erro || 'PIN inválido');
      setPin('');
    }
    setCarregando(false);
  }, [login]);

  const adicionarDigito = useCallback((digito) => {
    if (pin.length >= 6) return;
    const novoPin = pin + digito;
    setPin(novoPin);
    setErro('');
    if (novoPin.length >= 4) {
      processarLogin(novoPin);
    }
  }, [pin, processarLogin]);

  const apagarDigito = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setErro('');
  }, []);

  useEffect(() => {
    function handleTeclado(e) {
      if (e.key >= '0' && e.key <= '9') adicionarDigito(e.key);
      if (e.key === 'Backspace') apagarDigito();
    }
    window.addEventListener('keydown', handleTeclado);
    return () => window.removeEventListener('keydown', handleTeclado);
  }, [adicionarDigito, apagarDigito]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">MercadoPDV</div>
        <div className="login-subtitle">Digite seu PIN para entrar</div>

        <div className="pin-display">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>

        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div className="loader" />
          </div>
        )}

        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="pin-key" onClick={() => adicionarDigito(String(n))} disabled={carregando}>
              {n}
            </button>
          ))}
          <div />
          <button className="pin-key" onClick={() => adicionarDigito('0')} disabled={carregando}>0</button>
          <button className="pin-key action" onClick={apagarDigito} disabled={carregando}>
            ⌫
          </button>
        </div>

        {erro && <div className="login-error">{erro}</div>}

        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>
          PIN padrão: 1234
        </div>
      </div>
    </div>
  );
}
