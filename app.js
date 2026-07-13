// =====================================================================
// Estudo Bíblico para Mulheres — app.js
// Site independente (fora do Claude), usando Supabase para
// autenticação (nome + senha) e armazenamento (pessoal e compartilhado).
// =====================================================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const appEl = document.getElementById("app");

const state = {
  user: null,
  displayName: "",
  authMode: "login", // "login" | "signup"
  authError: "",
  authLoading: false,

  view: "home", // "home" | "diary" | "mural"
  bookId: "proverbios",
  day: 1,
  data: { ...EMPTY_DAY },
  completed: {},
  loading: false,
  saveState: "idle", // idle | saving | saved | error
  showNav: false,

  mural: {
    tab: "semana",
    loading: false,
    announcement: "",
    editingAnnouncement: false,
    announcementDraft: "",
    comments: [],
    prayers: [],
    testimonies: [],
    worship: [],
    prayerTopics: PRAYER_TOPICS.map((t, i) => ({ ...t, id: i })),
    expandedTopic: null,
    editingTopic: null,
    topicDraft: "",
    commentName: "",
    commentText: "",
    prayerText: "",
    testimonyText: "",
    worshipText: "",
    weekBookId: "proverbios",
    weekStart: 1,
  },
};

let saveTimer = null;

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fakeEmail(name) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${slug || "usuaria"}@estudobiblico.local`;
}

function currentBook() {
  return BOOKS.find((b) => b.id === state.bookId) || BOOKS[0];
}
function currentGuides() {
  return GUIDES_BY_BOOK[state.bookId] || {};
}
function currentStories() {
  return STORIES_BY_BOOK[state.bookId] || {};
}

function placeholderFor(key) {
  const map = {
    resumo: "Em poucas linhas, do que trata este capítulo…",
    ensinou: "O que chamou sua atenção hoje na leitura…",
    familia: "Uma atitude prática com seus filhos ou em casa…",
    maternidade: "Como esse princípio te ajuda a viver a maternidade hoje…",
    negocios: "Um princípio para aplicar no seu trabalho esta semana…",
    casamento: "Como isso fala ao seu relacionamento…",
    oracao: "Escreva sua oração de hoje…",
    versiculo: "Ex: Provérbios 3:5-6",
    desafio: "Uma ação concreta para colocar em prática hoje…",
  };
  return map[key] || "";
}

// =====================================================================
// AUTENTICAÇÃO
// =====================================================================

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    state.user = session.user;
    state.displayName = session.user.user_metadata?.display_name || "";
    state.mural.commentName = state.displayName;
  }
  render();
}

function translateAuthError(error) {
  const msg = (error && error.message) || "";
  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "Esse nome já está cadastrado. Tente entrar em vez de criar uma nova conta.";
  }
  if (msg.includes("Password should be")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (msg.includes("Invalid login")) {
    return "Nome ou senha incorretos.";
  }
  return "Algo deu errado. Tente novamente em instantes.";
}

async function handleAuthSubmit(mode, name, password, passwordConfirm) {
  if (!name.trim() || !password.trim()) {
    state.authError = "Preencha nome e senha.";
    renderAuth();
    return;
  }
  if (mode === "signup" && password !== passwordConfirm) {
    state.authError = "As senhas não coincidem.";
    renderAuth();
    return;
  }
  state.authLoading = true;
  state.authError = "";
  renderAuth();

  const email = fakeEmail(name);

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    state.authLoading = false;
    if (error) {
      state.authError = translateAuthError(error);
      renderAuth();
      return;
    }
    if (data.session) {
      state.user = data.user;
      state.displayName = name.trim();
      state.mural.commentName = name.trim();
      render();
    } else {
      // Email confirmation might still be on — guide the person
      state.authError = "Conta criada! Tente entrar agora com o mesmo nome e senha.";
      state.authMode = "login";
      renderAuth();
    }
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    state.authLoading = false;
    if (error) {
      state.authError = translateAuthError(error);
      renderAuth();
      return;
    }
    state.user = data.user;
    state.displayName = data.user.user_metadata?.display_name || name.trim();
    state.mural.commentName = state.displayName;
    render();
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  state.view = "home";
  render();
}

// =====================================================================
// DIÁRIO — carregamento e salvamento pessoal (Supabase)
// =====================================================================

async function loadBookProgress() {
  state.loading = true;
  render();
  const book = currentBook();
  const { data } = await supabase
    .from("daily_entries")
    .select("day, resumo, ensinou, familia, maternidade, negocios, casamento, oracao, versiculo, desafio, nota")
    .eq("user_id", state.user.id)
    .eq("book_id", state.bookId);

  const completed = {};
  if (data) {
    data.forEach((row) => {
      const has =
        FIELDS.some((f) => (row[f.key] || "").trim().length > 0) ||
        (row.nota || 0) > 0;
      completed[row.day] = has;
    });
  }
  state.completed = completed;
  await loadDay(state.day, false);
  state.loading = false;
  render();
}

async function loadDay(day) {
  state.day = day;
  const { data } = await supabase
    .from("daily_entries")
    .select("*")
    .eq("user_id", state.user.id)
    .eq("book_id", state.bookId)
    .eq("day", day)
    .maybeSingle();
  state.data = data ? { ...EMPTY_DAY, ...data } : { ...EMPTY_DAY };
}

async function goToDay(day) {
  state.loading = true;
  render();
  await loadDay(day);
  state.loading = false;
  render();
}

async function selectBook(bookId) {
  state.bookId = bookId;
  state.day = 1;
  await loadBookProgress();
}

function scheduleSave() {
  state.saveState = "saving";
  updateSaveIndicator();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistDay, 600);
}

async function persistDay() {
  const payload = {
    user_id: state.user.id,
    book_id: state.bookId,
    day: state.day,
    ...FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: state.data[f.key] || "" }), {}),
    nota: state.data.nota || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("daily_entries")
    .upsert(payload, { onConflict: "user_id,book_id,day" });

  if (error) {
    state.saveState = "error";
  } else {
    const has =
      FIELDS.some((f) => (state.data[f.key] || "").trim().length > 0) ||
      (state.data.nota || 0) > 0;
    state.completed[state.day] = has;
    state.saveState = "saved";
  }
  updateSaveIndicator();
  updateProgressTrail();
}

function updateSaveIndicator() {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  el.classList.toggle("error", state.saveState === "error");
  if (state.saveState === "saving") el.textContent = "Salvando…";
  else if (state.saveState === "saved") el.textContent = "Salvo automaticamente";
  else if (state.saveState === "error") el.textContent = "Não foi possível salvar — verifique sua conexão";
  else el.textContent = "";
}

function updateProgressTrail() {
  const book = currentBook();
  const doneCount = Object.values(state.completed).filter(Boolean).length;
  const leafRow = document.getElementById("leaf-row");
  if (leafRow) {
    Array.from(leafRow.children).forEach((btn) => {
      const d = Number(btn.dataset.day);
      btn.style.background = state.completed[d] ? "#1F3A5F" : "rgba(232,223,206,0.5)";
      btn.style.color = state.completed[d] ? "#E8DFCE" : "#5B84B1";
    });
  }
}

function updateField(key, value) {
  state.data[key] = value;
  scheduleSave();
}


// =====================================================================
// MURAL DA SEMANA — dados compartilhados (Supabase)
// =====================================================================

async function loadMural() {
  state.mural.loading = true;
  render();

  const [annRes, commRes, prayRes, testRes, worshipRes, topicsRes] = await Promise.all([
    supabase.from("mural_announcement").select("text").eq("id", 1).maybeSingle(),
    supabase.from("mural_comments").select("*").order("created_at", { ascending: true }),
    supabase.from("mural_prayers").select("*").order("created_at", { ascending: true }),
    supabase.from("mural_testimonies").select("*").order("created_at", { ascending: true }),
    supabase.from("mural_worship").select("*").order("created_at", { ascending: true }),
    supabase.from("mural_prayer_topics").select("*").order("id", { ascending: true }),
  ]);

  state.mural.announcement = (annRes.data && annRes.data.text) || "";
  state.mural.announcementDraft = state.mural.announcement;
  state.mural.comments = commRes.data || [];
  state.mural.prayers = prayRes.data || [];
  state.mural.testimonies = testRes.data || [];
  state.mural.worship = worshipRes.data || [];
  if (topicsRes.data && topicsRes.data.length > 0) {
    state.mural.prayerTopics = topicsRes.data;
  }
  state.mural.weekBookId = state.bookId;
  state.mural.weekStart = Math.floor((state.day - 1) / 7) * 7 + 1;

  state.mural.loading = false;
  render();
}

async function saveAnnouncement() {
  await supabase.from("mural_announcement").update({ text: state.mural.announcementDraft, updated_at: new Date().toISOString() }).eq("id", 1);
  state.mural.announcement = state.mural.announcementDraft;
  state.mural.editingAnnouncement = false;
  render();
}

async function postComment() {
  const name = state.mural.commentName.trim();
  const text = state.mural.commentText.trim();
  if (!name || !text) return;
  await supabase.from("mural_comments").insert({ name, text });
  await supabase.auth.updateUser({ data: { display_name: name } }).catch(() => {});
  state.mural.commentText = "";
  await loadMural();
}

async function postPrayer() {
  const name = state.mural.commentName.trim();
  const text = state.mural.prayerText.trim();
  if (!name || !text) return;
  await supabase.from("mural_prayers").insert({ name, text, pray_count: 0 });
  state.mural.prayerText = "";
  await loadMural();
}

async function incrementPray(id) {
  const prayer = state.mural.prayers.find((p) => p.id === id);
  if (!prayer) return;
  await supabase.from("mural_prayers").update({ pray_count: (prayer.pray_count || 0) + 1 }).eq("id", id);
  await loadMural();
}

async function postTestimony() {
  const name = state.mural.commentName.trim();
  const text = state.mural.testimonyText.trim();
  if (!name || !text) return;
  await supabase.from("mural_testimonies").insert({ name, text });
  state.mural.testimonyText = "";
  await loadMural();
}

async function postWorship() {
  const name = state.mural.commentName.trim();
  const text = state.mural.worshipText.trim();
  if (!name || !text) return;
  await supabase.from("mural_worship").insert({ name, text });
  state.mural.worshipText = "";
  await loadMural();
}

async function saveTopicEdit(id) {
  await supabase.from("mural_prayer_topics").update({ prayer: state.mural.topicDraft, updated_at: new Date().toISOString() }).eq("id", id);
  state.mural.editingTopic = null;
  await loadMural();
}


// =====================================================================
// RENDER — despachante principal
// =====================================================================

function render() {
  if (!state.user) {
    renderAuth();
    return;
  }
  if (state.view === "home") renderHome();
  else if (state.view === "mural") renderMural();
  else renderDiary();
}

// ===== AUTH =====
function renderAuth() {
  const isSignup = state.authMode === "signup";
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div style="margin-bottom:10px;">${butterflySvg(40, "#1F3A5F")}</div>
        <h1 class="auth-title">${isSignup ? "Criar minha conta" : "Entrar no Estudo Bíblico"}</h1>
        <p class="auth-subtitle">${isSignup ? "Escolha um nome e uma senha para começar." : "Digite seu nome e senha para continuar."}</p>
        ${state.authError ? `<p class="auth-error">${esc(state.authError)}</p>` : ""}
        <input id="auth-name" class="auth-input" placeholder="Seu nome" autocomplete="username" />
        <input id="auth-password" class="auth-input" type="password" placeholder="Senha" autocomplete="${isSignup ? "new-password" : "current-password"}" />
        ${isSignup ? `<input id="auth-password-confirm" class="auth-input" type="password" placeholder="Confirme a senha" autocomplete="new-password" />` : ""}
        <button id="auth-submit" class="welcome-btn" ${state.authLoading ? "disabled" : ""}>
          ${state.authLoading ? "Aguarde…" : (isSignup ? "Criar conta" : "Entrar")}
        </button>
        <button id="auth-toggle" class="auth-toggle">
          ${isSignup ? "Já tenho conta — entrar" : "Ainda não tenho conta — criar"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("auth-submit").addEventListener("click", () => {
    const name = document.getElementById("auth-name").value;
    const password = document.getElementById("auth-password").value;
    const confirm = isSignup ? document.getElementById("auth-password-confirm").value : "";
    handleAuthSubmit(state.authMode, name, password, confirm);
  });
  document.getElementById("auth-toggle").addEventListener("click", () => {
    state.authMode = isSignup ? "login" : "signup";
    state.authError = "";
    renderAuth();
  });
}

function butterflySvg(size, color) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 50 C50 30, 20 10, 8 20 C-2 28, 10 48, 50 50 Z" fill="${color}" opacity="0.95"/>
    <path d="M50 50 C50 30, 80 10, 92 20 C102 28, 90 48, 50 50 Z" fill="${color}" opacity="0.95"/>
    <path d="M50 50 C50 66, 26 88, 15 82 C6 77, 16 56, 50 50 Z" fill="${color}" opacity="0.8"/>
    <path d="M50 50 C50 66, 74 88, 85 82 C94 77, 84 56, 50 50 Z" fill="${color}" opacity="0.8"/>
    <rect x="47.5" y="30" width="5" height="42" rx="2.5" fill="${color}"/>
    <path d="M50 32 C46 26, 40 24, 37 20" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M50 32 C54 26, 60 24, 63 20" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg>`;
}

