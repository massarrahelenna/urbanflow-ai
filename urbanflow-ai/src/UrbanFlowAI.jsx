import React, { useState, useMemo, useRef } from "react";
import "./App.css";

/* ====================================================================
   UrbanFlow AI — Protótipo funcional (React, mobile-first)
   ------------------------------------------------------------------
   Versão com className + App.css (em vez de inline styles).
   Cores que dependem de DADO (tipo de problema, criticidade, pins do
   mapa) continuam inline, pois não dá para "fixar" no CSS — elas
   variam por ocorrência. Tudo o que é layout/estrutura fixa está
   em App.css.
   ==================================================================== */

const NAVY = "#0B1F3F";
const ORANGE = "#F2641A";

const CRITICALITY_COLOR = {
  baixa: { bg: "#E6F6EA", fg: "#16A34A" },
  media: { bg: "#FEF3E0", fg: "#D97706" },
  alta: { bg: "#FCE8E6", fg: "#DC2626" },
};

const TYPE_META = {
  buraco: { label: "Buraco", icon: "⚠", color: "#D4500F" },
  semaforo: { label: "Semáforo defeituoso", icon: "⛟", color: "#D97706" },
  alagamento: { label: "Alagamento", icon: "≈", color: "#2563EB" },
  calcada: { label: "Calçada danificada", icon: "▦", color: "#15803D" },
  iluminacao: { label: "Iluminação pública", icon: "✦", color: "#7C3AED" },
  lixo: { label: "Lixo acumulado", icon: "✦", color: "#92400E" },
};

// ---------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------
const MOCK_STATS = {
  buracos: 128,
  semaforos: 32,
  alagamentos: 18,
  calcadas: 46,
};

const MOCK_OCORRENCIAS = [
  {
    id: "UF-1018", tipo: "buraco", titulo: "Buraco na via", bairro: "Centro",
    criticidade: "alta", data: "16/05/2025", hora: "09:12", distancia: "120 m",
    lat: 38, lng: 46, foto: true,
    descricao: "Buraco grande na pista, próximo ao cruzamento.",
  },
  {
    id: "UF-1019", tipo: "semaforo", titulo: "Semáforo apagado", bairro: "Jardim América",
    criticidade: "media", data: "16/05/2025", hora: "08:40", distancia: "340 m",
    lat: 22, lng: 70, foto: false,
    descricao: "Semáforo do cruzamento principal está apagado desde ontem.",
  },
  {
    id: "UF-1020", tipo: "alagamento", titulo: "Alagamento recorrente", bairro: "Vila Nova",
    criticidade: "alta", data: "16/05/2025", hora: "07:55", distancia: "510 m",
    lat: 64, lng: 56, foto: true,
    descricao: "Acúmulo de água após chuva, dificulta passagem de pedestres.",
  },
  {
    id: "UF-1021", tipo: "calcada", titulo: "Calçada quebrada", bairro: "Viv Centro",
    criticidade: "baixa", data: "15/05/2025", hora: "17:30", distancia: "180 m",
    lat: 30, lng: 30, foto: false,
    descricao: "Trecho da calçada com piso solto, risco de queda.",
  },
  {
    id: "UF-1022", tipo: "semaforo", titulo: "Semáforo intermitente", bairro: "Cambuí",
    criticidade: "media", data: "15/05/2025", hora: "15:10", distancia: "620 m",
    lat: 75, lng: 38, foto: false,
    descricao: "Semáforo fica em modo amarelo intermitente o dia todo.",
  },
];

const BAIRROS = ["Todos", "Centro", "Jardim América", "Vila Nova", "Viv Centro", "Cambuí", "Santa Cecília"];
const TIPOS = ["Todos", ...Object.values(TYPE_META).map((t) => t.label)];
const GRAVIDADES = ["Todas", "Baixa", "Média", "Alta"];

// ---------------------------------------------------------------------
// AI MOCK
// ---------------------------------------------------------------------
function aiAnalyze({ tipo, descricao, temFoto }) {
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

  const duplicatas = MOCK_OCORRENCIAS.filter(
    (o) => o.tipo === tipoDetectado && parseInt(o.distancia) < 150
  );

  const resumo = `Ocorrência classificada como "${TYPE_META[tipoDetectado]?.label || tipoDetectado}", criticidade ${criticidade}. ${
    descricao ? `Relato do cidadão: "${descricao.slice(0, 120)}${descricao.length > 120 ? "…" : ""}".` : "Sem descrição adicional."
  } ${duplicatas.length > 0 ? `Atenção: ${duplicatas.length} ocorrência(s) semelhante(s) já registrada(s) nas proximidades.` : "Nenhuma duplicata identificada nas proximidades."} Recomenda-se encaminhamento ao órgão responsável para vistoria.`;

  return { tipoDetectado, criticidade, duplicatas, resumo };
}

