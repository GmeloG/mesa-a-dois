import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, type User } from 'firebase/auth';
import MealApp from './meal-app';
import { auth, db, projectId, firebaseConfigured } from '@/lib/firebase';
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
  useEffect(() => auth ? onAuthStateChanged(auth, value => { setUser(value); setReady(true); }, e => { setError(firebaseMessage(e)); setReady(true); }) : undefined, []);
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
    store?.clearCache(); if (auth) await signOut(auth);
  }
  if (store && ready) return <MealApp key={demo ? 'demo' : user!.uid} store={store} onExit={exit} />;
  return <main className="login-page"><section className="login-card"><img className="login-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><p className="eyebrow">GONÇALO & INÊS</p><h1>Mesa a Dois</h1><p className="subtitle">O vosso plano semanal, as vossas porções e as compras num só lugar.</p>
    {!ready ? <p role="status">A abrir a tua sessão…</p> : firebaseConfigured ? <form className="form-stack" onSubmit={login}><label className="field">Email<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Palavra-passe<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><Button type="submit" className="primary" disabled={busy}>{busy ? 'A entrar…' : 'Entrar no vosso plano'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={reset}>Esqueci-me da palavra-passe</Button></form> : <div className="notice"><div><strong>Falta ligar o Firebase</strong><p>Preenche a configuração Web do teu projeto no ficheiro firebase-config.js. Podes experimentar já a aplicação na demonstração abaixo.</p></div></div>}
    {error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="demo-entry"><Button variant="outline" disabled={busy} onClick={() => setDemo(true)}>Experimentar demonstração</Button><small>Dados de exemplo, guardados só neste dispositivo. Não entram no vosso plano partilhado.</small></div>
  </section></main>;
}
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string}> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <main className="login-page"><section className="login-card"><h1>Não foi possível abrir a aplicação.</h1><p>Atualiza a página e confirma a configuração do Firebase.</p>{import.meta.env.DEV && <pre>{this.state.error}</pre>}<button onClick={() => location.reload()}>Tentar novamente</button></section></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><AuthGate /></ErrorBoundary>);