// ===== HOME (página inicial: testemunho, fotos, whatsapp) =====
function renderHome() {
  appEl.innerHTML = `
    <div class="home-page">
      <div class="home-inner">
        <div class="home-header">
          ${butterflySvg(40, "#1F3A5F")}
          <p class="home-eyebrow">Plano anual · ${esc(AUTHOR_NAME)}</p>
          <h1 class="home-title">Um plano anual de estudo bíblico para mulheres</h1>
        </div>

        <img src="${AUTHOR_PHOTO_URL}" alt="${esc(AUTHOR_NAME)}" class="author-photo" />

        <div class="testimony-box">
          <p class="welcome-box-title">Um pouco da minha história, por ${esc(AUTHOR_NAME)}</p>
          <div>${AUTHOR_TESTIMONY.split("\n\n").map((p) => `<p class="testimony-paragraph">${esc(p)}</p>`).join("")}</div>
          <div class="author-links-row"><span class="author-link-chip">📷 ${esc(AUTHOR_INSTAGRAM)}</span></div>
        </div>

        <div class="family-photo-wrap">
          <img src="${FAMILY_PHOTO_URL}" alt="Minha família" class="family-photo" />
          <p class="family-photo-caption">Eduardo, Théo, Thalia e eu 🤍</p>
        </div>

        <a href="${WHATSAPP_GROUP_LINK}" target="_blank" rel="noopener noreferrer" class="whatsapp-btn">💬 Entrar no grupo do WhatsApp</a>
        <p class="whatsapp-hint">Vamos caminhar juntas — trocar experiências, direcionamento e comunhão ao longo do ano.</p>

        <div class="welcome-box">
          <p class="welcome-box-title">Como usar este diário</p>
          <p class="welcome-box-text">📖 <strong>Primeiro, leia o capítulo do dia na sua Bíblia.</strong> Depois, volte para esta aba para refletir e preencher suas respostas.</p>
          <p class="welcome-box-text" style="margin-top:10px;">Suas respostas ficam salvas automaticamente na sua conta, e são privadas — só você tem acesso.</p>
        </div>

        <button id="go-diary-btn" class="welcome-btn">Acessar o devocional →</button>
        <button id="logout-btn" class="auth-toggle" style="display:block;margin:16px auto 0;">Sair da conta</button>
      </div>
    </div>
  `;

  document.getElementById("go-diary-btn").addEventListener("click", async () => {
    state.view = "diary";
    await loadBookProgress();
  });
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
}