function generateProtocol() {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `#UF-${n}`;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------
// SHARED UI COMPONENTS
// ---------------------------------------------------------------------
function PhoneFrame({ children }) {
  return (
    <div className="phoneFrame">
      <div className="notch" />
      <div className="statusBar">
        <span>9:41</span>
        <span className="statusBarIcons">
          <span>•••</span>
          <span>📶</span>
          <span>🔋</span>
        </span>
      </div>
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
    { key: "home", label: "Início", icon: "⌂" },
    { key: "mapa", label: "Mapa", icon: "📍" },
    { key: "ocorrencias", label: "Ocorrências", icon: "▤" },
    { key: "perfil", label: "Perfil", icon: "◐" },
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

// ---------------------------------------------------------------------
// MINI MAP (SVG mockado)
// ---------------------------------------------------------------------
function MiniMap({ pins = [], onPinClick, selectedId, height = 230, showUserDot = true }) {
  return (
    <div className="mapBox" style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect width="100" height="100" fill="#EAEDF1" />
        {[15, 35, 55, 75].map((y) => (
          <line key={"h" + y} x1="0" y1={y} x2="100" y2={y} stroke="#D7DCE3" strokeWidth="0.6" />
        ))}
        {[20, 45, 70].map((x) => (
          <line key={"v" + x} x1={x} y1="0" x2={x} y2="100" stroke="#D7DCE3" strokeWidth="0.6" />
        ))}
        <path d="M0,60 Q40,40 100,55" stroke="#C3D6EE" strokeWidth="3" fill="none" />
        {showUserDot && <circle cx="50" cy="48" r="2.4" fill={ORANGE} stroke="white" strokeWidth="1" />}
      </svg>
      {pins.map((p) => {
        const meta = TYPE_META[p.tipo];
        const isSel = selectedId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onPinClick && onPinClick(p)}
            className="mapPin"
            style={{
              left: `${p.lng}%`,
              top: `${p.lat}%`,
              background: meta.color,
              transform: `translate(-50%, -100%) scale(${isSel ? 1.25 : 1})`,
              boxShadow: isSel ? `0 0 0 4px ${meta.color}33` : "none",
            }}
            aria-label={meta.label}
            title={meta.label}
          >
            {meta.icon}
          </button>
        );
      })}
      <div className="mapControls">
        <div className="mapCtrlBtn">⊕</div>
        <div className="mapCtrlBtn">▣</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// SCREEN 1 — HOME
// ---------------------------------------------------------------------
function HomeScreen({ onNavigate }) {
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
          <span className="sectionHeaderMuted">Hoje ▾</span>
        </div>

        <div className="statGrid">
          <StatCard icon="⚠" value={MOCK_STATS.buracos} label="Buracos" sublabel="reportados hoje" color={ORANGE} />
          <StatCard icon="⛟" value={MOCK_STATS.semaforos} label="Semáforos" sublabel="com problema" color="#D97706" />
          <StatCard icon="≈" value={MOCK_STATS.alagamentos} label="Alagamentos" sublabel="registrados hoje" color="#2563EB" />
          <StatCard icon="▦" value={MOCK_STATS.calcadas} label="Calçadas" sublabel="danificadas" color="#15803D" />
        </div>
      </div>

      <BottomNav active="home" onNavigate={(k) => (k === "home" ? null : onNavigate(k === "ocorrencias" ? "mapa" : k))} />
    </>
  );
}

// ---------------------------------------------------------------------
// SCREEN 2 — REGISTRAR OCORRÊNCIA
// ---------------------------------------------------------------------
function RegistrarScreen({ onNavigate, onSubmit }) {
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
  const [foto, setFoto] = useState(false);
  const fileInputRef = useRef(null);

  const today = "16/05/2025";
  const now = "09:41";

  const tipoLabel = tipos.find((t) => t.key === tipo)?.label;

  function handleSubmit() {
    if (!tipo) {
      setTipoOpen(true);
      return;
    }
    const analysis = aiAnalyze({ tipo, descricao, temFoto: foto });
    onSubmit({ tipo, descricao, recorrencia, foto, data: today, hora: now, analysis });
  }

  return (
    <>
      <TopBar title="Registrar ocorrência" onBack={() => onNavigate("home")} />
      <div className="bodySection bodySection--withTabBar">
        <Field label="Geolocalização exata">
          <MiniMap pins={[]} height={140} />
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
            onChange={() => setFoto(true)}
          />
          <button className="uploadBox" onClick={() => fileInputRef.current?.click()}>
            <div className="uploadIcon">{foto ? "✅" : "📷"}</div>
            <div className="uploadTextWrap">
              <div className="uploadTitle">{foto ? "Imagem adicionada" : "Enviar foto/vídeo"}</div>
              <div className="uploadSubtitle">
                {foto ? "A IA vai analisar o conteúdo enviado" : "Adicione uma imagem ou vídeo para ajudar na análise"}
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

        <button className="primaryBtnFull" onClick={handleSubmit}>
          ➤ Enviar ocorrência
        </button>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      {label && <div className="fieldLabel">{label}</div>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
// SCREEN 3 — MAPA DE OCORRÊNCIAS
// ---------------------------------------------------------------------
function MapaScreen({ onNavigate }) {
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroGravidade, setFiltroGravidade] = useState("Todas");
  const [filtroBairro, setFiltroBairro] = useState("Todos");
  const [selected, setSelected] = useState(MOCK_OCORRENCIAS[0]);

  const filtered = useMemo(() => {
    return MOCK_OCORRENCIAS.filter((o) => {
      const tipoOk = filtroTipo === "Todos" || TYPE_META[o.tipo].label === filtroTipo;
      const gravOk =
        filtroGravidade === "Todas" ||
        o.criticidade === filtroGravidade.toLowerCase().replace("é", "e");
      const bairroOk = filtroBairro === "Todos" || o.bairro === filtroBairro;
      return tipoOk && gravOk && bairroOk;
    });
  }, [filtroTipo, filtroGravidade, filtroBairro]);

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

      <MiniMap pins={filtered} onPinClick={setSelected} selectedId={selected?.id} height={260} />

      {selected && (
        <div className="occCard">
          <div className="occCardPhoto">{selected.foto ? "🖼" : "—"}</div>
          <div style={{ flex: 1 }}>
            <div className="occCardHeader">
              <span className="occCardTitle">{selected.titulo}</span>
              <span className="occCardChevron">›</span>
            </div>
            <div className="occCardBairro">Bairro: {selected.bairro}</div>
            <div className="occCardCritRow">
              <span className="occCardCritLabel">Criticidade:</span>
              <Pill tone={selected.criticidade}>{cap(selected.criticidade)}</Pill>
            </div>
            <div className="occCardMeta">
              {selected.data} • {selected.hora} &nbsp;&nbsp;📍 {selected.distancia}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="mapa" onNavigate={(k) => onNavigate(k === "ocorrencias" ? "mapa" : k)} />
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

  const { protocolo, analysis, data, hora } = registro;
  const crit = analysis.criticidade;

  const steps = [
    { key: "registrada", label: "Registrada", done: true, desc: "Ocorrência recebida com sucesso.", time: `${data} • ${hora}` },
    { key: "classificada", label: "Classificada", done: false, current: true, desc: "Em análise pela equipe técnica." },
    { key: "encaminhada", label: "Encaminhada", done: false, desc: "Será encaminhada ao órgão responsável." },
    { key: "resolvida", label: "Resolvida", done: false, desc: "Aguardando resolução do problema." },
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
const MOCK_USER = {
  nome: "Marina Souza",
  email: "marina.souza@email.com",
  telefone: "(62) 99876-5432",
  endereco: "Rua das Acácias, 245 — Centro",
  bairro: "Centro",
};

function ProfileScreen({ onNavigate }) {
  const [user, setUser] = useState(MOCK_USER);
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifAtualizacoes, setNotifAtualizacoes] = useState(true);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2200);
  }

  function startEdit(field) {
    setEditingField(field);
    setDraft(user[field]);
  }

  function saveEdit(field) {
    setUser((u) => ({ ...u, [field]: draft }));
    setEditingField(null);
    showToast("Dado atualizado com sucesso.");
  }

  function cancelEdit() {
    setEditingField(null);
  }

  const initials = user.nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ocorrenciasDoUsuario = MOCK_OCORRENCIAS.length;
  const resolvidas = 4;

  return (
    <>
      <div className="profileHeader">
        <div className="profileAvatar">{initials}</div>
        <div>
          <div className="profileHeaderName">{user.nome}</div>
          <div className="profileHeaderMeta">{user.bairro} • membro desde 2024</div>
        </div>
      </div>

      <div className="profileStatsRow">
        <div className="profileStatBox">
          <div className="profileStatValue">{ocorrenciasDoUsuario}</div>
          <div className="profileStatLabel">Registradas</div>
        </div>
        <div className="profileStatBox">
          <div className="profileStatValue">{resolvidas}</div>
          <div className="profileStatLabel">Resolvidas</div>
        </div>
        <div className="profileStatBox">
          <div className="profileStatValue">128</div>
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
            value={user.nome}
            editing={editingField === "nome"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
          <ProfileField
            icon="✉"
            label="E-mail"
            field="email"
            value={user.email}
            editing={editingField === "email"}
            draft={draft}
            onDraftChange={setDraft}
            onStart={startEdit}
            onSave={saveEdit}
            onCancel={cancelEdit}
            type="email"
          />
          <ProfileField
            icon="☏"
            label="Telefone"
            field="telefone"
            value={user.telefone}
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
            value={user.endereco}
            editing={editingField === "endereco"}
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
          <button
            className="profileRow"
            onClick={() => showToast("Em breve: tela de alteração de senha.")}
          >
            <div className="profileRowIcon">⚿</div>
            <div className="profileRowBody">
              <div className="profileRowValue">Alterar senha</div>
            </div>
            <div className="profileRowChevron">›</div>
          </button>
          <button
            className="profileRow"
            onClick={() => showToast("Em breve: privacidade e segurança.")}
          >
            <div className="profileRowIcon">⚷</div>
            <div className="profileRowBody">
              <div className="profileRowValue">Privacidade e segurança</div>
            </div>
            <div className="profileRowChevron">›</div>
          </button>
          <button
            className="profileRow"
            onClick={() => showToast("Em breve: central de ajuda.")}
          >
            <div className="profileRowIcon">?</div>
            <div className="profileRowBody">
              <div className="profileRowValue">Ajuda e suporte</div>
            </div>
            <div className="profileRowChevron">›</div>
          </button>
          <button
            className="profileRow"
            onClick={() => showToast("UrbanFlow AI — versão 1.0.0 (protótipo).")}
          >
            <div className="profileRowIcon">ℹ</div>
            <div className="profileRowBody">
              <div className="profileRowValue">Sobre o app</div>
            </div>
            <div className="profileRowChevron">›</div>
          </button>
        </div>

        <div className="profileGroup" style={{ marginTop: 14 }}>
          <button
            className="profileRow profileRowDanger"
            onClick={() => {
              showToast("Sessão encerrada.");
              setTimeout(() => onNavigate("home"), 700);
            }}
          >
            <div className="profileRowIcon">⏻</div>
            <div className="profileRowBody">
              <div className="profileRowValue">Sair</div>
            </div>
          </button>
        </div>

        {toast && <div className="profileSavedToast">{toast}</div>}
      </div>

      <BottomNav active="perfil" onNavigate={(k) => onNavigate(k === "ocorrencias" ? "mapa" : k)} />
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

  function handleSubmitOcorrencia(data) {
    const protocolo = generateProtocol();
    setRegistro({ ...data, protocolo });
    setScreen("confirmacao");
  }

  return (
    <div className="appWrapper">
      <PhoneFrame>
        {screen === "home" && <HomeScreen onNavigate={setScreen} />}
        {screen === "registrar" && (
          <RegistrarScreen onNavigate={setScreen} onSubmit={handleSubmitOcorrencia} />
        )}
        {screen === "mapa" && <MapaScreen onNavigate={setScreen} />}
        {screen === "perfil" && <ProfileScreen onNavigate={setScreen} />}
        {screen === "confirmacao" && (
          <ConfirmacaoScreen registro={registro} onNavigate={setScreen} />
        )}
      </PhoneFrame>
    </div>
  );
}
