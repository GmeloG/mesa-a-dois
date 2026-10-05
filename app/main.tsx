import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, type User } from 'firebase/auth';
import MealApp from './meal-app';
import { auth, db, projectId, firebaseConfigured, firebaseProblem } from '@/lib/firebase';
import { firebaseStore, firebaseMessage } from '@/lib/firebase-store';
import { demoStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './globals.css';

function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.__mesaBooted = true; }, []);
  useEffect(() => {
    if (!auth) return;
    // Sem resposta do Firebase Auth (por exemplo, rede bloqueada), não ficar preso no carregamento.
    const timer = setTimeout(() => setReady(true), 8000);
    const stop = onAuthStateChanged(auth, value => { clearTimeout(timer); setUser(value); setReady(true); }, e => { clearTimeout(timer); setError(firebaseMessage(e)); setReady(true); });
    return () => { clearTimeout(timer); stop(); };
  }, []);
  const store = useMemo(() => demo ? demoStore() : user && db ? firebaseStore(db, user, projectId) : null, [demo, user]);
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!auth) return; setBusy(true); setError(''); setNotice('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword(''); }
    catch (e) { setError(firebaseMessage(e)); } finally { setBusy(false); }
  }
  async function reset() {
    if (!auth || !email.trim()) { setError('Preenche o email para recuperar a palavra-passe.'); return; }
    setBusy(true); setError('');
    try { await sendPasswordResetEmail(auth, email.trim()); setNotice('Se esta conta existir, receberás as instruções por email.'); }
    catch (e) { setError(firebaseMessage(e)); } finally { setBusy(false); }
  }
  async function exit() {
    if (demo) { setDemo(false); return; }
    store?.clearCache();
    if (auth) { try { await signOut(auth); } catch (e) { setError(firebaseMessage(e)); } }
  }
  if (store && ready) return <MealApp key={demo ? 'demo' : user!.uid} store={store} onExit={exit} />;
  return <main className="login-page"><section className="login-card"><img className="login-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><p className="eyebrow">GONÇALO & INÊS</p><h1>Mesa a Dois</h1><p className="subtitle">O vosso plano semanal, as vossas porções e as compras num só lugar.</p>
    {!ready ? <p role="status">A abrir a tua sessão…</p> : firebaseConfigured ? <form className="form-stack" onSubmit={login}><label className="field">Email<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Palavra-passe<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><Button type="submit" className="primary" disabled={busy}>{busy ? 'A entrar…' : 'Entrar no vosso plano'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={reset}>Esqueci-me da palavra-passe</Button></form> : <div className="notice" role="alert"><div><strong>Falta configurar o Firebase</strong><p>{firebaseProblem}</p><p>Corrige o ficheiro <code>public/firebase-config.js</code> (ver README) e volta a publicar. Entretanto, podes experimentar a demonstração.</p><Button variant="outline" onClick={() => location.reload()}>Tentar novamente</Button></div></div>}
    {error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="demo-entry"><Button variant="outline" disabled={busy} onClick={() => setDemo(true)}>Experimentar demonstração</Button><small>Dados de exemplo, guardados só neste dispositivo. Não entram no vosso plano partilhado.</small></div>
  </section></main>;
}

async function clearAndReload() {
  try {
    if ('serviceWorker' in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
  } finally { location.reload(); }
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error?.message || String(error) }; }
  componentDidCatch() { window.__mesaBooted = true; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="login-page"><section className="login-card"><h1>Não foi possível abrir a aplicação.</h1><p>Ocorreu um erro inesperado. Os dados guardados não foram alterados.</p><pre className="error-detail">{this.state.error}</pre><div className="button-row"><Button className="primary" onClick={() => location.reload()}>Tentar novamente</Button><Button variant="outline" onClick={clearAndReload}>Limpar cache e recarregar</Button></div></section></main>;
  }
}

/** Regista o service worker e avisa quando há uma versão nova, sem forçar recargas a meio de uma edição. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then(registration => {
    const check = () => { if (document.visibilityState === 'visible') registration.update().catch(() => {}); };
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.getElementById('update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'update-banner'; banner.className = 'update-banner'; banner.setAttribute('role', 'status');
    banner.innerHTML = '<span>Nova versão disponível.</span>';
    const button = document.createElement('button'); button.textContent = 'Atualizar agora'; button.onclick = () => location.reload();
    banner.appendChild(button); document.body.appendChild(banner);
  });
}

registerServiceWorker();
createRoot(document.getElementById('root')!).render(<ErrorBoundary><AuthGate /></ErrorBoundary>);