// ===== DIÁRIO =====
function renderDiary() {
  const book = currentBook();
  const guides = currentGuides();
  const stories = currentStories();
  const doneCount = Object.values(state.completed).filter(Boolean).length;
  const totalDays = book.totalDays;
  const day = state.day;

  const leafButtons = Array.from({ length: totalDays }, (_, i) => i + 1)
    .map((d) => {
      const isDone = state.completed[d];
      const isCurrent = d === day;
      return `<button class="leaf" data-day="${d}" style="background:${isDone ? "#1F3A5F" : "rgba(232,223,206,0.5)"};color:${isDone ? "#E8DFCE" : "#5B84B1"};${isCurrent ? "border:2px solid #E8DFCE;transform:scale(1.18);" : ""}">${d}</button>`;
    })
    .join("");

  const bookPills = BOOKS.map(
    (b) => `<button class="book-pill" data-book="${b.id}" style="background:${b.id === state.bookId ? "#E8DFCE" : "rgba(255,255,255,0.08)"};color:${b.id === state.bookId ? "#1F3A5F" : "#E8DFCE"};border-color:${b.id === state.bookId ? "#E8DFCE" : "rgba(232,223,206,0.35)"};">${esc(b.month)} · ${esc(b.title)}</button>`
  ).join("");

  const guide = guides[day] || {};
  const story = stories[day] || {};

  const applyItems = [
    ["🙏", "Vida com Deus", guide.deus],
    ["🍼", "Maternidade", guide.maternidade],
    ["⛪", "Ministério", guide.ministerio],
    ["💍", "Casamento", guide.casamento],
    ["💼", "Trabalho", guide.trabalho],
  ].map(([icon, label, text]) => `
    <div class="apply-item">
      <p class="apply-item-label">${icon} ${label}</p>
      <p class="apply-item-text">${esc(text || "")}</p>
    </div>
  `).join("");

  const perguntasList = (story.perguntas || []).map((p) => `<li>${esc(p)}</li>`).join("");

  const fieldsHtml = FIELDS.map((f) => `
    <div class="field-block">
      <label class="field-label">${f.icon} ${esc(f.label)}</label>
      <textarea class="textarea" data-field="${f.key}" rows="${f.rows}" placeholder="${esc(placeholderFor(f.key))}">${esc(state.data[f.key] || "")}</textarea>
    </div>
  `).join("");

  const ratingButtons = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `
    <button class="rating-btn ${state.data.nota === n ? "active" : ""}" data-nota="${n}">${n}</button>
  `).join("");

  appEl.innerHTML = `
    <div class="page">
      <header class="header">
        <div class="header-inner">
          <div class="title-row">
            <button id="home-link-btn" class="home-link-btn" title="Sobre a Jaque">${butterflySvg(34, "#E8DFCE")}</button>
            <div>
              <p class="eyebrow">Plano anual · ${esc(book.month)}</p>
              <h1 class="title">Sabedoria para Viver</h1>
              <p class="subtitle">${esc(book.title)} — fé, família e negócios</p>
            </div>
          </div>
          <div class="header-btn-group">
            <button id="mural-nav-btn" class="mural-nav-btn">📌 Mural da Semana</button>
            <button id="nav-toggle-btn" class="nav-toggle">${state.showNav ? "Fechar" : "Ver todos os dias"}</button>
          </div>
        </div>

        <div class="book-selector-wrap">${bookPills}</div>

        <div class="branch-wrap">
          <div class="leaf-row" id="leaf-row">${leafButtons}</div>
        </div>
      </header>

      ${state.showNav ? `<div class="nav-panel"><p class="nav-panel-hint">${doneCount} de ${totalDays} dias com anotações em ${esc(book.title)}. Toque em um número para abrir aquele dia.</p></div>` : ""}

      <main class="main">
        <div class="day-bar">
          <button id="prev-day-btn" class="arrow-btn" ${day === 1 ? "disabled" : ""}>←</button>
          <div class="day-label-wrap">
            <span class="day-eyebrow">Dia ${day} de ${totalDays}</span>
            <h2 class="day-title">${esc(book.dayLabel(day))}</h2>
          </div>
          <button id="next-day-btn" class="arrow-btn" ${day === totalDays ? "disabled" : ""}>→</button>
        </div>

        ${state.loading ? `<p style="text-align:center;color:#9C9284;">Carregando…</p>` : `
        <div class="read-first-banner">📖 Antes de continuar: leia o capítulo de hoje na sua Bíblia. Depois, volte para esta aba.</div>

        <div class="guide-card">
          <p class="guide-label">📖 Resumo do capítulo</p>
          <p class="guide-text">${esc(guide.resumo || "")}</p>

          <p class="guide-label" style="margin-top:16px;">Como aplicar</p>
          <div class="apply-grid">${applyItems}</div>

          <p class="guide-label" style="margin-top:16px;">🙏 Oração guiada</p>
          <p class="guide-text">${esc(guide.oracao || "")}</p>

          <div class="kids-box">
            <p class="kids-label">🧸 Mini devocional infantil</p>
            <p class="kids-text">${esc(guide.infantil || "")}</p>
            <p class="kids-label" style="margin-top:14px;">🦋 Historinha da Zuzu</p>
            <p class="kids-text">${esc(story.historia || "")}</p>
            <p class="kids-label" style="margin-top:14px;">🎲 Perguntas para brincar</p>
            <ul class="kids-list">${perguntasList}</ul>
          </div>
        </div>

        <div class="card">
          ${fieldsHtml}
          <div class="field-block">
            <label class="field-label">⭐ Nota de 1 a 10 — como vivi esse princípio hoje</label>
            <div class="rating-row" id="rating-row">${ratingButtons}</div>
          </div>
          <div class="save-row"><span id="save-indicator" class="save-indicator"></span></div>
        </div>
        `}

        <div class="bottom-nav">
          <button id="bottom-prev-btn" class="btn-secondary" ${day === 1 ? "disabled" : ""}>← Dia ${day > 1 ? day - 1 : ""}</button>
          <button id="bottom-next-btn" class="btn-primary" ${day === totalDays ? "disabled" : ""}>Dia ${day < totalDays ? day + 1 : ""} →</button>
        </div>
      </main>

      <footer class="footer">
        ${butterflySvg(18, "#5B84B1")}
        <p class="footer-verse">${esc(book.verse)}</p>
      </footer>
    </div>
  `;

  bindDiaryEvents();
}

