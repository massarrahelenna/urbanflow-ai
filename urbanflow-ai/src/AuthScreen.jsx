import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Busca cidade/bairro a partir de lat/lng usando a API gratuita do OpenStreetMap (Nominatim)
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const data = await res.json();
    const addr = data.address || {};

    const ufCode = addr["ISO3166-2-lvl4"] || "";
    const isDF = ufCode === "BR-DF";

    let cidade = "";
    let bairro = "";

    if (isDF) {
      // No DF, a Região Administrativa (que funciona como "bairro") costuma
      // vir nos campos city/town. Os campos suburb/neighbourhood tendem a
      // trazer o nome do condomínio/loteamento, que é granular demais.
      cidade = "Brasília";
      bairro =
        addr.city ||
        addr.town ||
        addr.city_district ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        "";
    } else {
      cidade = addr.city || addr.town || addr.municipality || addr.county || "";
      bairro = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || "";
    }

    return { cidade, bairro };
  } catch (err) {
    console.error("Erro no reverse geocoding:", err);
    return { cidade: "", bairro: "" };
  }
}

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Quando entra no modo cadastro, tenta sugerir cidade/bairro automaticamente
  useEffect(() => {
    if (isLogin) return;
    if (!navigator.geolocation) return;

    setBuscandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { cidade: c, bairro: b } = await reverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude
        );
        if (c) setCidade((prev) => prev || c);
        if (b) setBairro((prev) => prev || b);
        setBuscandoLocal(false);
      },
      () => setBuscandoLocal(false)
    );
  }, [isLogin]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      onAuthSuccess(data.session.user);
      return;
    }

    // Cadastro — guardamos nome/cidade/bairro nos metadados do Auth, porque
    // nesse momento ainda não existe sessão ativa (o e-mail precisa ser
    // confirmado antes), então não temos auth.uid() pra gravar na tabela
    // profiles direto. Esses metadados são lidos depois, no primeiro login.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: `${nome} ${sobrenome}`.trim(),
          cidade,
          bairro,
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      onAuthSuccess(data.session.user);
    } else {
      setError("Verifique seu e-mail para confirmar o cadastro.");
    }
  }

  return (
    <div className="bodySection" style={{ paddingTop: 40 }}>
      <h2 style={{ marginBottom: 16 }}>{isLogin ? "Entrar" : "Criar conta"}</h2>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <div className="fieldRow">
              <div className="field" style={{ flex: 1 }}>
                <input
                  className="inputLike"
                  type="text"
                  placeholder="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <input
                  className="inputLike"
                  type="text"
                  placeholder="Sobrenome"
                  value={sobrenome}
                  onChange={(e) => setSobrenome(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div className="field">
              <input
                className="inputLike"
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                style={{ width: "100%" }}
              />
              {buscandoLocal && (
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                  Detectando sua localização...
                </p>
              )}
            </div>

            <div className="field">
              <input
                className="inputLike"
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}

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
      <button className="linkBtn" onClick={() => setIsLogin((v) => !v)}>
        {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}