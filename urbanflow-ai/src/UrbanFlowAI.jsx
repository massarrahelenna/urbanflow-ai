import React, { useState, useMemo, useRef, useEffect } from "react";
import { Home, MapPin, ClipboardList, User } from "lucide-react";
import "./App.css";
import { supabase } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import "./leafletFix.js";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

// Busca cidade/bairro a partir de lat/lng (OpenStreetMap Nominatim, gratuito)
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

function RecenterOnLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], map.getZoom());
    }
  }, [location, map]);
  return null;
}

const ORANGE = "#F2641A";

const TYPE_META = {
  buraco: { label: "Buraco", icon: "⚠", color: "#D4500F" },
  semaforo: { label: "Semáforo defeituoso", icon: "⛟", color: "#D97706" },
  alagamento: { label: "Alagamento", icon: "≈", color: "#2563EB" },
  calcada: { label: "Calçada danificada", icon: "▦", color: "#15803D" },
  iluminacao: { label: "Iluminação pública", icon: "✦", color: "#7C3AED" },
  lixo: { label: "Lixo acumulado", icon: "✦", color: "#92400E" },
};

const BAIRROS = ["Todos", "Centro", "Jardim América", "Vila Nova", "Viv Centro", "Cambuí", "Santa Cecília"];
const TIPOS = ["Todos", ...Object.values(TYPE_META).map((t) => t.label)];
const GRAVIDADES = ["Todas", "Baixa", "Média", "Alta"];

function distanciaMetros(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function aiAnalyze({ tipo, descricao, temFoto, duplicatasCount = 0 }) {
  const tipoDetectado = tipo || "buraco";
  const texto = (descricao || "").toLowerCase();
  let criticidade = "baixa";
  const altaKeywords = ["risco", "grave", "acidente", "perigo", "grande", "queda", "feridos"];
  const mediaKeywords = ["recorrente", "dificulta", "constante", "frequente"];
  if (altaKeywords.some((k) => texto.includes(k)) || (tipoDetectado === "buraco" && temFoto)) {
    criticidade = "alta";
  } else if (mediaKeywords.some((k) => texto.includes(k))) {
    criticidade = "media";
  } else if (texto.length > 60) {
    criticidade = "media";
  }

  const resumo = `Ocorrência classificada como "${TYPE_META[tipoDetectado]?.label || tipoDetectado}", criticidade ${criticidade}. ${
    descricao ? `Relato do cidadão: "${descricao.slice(0, 120)}${descricao.length > 120 ? "…" : ""}".` : "Sem descrição adicional."
  } ${duplicatasCount > 0 ? `Atenção: ${duplicatasCount} ocorrência(s) semelhante(s) já registrada(s) nas proximidades.` : "Nenhuma duplicata identificada nas proximidades."} Recomenda-se encaminhamento ao órgão responsável para vistoria.`;

  return { tipoDetectado, criticidade, resumo };
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function useUserLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, error };
}

function PhoneFrame({ children }) {
  return (
    <div className="phoneFrame">
      <div className="phoneScreen">{children}</div>
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div className="topBar">
      {onBack ? (
        <button onClick={onBack} className="iconBtn" aria-label="Voltar">←</button>
      ) : (
        <span className="iconBtnSpacer" />
      )}
      <span className="topBarTitle">{title}</span>
      <span className="iconBtnSpacer">{right || ""}</span>
    </div>
  );
}

function BottomNav({ active, onNavigate }) {
  const items = [
    { key: "home", label: "Início", icon: <Home size={20} /> },
    { key: "mapa", label: "Mapa", icon: <MapPin size={20} /> },
    { key: "ocorrencias", label: "Ocorrências", icon: <ClipboardList size={20} /> },
    { key: "perfil", label: "Perfil", icon: <User size={20} /> },
  ];
  return (
    <div className="bottomNav">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onNavigate(it.key)}
            className={`bottomNavItem ${isActive ? "active" : ""}`}
          >
            <div className="bottomNavIcon">{it.icon}</div>
            <div className={`bottomNavLabel ${isActive ? "active" : ""}`}>{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ icon, value, label, sublabel, color }) {
  return (
    <div className="statCard">
      <div className="statIcon" style={{ background: color + "1A", color }}>{icon}</div>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
      <div className="statSublabel">{sublabel}</div>
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

function RealMap({ pins = [], onPinClick, height = 230, userLocation }) {
  const fallbackCenter = [-15.7801, -47.9292];
  const center = userLocation ? [userLocation.lat, userLocation.lng] : fallbackCenter;

  return (
    <div className="mapBox" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: "100%" }} scrollWheelZoom={true}>
        <RecenterOnLocation location={userLocation} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Você está aqui</Popup>
          </Marker>
        )}
        {pins
          .filter((p) => p.latReal != null && p.lngReal != null)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.latReal, p.lngReal]}
              eventHandlers={{ click: () => onPinClick && onPinClick(p) }}
            >
              <Popup>
                <strong>{p.titulo}</strong>
                <br />
                {p.bairro || "Sem bairro informado"}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}

