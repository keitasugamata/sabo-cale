import React, { useState, useEffect } from 'react';
import { X, Mail, Cloud, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../supabase';

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // ログイン成功を検知して自動的にモーダルを閉じる
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) onClose();
    });
    return () => subscription.unsubscribe();
  }, [onClose]);

  async function handleEmail(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          // メール確認OFFの場合、即ログイン
          setInfo('登録完了！ログインしました');
        } else {
          // メール確認ON
          setInfo('📧 登録メールを送信しました。受信トレイのリンクをクリックして確認後、ログインしてください。');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      const msg = e.message || String(e);
      if (msg.includes('Email not confirmed')) {
        setError('メール確認が完了していません。受信メール内のリンクをクリックしてください');
      } else if (msg.includes('Invalid login')) {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxHeight: '85dvh' }}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div>
            <h2 className="modal-title">クラウド同期</h2>
            <p className="modal-date">スマホとPCで予定を共有</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {!supabase ? (
            <div className="sync-not-configured">
              <Cloud size={32} color="var(--text-muted)" />
              <p>クラウド同期が設定されていません</p>
              <p className="sync-hint">
                <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> を
                環境変数に設定してください。
              </p>
            </div>
          ) : (
            <>
              {/* メール/パスワード */}
              <form className="auth-form" onSubmit={handleEmail}>
                <input
                  type="email"
                  className="sync-input"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="sync-input"
                  placeholder="パスワード（6文字以上）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  <Mail size={14} />
                  {mode === 'signup' ? '新規登録' : 'ログイン'}
                </button>
                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo(''); }}
                >
                  {mode === 'signup' ? 'すでにアカウントをお持ちですか？ ログイン' : 'アカウントをお持ちでない方は 新規登録'}
                </button>
              </form>

              {info && <p className="sync-status success"><Check size={14} /> {info}</p>}
              {error && <p className="sync-status error"><AlertCircle size={14} /> {error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
