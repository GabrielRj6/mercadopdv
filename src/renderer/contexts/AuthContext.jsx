import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [operador, setOperador] = useState(null);

  const login = useCallback(async (pin) => {
    const resultado = await window.api.operadores.autenticar(pin);
    if (resultado.ok) {
      setOperador(resultado.operador);
      return { ok: true };
    }
    return { ok: false, erro: resultado.erro };
  }, []);

  const logout = useCallback(() => {
    setOperador(null);
  }, []);

  return (
    <AuthContext.Provider value={{ operador, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