// ---------------------------------------------------------------------
// SCREEN 1 — HOME
// ---------------------------------------------------------------------
function HomeScreen({ onNavigate }) {
  const [stats, setStats] = useState({ buraco: 0, semaforo: 0, alagamento: 0, calcada: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarStats() {
  const { data, error } = await supabase.from("ocorrencias").select("tipo");
  if (!error && data) {
    const counts = { buraco: 0, semaforo: 0, alagamento: 0, calcada: 0, iluminacao: 0, lixo: 0 };
    data.forEach((o) => {
      if (counts[o.tipo] !== undefined) counts[o.tipo] += 1;
    });
    setStats(counts);
  }
  setLoading(false);
}
    carregarStats();
  }, []);

  return (
    <>
      <div className="heroSection">
        <div className="topBarFlat">
          <div className="logoRow">
            <div className="logoMark">▦</div>
            <span className="logoText">
              UrbanFlow <span className="logoTextAccent">AI</span>
            </span>
          </div>
          <button className="bellBtn" aria-label="Notificações">🔔</button>
        </div>

        <h1 className="heroTitle">Sua cidade melhor começa com a sua voz.</h1>
        <p className="heroSub">
          Registre problemas na infraestrutura urbana e ajude a transformar sua cidade com dados e inteligência.
        </p>

        <button className="primaryBtn" onClick={() => onNavigate("registrar")}>
          + Registrar ocorrência
        </button>
        <button className="secondaryBtn" onClick={() => onNavigate("mapa")}>
          🗺 Ver mapa
        </button>
      </div>

      <div className="bodySection">
        <div className="sectionHeaderRow">
          <span className="sectionTitle">Panorama da cidade</span>
          <span className="sectionHeaderMuted">{loading ? "Carregando..." : "Atual"}</span>
        </div>

        <div className="statGrid">
          <StatCard icon="⚠" value={stats.buraco} label="Buracos" sublabel="reportados" color={ORANGE} />
          <StatCard icon="⛟" value={stats.semaforo} label="Semáforos" sublabel="com problema" color="#D97706" />
          <StatCard icon="≈" value={stats.alagamento} label="Alagamentos" sublabel="registrados" color="#2563EB" />
          <StatCard icon="▦" value={stats.calcada} label="Calçadas" sublabel="danificadas" color="#15803D" />
          <StatCard icon="✦" value={stats.iluminacao} label="Iluminação" sublabel="com problema" color="#7C3AED" />
          <StatCard icon="✦" value={stats.lixo} label="Lixo" sublabel="acumulado" color="#92400E" />
        </div>
      </div>

      <BottomNav active="home" onNavigate={(k) => onNavigate(k)} />
    </>
  );
}

// ---------------------------------------------------------------------
// SCREEN 2 — REGISTRAR OCORRÊNCIA
// ---------------------------------------------------------------------
function Field({ label, children }) {
  return (
    <div className="field">
      {label && <div className="fieldLabel">{label}</div>}
      {children}
    </div>
  );
}