function bindDiaryEvents() {
  document.getElementById("home-link-btn").addEventListener("click", () => { state.view = "home"; render(); });
  document.getElementById("mural-nav-btn").addEventListener("click", async () => { state.view = "mural"; await loadMural(); });
  document.getElementById("nav-toggle-btn").addEventListener("click", () => { state.showNav = !state.showNav; render(); });

  document.querySelectorAll(".book-pill").forEach((btn) => {
    btn.addEventListener("click", () => selectBook(btn.dataset.book));
  });
  document.querySelectorAll(".leaf").forEach((btn) => {
    btn.addEventListener("click", () => goToDay(Number(btn.dataset.day)));
  });

  const prevBtn = document.getElementById("prev-day-btn");
  const nextBtn = document.getElementById("next-day-btn");
  const bottomPrev = document.getElementById("bottom-prev-btn");
  const bottomNext = document.getElementById("bottom-next-btn");
  const book = currentBook();
  if (prevBtn) prevBtn.addEventListener("click", () => { if (state.day > 1) goToDay(state.day - 1); });
  if (nextBtn) nextBtn.addEventListener("click", () => { if (state.day < book.totalDays) goToDay(state.day + 1); });
  if (bottomPrev) bottomPrev.addEventListener("click", () => { if (state.day > 1) goToDay(state.day - 1); });
  if (bottomNext) bottomNext.addEventListener("click", () => { if (state.day < book.totalDays) goToDay(state.day + 1); });

  document.querySelectorAll("textarea[data-field]").forEach((ta) => {
    ta.addEventListener("input", (e) => updateField(ta.dataset.field, e.target.value));
  });

  document.querySelectorAll(".rating-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.data.nota = Number(btn.dataset.nota);
      document.querySelectorAll(".rating-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      scheduleSave();
    });
  });
}


