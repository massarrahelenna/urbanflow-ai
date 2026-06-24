import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      onAuthSuccess(data.session.user);
    } else if (!isLogin) {
      setError("Verifique seu e-mail para confirmar o cadastro.");
    }
  }

  return (
    <div className="bodySection" style={{ paddingTop: 60 }}>
      <h2 style={{ marginBottom: 16 }}>
        {isLogin ? "Entrar" : "Criar conta"}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <input
            className="inputLike"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        <div className="field">
          <input
            className="inputLike"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        {error && <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>}
        <button className="primaryBtnFull" type="submit" disabled={loading}>
          {loading ? "Aguarde..." : isLogin ? "Entrar" : "Cadastrar"}
        </button>
      </form>
      <button
        className="linkBtn"
        onClick={() => setIsLogin((v) => !v)}
      >
        {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}