function RegistrarScreen({ onNavigate, onSubmit, user }) {
  const tipos = [
    { key: "buraco", label: "Buraco" },
    { key: "semaforo", label: "Semáforo defeituoso" },
    { key: "alagamento", label: "Alagamento" },
    { key: "calcada", label: "Calçada danificada" },
    { key: "iluminacao", label: "Iluminação pública" },
    { key: "lixo", label: "Lixo acumulado" },
  ];

  const [tipo, setTipo] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [recorrencia, setRecorrencia] = useState("");
  const [file, setFile] = useState(null);
  const [bairro, setBairro] = useState("");
  const [buscandoBairro, setBuscandoBairro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fileInputRef = useRef(null);

  const { location, error: locError } = useUserLocation();

  useEffect(() => {
    if (!location) return;
    setBuscandoBairro(true);
    reverseGeocode(location.lat, location.lng).then(({ bairro: b }) => {
      if (b) setBairro(b);
      setBuscandoBairro(false);
    });
  }, [location]);

  const agora = new Date();
  const today = agora.toLocaleDateString("pt-BR");
  const now = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const tipoLabel = tipos.find((t) => t.key === tipo)?.label;

  async function handleSubmit() {
    if (!tipo) {
      setTipoOpen(true);
      return;
    }
    setErro("");
    setEnviando(true);

    try {
      let foto_url = null;

      if (file) {
        const nomeArquivo = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("ocorrencias-fotos")
          .upload(nomeArquivo, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("ocorrencias-fotos")
          .getPublicUrl(nomeArquivo);

        foto_url = urlData.publicUrl;
      }

      let duplicatasCount = 0;
      if (location) {
        const { data: proximas } = await supabase
          .from("ocorrencias")
          .select("lat,lng,tipo")
          .eq("tipo", tipo);

        if (proximas) {
          duplicatasCount = proximas.filter((o) => {
            const d = distanciaMetros(location.lat, location.lng, o.lat, o.lng);
            return d != null && d < 150;
          }).length;
        }
      }

      const analysis = aiAnalyze({ tipo, descricao, temFoto: !!file, duplicatasCount });

      const { data, error: insertError } = await supabase
        .from("ocorrencias")
        .insert({
          tipo,
          titulo: tipoLabel,
          descricao,
          bairro,
          recorrencia,
          foto_url,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          criticidade: analysis.criticidade,
          resumo_ia: analysis.resumo,
          status: "classificada",
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onSubmit({
        ...data,
        protocolo: `#UF-${data.id.slice(0, 8).toUpperCase()}`,
        analysis,
        data: today,
        hora: now,
      });
    } catch (err) {
      console.error(err);
      setErro("Erro ao enviar ocorrência: " + err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <TopBar title="Registrar ocorrência" onBack={() => onNavigate("home")} />
      <div className="bodySection bodySection--withTabBar">
        <Field label="Geolocalização exata">
          <RealMap userLocation={location} height={140} />
          {locError && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{locError}</p>}
          {!location && !locError && (
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Obtendo sua localização...</p>
          )}
        </Field>

        <Field label="Bairro">
          <input
            className="inputLike"
            type="text"
            style={{ width: "100%" }}
            placeholder="Bairro onde está o problema"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          {buscandoBairro && (
            <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Detectando bairro...</p>
          )}
        </Field>

        <Field label="Tipo de problema">
          <div style={{ position: "relative" }}>
            <button className="selectLike" onClick={() => setTipoOpen((v) => !v)}>
              <span className={tipo ? "selectLikeValue" : "selectLikePlaceholder"}>
                {tipoLabel || "Selecione o tipo"}
              </span>
              <span>▾</span>
            </button>
            {tipoOpen && (
              <div className="dropdown">
                {tipos.map((t) => (
                  <button
                    key={t.key}
                    className="dropdownItem"
                    onClick={() => {
                      setTipo(t.key);
                      setTipoOpen(false);
                    }}
                  >
                    <span style={{ color: TYPE_META[t.key].color }}>{TYPE_META[t.key].icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button className="uploadBox" onClick={() => fileInputRef.current?.click()}>
            <div className="uploadIcon">{file ? "✅" : "📷"}</div>
            <div className="uploadTextWrap">
              <div className="uploadTitle">{file ? file.name : "Enviar foto/vídeo"}</div>
              <div className="uploadSubtitle">
                {file ? "A IA vai analisar o conteúdo enviado" : "Adicione uma imagem ou vídeo para ajudar na análise"}
              </div>
            </div>
          </button>
        </Field>

        <div className="fieldRow">
          <Field label="Data">
            <div className="inputLike">{today} 📅</div>
          </Field>
          <Field label="Hora">
            <div className="inputLike">{now} 🕘</div>
          </Field>
        </div>

        <Field label={<span>Recorrência <span title="O problema já aconteceu antes?">ⓘ</span></span>}>
          <select className="selectNative" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)}>
            <option value="">Selecione</option>
            <option value="primeira">Primeira vez</option>
            <option value="recorrente">Já aconteceu antes</option>
            <option value="constante">Problema constante</option>
          </select>
        </Field>

        <Field label="Descrição">
          <textarea
            className="textarea"
            maxLength={500}
            placeholder="Descreva o problema com o máximo de detalhes possível..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="charCount">{descricao.length}/500</div>
        </Field>

        {erro && <p style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{erro}</p>}

        <button className="primaryBtnFull" onClick={handleSubmit} disabled={enviando}>
          {enviando ? "Enviando..." : "➤ Enviar ocorrência"}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// SCREEN 3 — MAPA DE OCORRÊNCIAS
// ---------------------------------------------------------------------
function MapaScreen({ onNavigate }) {
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroGravidade, setFiltroGravidade] = useState("Todas");
  const [filtroBairro, setFiltroBairro] = useState("Todos");
  const [ocorrencias, setOcorrencias] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const { location } = useUserLocation();

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setErro("Erro ao carregar ocorrências: " + error.message);
      } else {
        const mapeadas = (data || []).map((o) => ({
          ...o,
          latReal: o.lat,
          lngReal: o.lng,
        }));
        setOcorrencias(mapeadas);
        if (mapeadas.length > 0) setSelected(mapeadas[0]);
      }
      setLoading(false);
    }
    carregar();
  }, []);

  const filtered = useMemo(() => {
    return ocorrencias.filter((o) => {
      const tipoOk = filtroTipo === "Todos" || TYPE_META[o.tipo]?.label === filtroTipo;
      const gravOk =
        filtroGravidade === "Todas" ||
        o.criticidade === filtroGravidade.toLowerCase().replace("é", "e");
      const bairroOk = filtroBairro === "Todos" || o.bairro === filtroBairro;
      return tipoOk && gravOk && bairroOk;
    });
  }, [ocorrencias, filtroTipo, filtroGravidade, filtroBairro]);

  const distanciaSelecionada =
    selected && location
      ? distanciaMetros(location.lat, location.lng, selected.lat, selected.lng)
      : null;

  return (
    <>
      <div className="topBarFlatDark">
        <button className="iconBtnLight" aria-label="Menu">☰</button>
        <span className="topBarFlatDarkTitle">Mapa de ocorrências</span>
        <button className="iconBtnLight" aria-label="Filtros">▾</button>
      </div>

      <div className="filterRow">
        <FilterChip label="Tipo" value={filtroTipo} options={TIPOS} onChange={setFiltroTipo} />
        <FilterChip label="Gravidade" value={filtroGravidade} options={GRAVIDADES} onChange={setFiltroGravidade} />
        <FilterChip label="Bairro" value={filtroBairro} options={BAIRROS} onChange={setFiltroBairro} />
      </div>

      <RealMap pins={filtered} onPinClick={setSelected} userLocation={location} height={260} />

      {loading && <p style={{ textAlign: "center", padding: 16, color: "#6B7280" }}>Carregando ocorrências...</p>}
      {erro && <p style={{ textAlign: "center", padding: 16, color: "#DC2626" }}>{erro}</p>}
      {!loading && !erro && filtered.length === 0 && (
        <p style={{ textAlign: "center", padding: 16, color: "#6B7280" }}>Nenhuma ocorrência encontrada.</p>
      )}

      {selected && filtered.includes(selected) && (
        <div className="occCard">
          <div className="occCardPhoto">
            {selected.foto_url ? (
              <img src={selected.foto_url} alt={selected.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
            ) : (
              "—"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="occCardHeader">
              <span className="occCardTitle">{selected.titulo}</span>
              <span className="occCardChevron">›</span>
            </div>
            <div className="occCardBairro">Bairro: {selected.bairro || "Não informado"}</div>
            <div className="occCardCritRow">
              <span className="occCardCritLabel">Criticidade:</span>
              <Pill tone={selected.criticidade}>{cap(selected.criticidade)}</Pill>
            </div>
            <div className="occCardMeta">
              {new Date(selected.created_at).toLocaleDateString("pt-BR")} •{" "}
              {new Date(selected.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {distanciaSelecionada != null && <> &nbsp;&nbsp;📍 {distanciaSelecionada} m</>}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="mapa" onNavigate={(k) => onNavigate(k)} />
    </>
  );
}

function FilterChip({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const active = value !== options[0];
  return (
    <div style={{ position: "relative" }}>
      <button className={`chip ${active ? "active" : ""}`} onClick={() => setOpen((v) => !v)}>
        {active ? value : label} ▾
      </button>
      {open && (
        <div className="chipDropdown">
          {options.map((o) => (
            <button
              key={o}
              className="chipDropdownItem"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// SCREEN — MINHAS OCORRÊNCIAS (lista das ocorrências do usuário logado)
// ---------------------------------------------------------------------
function MinhasOcorrenciasScreen({ onNavigate, user }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErro("Erro ao carregar suas ocorrências: " + error.message);
      } else {
        setOcorrencias(data || []);
      }
      setLoading(false);
    }
    carregar();
  }, [user.id]);

  const statusOptions = ["Todos", "classificada", "encaminhada", "resolvida"];
  const statusLabel = {
    classificada: "Em análise",
    encaminhada: "Encaminhada",
    resolvida: "Resolvida",
  };

  const filtradas =
    filtroStatus === "Todos"
      ? ocorrencias
      : ocorrencias.filter((o) => o.status === filtroStatus);

  return (
    <>
      <TopBar title="Minhas ocorrências" onBack={() => onNavigate("home")} />

      <div className="filterRow" style={{ padding: "0 16px 12px" }}>
        {statusOptions.map((s) => (
          <button
            key={s}
            className={`chip ${filtroStatus === s ? "active" : ""}`}
            onClick={() => setFiltroStatus(s)}
          >
            {s === "Todos" ? "Todos" : statusLabel[s]}
          </button>
        ))}
      </div>

      <div className="bodySection bodySection--withTabBar" style={{ paddingTop: 0 }}>
        {loading && <p style={{ textAlign: "center", padding: 16, color: "#6B7280" }}>Carregando...</p>}
        {erro && <p style={{ textAlign: "center", padding: 16, color: "#DC2626" }}>{erro}</p>}

        {!loading && !erro && filtradas.length === 0 && (
          <div style={{ textAlign: "center", padding: 32 }}>
            <p className="emptyText">
              {ocorrencias.length === 0
                ? "Você ainda não registrou nenhuma ocorrência."
                : "Nenhuma ocorrência com esse status."}
            </p>
            {ocorrencias.length === 0 && (
              <button className="primaryBtnFull" onClick={() => onNavigate("registrar")}>
                Registrar ocorrência
              </button>
            )}
          </div>
        )}

        {filtradas.map((o) => (
          <button
            key={o.id}
            className="occCard"
            style={{ width: "100%", textAlign: "left", marginBottom: 12, cursor: "pointer" }}
            onClick={() =>
              onNavigate("confirmacao", {
                ...o,
                protocolo: `#UF-${o.id.slice(0, 8).toUpperCase()}`,
                analysis: { criticidade: o.criticidade, resumo: o.resumo_ia },
                data: new Date(o.created_at).toLocaleDateString("pt-BR"),
                hora: new Date(o.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            }
          >
            <div className="occCardPhoto">
              {o.foto_url ? (
                <img
                  src={o.foto_url}
                  alt={o.titulo}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                />
              ) : (
                "—"
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div className="occCardHeader">
                <span className="occCardTitle">{o.titulo}</span>
                <span className="occCardChevron">›</span>
              </div>
              <div className="occCardBairro">Bairro: {o.bairro || "Não informado"}</div>
              <div className="occCardCritRow">
                <span className="occCardCritLabel">Status:</span>
                <Pill tone="status">{statusLabel[o.status] || o.status}</Pill>
                <Pill tone={o.criticidade}>{cap(o.criticidade)}</Pill>
              </div>
              <div className="occCardMeta">
                {new Date(o.created_at).toLocaleDateString("pt-BR")} •{" "}
                {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </button>
        ))}
      </div>

      <BottomNav active="ocorrencias" onNavigate={(k) => onNavigate(k)} />
    </>
  );
}

// ---------------------------------------------------------------------
// SCREEN 4 — CONFIRMAÇÃO / ACOMPANHAMENTO
// ---------------------------------------------------------------------
function ConfirmacaoScreen({ registro, onNavigate }) {
  if (!registro) {
    return (
      <>
        <TopBar title="Ocorrência registrada" onBack={() => onNavigate("home")} />
        <div className="bodySection">
          <p className="emptyText">Nenhuma ocorrência registrada ainda.</p>
          <button className="primaryBtnFull" onClick={() => onNavigate("registrar")}>
            Registrar ocorrência
          </button>
        </div>
      </>
    );
  }

  const { protocolo, analysis, data, hora, status } = registro;
  const crit = analysis.criticidade;

  const steps = [
    { key: "registrada", label: "Registrada", done: true, desc: "Ocorrência recebida com sucesso.", time: `${data} • ${hora}` },
    { key: "classificada", label: "Classificada", done: status !== "classificada", current: status === "classificada", desc: "Em análise pela equipe técnica." },
    { key: "encaminhada", label: "Encaminhada", done: status === "encaminhada" || status === "resolvida", current: status === "encaminhada", desc: "Será encaminhada ao órgão responsável." },
    { key: "resolvida", label: "Resolvida", done: status === "resolvida", current: status === "resolvida", desc: "Aguardando resolução do problema." },
  ];

  return (
    <>
      <TopBar title="Ocorrência registrada" onBack={() => onNavigate("home")} />
      <div className="bodySection bodySection--withTimeline">
        <div className="confirmHeader">
          <div className="successCircle">✓</div>
          <div className="confirmHeaderTitle">Ocorrência registrada com sucesso</div>
        </div>

        <div className="summaryCard">
          <SummaryRow label="Protocolo" value={protocolo} bold />
          <SummaryRow label="Status" valueNode={<Pill tone="status">Em análise</Pill>} />
          <SummaryRow label="Criticidade" valueNode={<Pill tone={crit}>{cap(crit)}</Pill>} />
          <SummaryRow label="Registrada em" value={`${data} • ${hora}`} last />
        </div>

        <div className="aiBox">
          <div className="aiBoxTitle">✦ Resumo técnico gerado por IA</div>
          <div className="aiBoxText">{analysis.resumo}</div>
        </div>

        <div className="timelineSectionTitle">Acompanhe o andamento</div>
        <div className="timeline">
          {steps.map((s, i) => (
            <div key={s.key} className="timelineRow">
              <div className="timelineDotCol">
                <div
                  className={`timelineDot ${
                    s.done ? "timelineDot--done" : s.current ? "timelineDot--current" : "timelineDot--pending"
                  }`}
                >
                  {s.done ? "✓" : ""}
                </div>
                {i < steps.length - 1 && <div className="timelineLine" />}
              </div>
              <div className="timelineContent">
                <div className="timelineLabel">{s.label}</div>
                {s.time && <div className="timelineTime">{s.time}</div>}
                <div className="timelineDesc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="primaryBtnFull" onClick={() => onNavigate("mapa")}>
          ▤ Acompanhar status
        </button>
        <button className="linkBtn" onClick={() => onNavigate("home")}>
          Voltar para o início
        </button>
      </div>
    </>
  );
}

function SummaryRow({ label, value, valueNode, bold, last }) {
  return (
    <div className={`summaryRow ${last ? "summaryRow--last" : ""}`}>
      <span className="summaryLabel">{label}</span>
      {valueNode || <span className={`summaryValue ${bold ? "summaryValue--bold" : ""}`}>{value}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// SCREEN 5 — PERFIL DO USUÁRIO
// ---------------------------------------------------------------------
function ProfileScreen({ onNavigate, user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifAtualizacoes, setNotifAtualizacoes] = useState(true);
  const [totalRegistradas, setTotalRegistradas] = useState(0);
  const [totalResolvidas, setTotalResolvidas] = useState(0);

  useEffect(() => {
    async function carregar() {
      setLoading(true);

      let { data: prof, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof && !error) {
        const meta = user.user_metadata || {};
        const { data: novoProf } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            nome: meta.nome || user.email.split("@")[0],
            cidade: meta.cidade || "",
            bairro: meta.bairro || "",
          })
          .select()
          .single();
        prof = novoProf;
      }

      setProfile(prof);

      const { data: ocs } = await supabase
        .from("ocorrencias")
        .select("status")
        .eq("user_id", user.id);

      if (ocs) {
        setTotalRegistradas(ocs.length);
        setTotalResolvidas(ocs.filter((o) => o.status === "resolvida").length);
      }

      setLoading(false);
    }
    carregar();
  }, [user.id]);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2200);
  }

  function startEdit(field) {
    setEditingField(field);
    setDraft(profile?.[field] || "");
  }

  async function saveEdit(field) {
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: draft })
      .eq("id", user.id);

    if (error) {
      showToast("Erro ao salvar: " + error.message);
    } else {
      setProfile((p) => ({ ...p, [field]: draft }));
      showToast("Dado atualizado com sucesso.");
    }
    setEditingField(null);
  }

  function cancelEdit() {
    setEditingField(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    showToast("Sessão encerrada.");
    setTimeout(() => onNavigate("home"), 500);
  }

  if (loading) {
    return (
      <>
        <div className="bodySection">Carregando perfil...</div>
        <BottomNav active="perfil" onNavigate={(k) => onNavigate(k)} />
      </>
    );
  }

  const nomeExibido = profile?.nome || user.email;
  const initials = nomeExibido
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="profileHeader">
        <div className="profileAvatar">{initials}</div>
        <div>
          <div className="profileHeaderName">{nomeExibido}</div>
          <div className="profileHeaderMeta">{profile?.bairro || "Bairro não informado"}</div>
        </div>
      </div>

      <div className="profileStatsRow">
        <div className="profileStatBox">
          <div className="profileStatValue">{totalRegistradas}</div>
          <div className="profileStatLabel">Registradas</div>
        </div>
        <div className="profileStatBox">
          <div className="profileStatValue">{totalResolvidas}</div>
          <div className="profileStatLabel">Resolvidas</div>
        </div>
        <div className="profileStatBox">
          <div className="profileStatValue">{totalRegistradas * 10}</div>
          <div className="profileStatLabel">Pontos cívicos</div>
        </div>
      </div>

      <div className="bodySection bodySection--withTabBar" style={{ paddingTop: 0 }}>
        <div className="profileSectionLabel">Dados pessoais</div>
        <div className="profileGroup">
          <ProfileField
            icon="◐"
            label="Nome completo"
            field="nome"
            value={profile?.nome || "Adicionar nome"}
            editing={editingField === "nome"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
          <div className="profileRow" style={{ cursor: "default" }}>
            <div className="profileRowIcon">✉</div>
            <div className="profileRowBody">
              <div className="profileRowLabel">E-mail</div>
              <div className="profileRowValue">{user.email}</div>
            </div>
          </div>
          <ProfileField
            icon="☏"
            label="Telefone"
            field="telefone"
            value={profile?.telefone || "Adicionar telefone"}
            editing={editingField === "telefone"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
          <ProfileField
            icon="⌂"
            label="Endereço"
            field="endereco"
            value={profile?.endereco || "Adicionar endereço"}
            editing={editingField === "endereco"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
          <ProfileField
            icon="📍"
            label="Bairro"
            field="bairro"
            value={profile?.bairro || "Adicionar bairro"}
            editing={editingField === "bairro"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
        </div>

        <div className="profileSectionLabel">Notificações</div>
        <div className="profileGroup">
          <ProfileToggle
            label="Notificações push"
            desc="Avisos sobre o status das suas ocorrências"
            checked={notifPush}
            onToggle={() => setNotifPush((v) => !v)}
          />
          <ProfileToggle
            label="Notificações por e-mail"
            desc="Receba um resumo semanal por e-mail"
            checked={notifEmail}
            onToggle={() => setNotifEmail((v) => !v)}
          />
          <ProfileToggle
            label="Atualizações da cidade"
            desc="Novidades e alertas do seu bairro"
            checked={notifAtualizacoes}
            onToggle={() => setNotifAtualizacoes((v) => !v)}
          />
        </div>

        <div className="profileSectionLabel">Conta</div>
        <div className="profileGroup">
          <button className="profileRow" onClick={() => showToast("Em breve: tela de alteração de senha.")}>
            <div className="profileRowIcon">⚿</div>
            <div className="profileRowBody"><div className="profileRowValue">Alterar senha</div></div>
            <div className="profileRowChevron">›</div>
          </button>
          <button className="profileRow" onClick={() => showToast("Em breve: privacidade e segurança.")}>
            <div className="profileRowIcon">⚷</div>
            <div className="profileRowBody"><div className="profileRowValue">Privacidade e segurança</div></div>
            <div className="profileRowChevron">›</div>
          </button>
          <button className="profileRow" onClick={() => showToast("Em breve: central de ajuda.")}>
            <div className="profileRowIcon">?</div>
            <div className="profileRowBody"><div className="profileRowValue">Ajuda e suporte</div></div>
            <div className="profileRowChevron">›</div>
          </button>
          <button className="profileRow" onClick={() => showToast("UrbanFlow AI — versão 1.0.0.")}>
            <div className="profileRowIcon">ℹ</div>
            <div className="profileRowBody"><div className="profileRowValue">Sobre o app</div></div>
            <div className="profileRowChevron">›</div>
          </button>
        </div>

        <div className="profileGroup" style={{ marginTop: 14 }}>
          <button className="profileRow profileRowDanger" onClick={handleLogout}>
            <div className="profileRowIcon">⏻</div>
            <div className="profileRowBody"><div className="profileRowValue">Sair</div></div>
          </button>
        </div>

        {toast && <div className="profileSavedToast">{toast}</div>}
      </div>

      <BottomNav active="perfil" onNavigate={(k) => onNavigate(k)} />
    </>
  );
}

function ProfileField({ icon, label, field, value, editing, draft, onDraftChange, onStart, onSave, onCancel, type = "text" }) {
  if (editing) {
    return (
      <div className="profileRow" style={{ cursor: "default" }}>
        <div className="profileRowIcon">{icon}</div>
        <div className="profileRowBody">
          <div className="profileRowLabel">{label}</div>
          <input
            className="profileRowInput"
            type={type}
            value={draft}
            autoFocus
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(field);
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
        <button
          onClick={() => onSave(field)}
          className="profileRowChevron"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
          aria-label="Salvar"
        >
          ✓
        </button>
      </div>
    );
  }
  return (
    <button className="profileRow" onClick={() => onStart(field)}>
      <div className="profileRowIcon">{icon}</div>
      <div className="profileRowBody">
        <div className="profileRowLabel">{label}</div>
        <div className="profileRowValue">{value}</div>
      </div>
      <div className="profileRowChevron">✎</div>
    </button>
  );
}

function ProfileToggle({ label, desc, checked, onToggle }) {
  return (
    <button className="profileToggleRow" onClick={onToggle}>
      <div className="profileToggleBody">
        <div className="profileToggleLabel">{label}</div>
        <div className="profileToggleDesc">{desc}</div>
      </div>
      <div className={`switchTrack ${checked ? "on" : ""}`}>
        <div className="switchThumb" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------
// APP ROOT
// ---------------------------------------------------------------------
export default function UrbanFlowAIApp() {
  const [screen, setScreen] = useState("home");
  const [registro, setRegistro] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function handleSubmitOcorrencia(data) {
    setRegistro(data);
    setScreen("confirmacao");
  }

  function handleNavigate(nextScreen, payload) {
    if (nextScreen === "confirmacao" && payload) {
      setRegistro(payload);
    }
    setScreen(nextScreen);
  }

  if (!authChecked) {
    return <div className="appWrapper">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="appWrapper">
        <PhoneFrame>
          <AuthScreen onAuthSuccess={setUser} />
        </PhoneFrame>
      </div>
    );
  }

  return (
    <div className="appWrapper">
      <PhoneFrame>
        {screen === "home" && <HomeScreen onNavigate={handleNavigate} />}
        {screen === "registrar" && (
          <RegistrarScreen onNavigate={handleNavigate} onSubmit={handleSubmitOcorrencia} user={user} />
        )}
        {screen === "mapa" && <MapaScreen onNavigate={handleNavigate} />}
        {screen === "ocorrencias" && (
          <MinhasOcorrenciasScreen onNavigate={handleNavigate} user={user} />
        )}
        {screen === "perfil" && <ProfileScreen onNavigate={handleNavigate} user={user} />}
        {screen === "confirmacao" && (
          <ConfirmacaoScreen registro={registro} onNavigate={handleNavigate} />
        )}
      </PhoneFrame>
    </div>
  );
}