// ===== MURAL =====
function renderMural() {
  const m = state.mural;

  if (m.loading) {
    appEl.innerHTML = `
      <div class="page">
        <header class="header"><div class="header-inner"><h1 class="title">Mural da Semana</h1></div></header>
        <main class="main"><p style="text-align:center;color:#9C9284;">Carregando…</p></main>
      </div>
    `;
    return;
  }

  const weekBook = BOOKS.find((b) => b.id === m.weekBookId) || BOOKS[0];
  const weekGuides = GUIDES_BY_BOOK[m.weekBookId] || {};
  const weekEnd = Math.min(m.weekStart + 6, weekBook.totalDays);
  const weekDays = [];
  for (let d = m.weekStart; d <= weekEnd; d++) weekDays.push(d);
  const totalWeeks = Math.ceil(weekBook.totalDays / 7);
  const weekNumber = Math.floor((m.weekStart - 1) / 7) + 1;

  const tabs = [
    { id: "semana", label: "📖 Princípios" },
    { id: "comentarios", label: "💬 Comentários" },
    { id: "oracoes", label: "🙏 Orações" },
    { id: "testemunhos", label: "✨ Testemunhos" },
    { id: "louvores", label: "🎵 Louvores" },
    { id: "porArea", label: "📂 Orações por Área" },
  ];
  const tabsHtml = tabs.map((t) => `<button class="mural-tab-btn ${m.tab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("");

  let tabContent = "";
  if (m.tab === "semana") {
    const bookPills = BOOKS.map((b) => `<button class="week-book-pill ${b.id === m.weekBookId ? "active" : ""}" data-weekbook="${b.id}">${esc(b.month)}</button>`).join("");
    const daysHtml = weekDays.map((d) => `
      <div class="week-day-item">
        <p class="week-day-title">${esc(weekBook.dayLabel(d))}</p>
        <p class="week-day-text">${esc((weekGuides[d] && weekGuides[d].resumo) || "")}</p>
        ${weekGuides[d] && weekGuides[d].deus ? `<p class="week-day-principle">✨ Para aplicar: ${esc(weekGuides[d].deus)}</p>` : ""}
      </div>
    `).join("");
    tabContent = `
      <div class="guide-card">
        <p class="guide-label">📖 Princípios da Semana — o que podemos aplicar</p>
        <div class="week-book-selector-wrap">${bookPills}</div>
        <div class="week-nav-row">
          <button id="week-prev-btn" class="arrow-btn" ${m.weekStart <= 1 ? "disabled" : ""}>←</button>
          <span class="week-label">Semana ${weekNumber} de ${totalWeeks} · dias ${m.weekStart}–${weekEnd}</span>
          <button id="week-next-btn" class="arrow-btn" ${weekEnd >= weekBook.totalDays ? "disabled" : ""}>→</button>
        </div>
        ${daysHtml}
      </div>
    `;
  } else if (m.tab === "comentarios") {
    const list = m.comments.length === 0
      ? `<p class="guide-text">Ainda não há comentários. Seja a primeira a compartilhar!</p>`
      : `<div class="comments-list">${m.comments.slice().reverse().map((c) => `<div class="comment-item"><p class="comment-author">${esc(c.name)}</p><p class="comment-text">${esc(c.text)}</p></div>`).join("")}</div>`;
    tabContent = `
      <div class="card">
        <p class="field-label">💬 Comentários das meninas</p>
        ${list}
        <div class="comment-form">
          <input id="comment-name-input" class="comment-name-input" placeholder="Seu nome" value="${esc(m.commentName)}" />
          <textarea id="comment-text-input" class="textarea" style="min-height:70px;" placeholder="Compartilhe algo com o grupo...">${esc(m.commentText)}</textarea>
          <button id="post-comment-btn" class="btn-primary" style="width:100%;margin-top:10px;">Publicar comentário</button>
        </div>
      </div>
    `;
  } else if (m.tab === "oracoes") {
    const list = m.prayers.length === 0
      ? `<p class="guide-text">Ainda não há pedidos de oração. Compartilhe o seu!</p>`
      : `<div class="comments-list">${m.prayers.slice().reverse().map((p) => `
          <div class="comment-item">
            <p class="comment-author">${esc(p.name)}</p>
            <p class="comment-text">${esc(p.text)}</p>
            <button class="pray-btn" data-prayid="${p.id}">🙏 Orei por isso (${p.pray_count || 0})</button>
          </div>`).join("")}</div>`;
    tabContent = `
      <div class="card">
        <p class="field-label">🙏 Pedidos de oração do grupo</p>
        ${list}
        <div class="comment-form">
          <input id="comment-name-input" class="comment-name-input" placeholder="Seu nome" value="${esc(m.commentName)}" />
          <textarea id="prayer-text-input" class="textarea" style="min-height:70px;" placeholder="Compartilhe seu pedido de oração...">${esc(m.prayerText)}</textarea>
          <button id="post-prayer-btn" class="btn-primary" style="width:100%;margin-top:10px;">Publicar pedido</button>
        </div>
      </div>
    `;
  } else if (m.tab === "testemunhos") {
    const list = m.testimonies.length === 0
      ? `<p class="guide-text">Ainda não há testemunhos. Compartilhe o que Deus tem feito!</p>`
      : `<div class="comments-list">${m.testimonies.slice().reverse().map((t) => `<div class="comment-item"><p class="comment-author">${esc(t.name)}</p><p class="comment-text">${esc(t.text)}</p></div>`).join("")}</div>`;
    tabContent = `
      <div class="card">
        <p class="field-label">✨ Testemunhos do grupo</p>
        ${list}
        <div class="comment-form">
          <input id="comment-name-input" class="comment-name-input" placeholder="Seu nome" value="${esc(m.commentName)}" />
          <textarea id="testimony-text-input" class="textarea" style="min-height:70px;" placeholder="Conte o que Deus tem feito na sua vida...">${esc(m.testimonyText)}</textarea>
          <button id="post-testimony-btn" class="btn-primary" style="width:100%;margin-top:10px;">Publicar testemunho</button>
        </div>
      </div>
    `;
  } else if (m.tab === "louvores") {
    const groupsHtml = WORSHIP_PLAYLIST.map((g) => `
      <div style="margin-top:14px;">
        <p class="playlist-group-title">${esc(g.group)}</p>
        <ul class="kids-list">${g.songs.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>
    `).join("");
    const suggestionsList = m.worship.length === 0
      ? `<p class="guide-text">Ainda não há indicações. Deixe a sua abaixo!</p>`
      : `<div class="comments-list">${m.worship.slice().reverse().map((w) => `<div class="comment-item"><p class="comment-author">${esc(w.name)}</p><p class="comment-text">${esc(w.text)}</p></div>`).join("")}</div>`;
    tabContent = `
      <div class="card">
        <p class="field-label">🎵 Playlist de Louvores</p>
        <p class="guide-text" style="margin-bottom:10px;">Sugestões para começar:</p>
        ${groupsHtml}
        <p class="field-label" style="margin-top:20px;">🎶 Indicações das meninas</p>
        ${suggestionsList}
        <div class="comment-form">
          <input id="comment-name-input" class="comment-name-input" placeholder="Seu nome" value="${esc(m.commentName)}" />
          <textarea id="worship-text-input" class="textarea" style="min-height:60px;" placeholder="Nome da música e artista, ou um link de playlist...">${esc(m.worshipText)}</textarea>
          <button id="post-worship-btn" class="btn-primary" style="width:100%;margin-top:10px;">Indicar louvor</button>
        </div>
      </div>
    `;
  } else if (m.tab === "porArea") {
    const topicsHtml = m.prayerTopics.map((topic) => {
      const isExpanded = m.expandedTopic === topic.id;
      const isEditing = m.editingTopic === topic.id;
      let inner = "";
      if (isExpanded) {
        if (isEditing) {
          inner = `
            <textarea id="topic-edit-textarea" class="textarea" style="min-height:90px;margin-top:8px;">${esc(m.topicDraft)}</textarea>
            <div class="mural-btn-row">
              <button class="btn-secondary" id="topic-cancel-btn">Cancelar</button>
              <button class="btn-primary" id="topic-save-btn" data-topicid="${topic.id}">Salvar ajuste</button>
            </div>
          `;
        } else {
          inner = `
            <p class="topic-prayer-text">${esc(topic.prayer)}</p>
            <button class="edit-announcement-btn" data-edittopic="${topic.id}">✏️ Ajustar esta oração</button>
          `;
        }
      }
      return `
        <div class="topic-item">
          <button class="topic-header-btn" data-topic="${topic.id}">
            <span>${topic.icon} ${esc(topic.title)}</span>
            <span>${isExpanded ? "−" : "+"}</span>
          </button>
          ${inner}
        </div>
      `;
    }).join("");
    tabContent = `
      <div class="card">
        <p class="field-label">📂 Orações prontas por área</p>
        <p class="guide-text" style="margin-bottom:12px;">Toque num tema para abrir a oração. Qualquer mulher do grupo pode ajustar o texto — as mudanças ficam visíveis para todas.</p>
        ${topicsHtml}
      </div>
    `;
  }

  appEl.innerHTML = `
    <div class="page">
      <header class="header">
        <div class="header-inner">
          <div class="title-row">
            <button id="back-to-diary-btn" class="home-link-btn">${butterflySvg(34, "#E8DFCE")}</button>
            <div>
              <p class="eyebrow">Espaço do grupo</p>
              <h1 class="title">Mural da Semana</h1>
              <p class="subtitle">Recados e princípios para viver juntas</p>
            </div>
          </div>
          <button id="back-to-diary-btn-2" class="nav-toggle">← Voltar ao diário</button>
        </div>
      </header>

      <main class="main">
        <div class="shared-notice">👀 Este espaço é <strong>compartilhado</strong> — tudo que for escrito aqui pode ser visto por todas as mulheres do grupo.</div>

        <div class="card">
          <p class="field-label">📣 Recado da semana</p>
          ${m.editingAnnouncement ? `
            <textarea id="announcement-textarea" class="textarea" style="min-height:90px;">${esc(m.announcementDraft)}</textarea>
            <div class="mural-btn-row">
              <button id="cancel-announcement-btn" class="btn-secondary">Cancelar</button>
              <button id="save-announcement-btn" class="btn-primary">Publicar recado</button>
            </div>
          ` : `
            <p class="guide-text">${esc(m.announcement || "Nenhum recado publicado ainda.")}</p>
            <button id="edit-announcement-btn" class="edit-announcement-btn">✏️ Editar recado (Jaque)</button>
          `}
        </div>

        <div class="mural-tabs-row">${tabsHtml}</div>

        ${tabContent}
      </main>
    </div>
  `;

  bindMuralEvents();
}

function bindMuralEvents() {
  const back = () => { state.view = "diary"; render(); };
  document.getElementById("back-to-diary-btn").addEventListener("click", back);
  document.getElementById("back-to-diary-btn-2").addEventListener("click", back);

  const m = state.mural;

  document.querySelectorAll(".mural-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => { m.tab = btn.dataset.tab; render(); });
  });

  if (!m.editingAnnouncement) {
    document.getElementById("edit-announcement-btn").addEventListener("click", () => {
      m.editingAnnouncement = true; render();
    });
  } else {
    document.getElementById("announcement-textarea").addEventListener("input", (e) => { m.announcementDraft = e.target.value; });
    document.getElementById("cancel-announcement-btn").addEventListener("click", () => { m.editingAnnouncement = false; render(); });
    document.getElementById("save-announcement-btn").addEventListener("click", saveAnnouncement);
  }

  // name input shared across tabs
  const nameInput = document.getElementById("comment-name-input");
  if (nameInput) nameInput.addEventListener("input", (e) => { m.commentName = e.target.value; });

  if (m.tab === "semana") {
    document.querySelectorAll(".week-book-pill").forEach((btn) => {
      btn.addEventListener("click", () => { m.weekBookId = btn.dataset.weekbook; m.weekStart = 1; render(); });
    });
    const prev = document.getElementById("week-prev-btn");
    const next = document.getElementById("week-next-btn");
    if (prev) prev.addEventListener("click", () => { m.weekStart = Math.max(1, m.weekStart - 7); render(); });
    if (next) next.addEventListener("click", () => {
      const wb = BOOKS.find((b) => b.id === m.weekBookId) || BOOKS[0];
      if (m.weekStart + 7 <= wb.totalDays) { m.weekStart += 7; render(); }
    });
  }

  if (m.tab === "comentarios") {
    document.getElementById("comment-text-input").addEventListener("input", (e) => { m.commentText = e.target.value; });
    document.getElementById("post-comment-btn").addEventListener("click", postComment);
  }

  if (m.tab === "oracoes") {
    document.getElementById("prayer-text-input").addEventListener("input", (e) => { m.prayerText = e.target.value; });
    document.getElementById("post-prayer-btn").addEventListener("click", postPrayer);
    document.querySelectorAll(".pray-btn").forEach((btn) => {
      btn.addEventListener("click", () => incrementPray(btn.dataset.prayid));
    });
  }

  if (m.tab === "testemunhos") {
    document.getElementById("testimony-text-input").addEventListener("input", (e) => { m.testimonyText = e.target.value; });
    document.getElementById("post-testimony-btn").addEventListener("click", postTestimony);
  }

  if (m.tab === "louvores") {
    document.getElementById("worship-text-input").addEventListener("input", (e) => { m.worshipText = e.target.value; });
    document.getElementById("post-worship-btn").addEventListener("click", postWorship);
  }

  if (m.tab === "porArea") {
    document.querySelectorAll(".topic-header-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.topic);
        m.expandedTopic = m.expandedTopic === id ? null : id;
        m.editingTopic = null;
        render();
      });
    });
    document.querySelectorAll("[data-edittopic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.edittopic);
        const topic = m.prayerTopics.find((t) => t.id === id);
        m.editingTopic = id;
        m.topicDraft = topic ? topic.prayer : "";
        render();
      });
    });
    const cancelBtn = document.getElementById("topic-cancel-btn");
    if (cancelBtn) cancelBtn.addEventListener("click", () => { m.editingTopic = null; render(); });
    const saveBtn = document.getElementById("topic-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => saveTopicEdit(Number(saveBtn.dataset.topicid)));
      const editArea = document.getElementById("topic-edit-textarea");
      if (editArea) editArea.addEventListener("input", (e) => { m.topicDraft = e.target.value; });
    }
  }
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
checkSession();

