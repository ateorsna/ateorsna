(() => {
  const $ = (id) => document.getElementById(id);

  const btnModeGeneral = $("btnModeGeneral");
  const btnModeCampaign = $("btnModeCampaign");
  const btnNext = $("btnNext");
  const btnRestart = $("btnRestart");
  const btnNextRound = $("btnNextRound");

  const elMeta = $("triviaMeta");
  const elGame = $("triviaGame");
  const elProgress = $("triviaProgress");
  const elScore = $("triviaScore");
  const elQ = $("triviaQuestion");
  const elOpts = $("triviaOptions");
  const elFb = $("triviaFeedback");

  let allQuestions = [];
  let activeQuestions = [];

  let mode = "general"; // "general" | "campaign"
  const GENERAL_ROUND_SIZE = 10;

  let idx = 0;
  let score = 0;
  let locked = false;

  let profileCounter = {
    transformador: 0,
    administrativo: 0,
    individualista: 0
  };

  const optionsCache = new Map();

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
function confettiBurst() {
  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);

  const colors = ["#22c55e", "#00923f", "#ff7a00", "#a3e635", "#16a34a"];
  const pieces = 50;

  for (let i = 0; i < pieces; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";

    el.style.left = Math.random() * 100 + "vw";
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 200 + "ms";
    el.style.width = (8 + Math.random() * 6) + "px";
    el.style.height = (10 + Math.random() * 10) + "px";

    container.appendChild(el);
  }

  setTimeout(() => {
    container.remove();
  }, 1200);
}

  function normalizeCorrect(correct) {
    if (Array.isArray(correct)) return correct;
    if (typeof correct === "string") return [correct];
    return [];
  }

  async function loadTrivia() {
    const res = await fetch("Docs/trivia.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar Docs/trivia.json");
    const data = await res.json();

    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error("Formato inválido: falta questions[]");
    }

    allQuestions = data.questions.map((q) => ({
      ...q,
      correct: normalizeCorrect(q.correct),
    }));

    const total = allQuestions.length;
    const campaignCount = allQuestions.filter(q => Number(q.id) >= 201).length;
    elMeta.textContent = `Banco cargado: ${total} preguntas. Modo elecciones: ${campaignCount}.`;
  }

  function resetRun() {
    idx = 0;
    score = 0;
    locked = false;
    optionsCache.clear();
    profileCounter = { transformador: 0, administrativo: 0, individualista: 0 };

    btnNext.disabled = true;
    btnRestart.style.display = "inline-block";
    btnNextRound.style.display = "none";

    elFb.style.display = "none";
    elFb.className = "trivia-feedback";
    elFb.textContent = "";
  }

  function buildActiveQuestions() {
    const generalPool = allQuestions.filter(q => Number(q.id) < 201);
    const campaignPool = allQuestions.filter(q => Number(q.id) >= 201);

    if (mode === "campaign") {
      // Campaña: usar todo el bloque (en orden mezclado o fijo)
      activeQuestions = shuffle(campaignPool);
    } else {
      // General: micro-ronda de 10
      activeQuestions = shuffle(generalPool).slice(0, GENERAL_ROUND_SIZE);
    }
  }

  function startMode(newMode) {
    mode = newMode;
    resetRun();
    buildActiveQuestions();

    elGame.style.display = "block";

    if (mode === "campaign") {
      elMeta.textContent = `Modo elecciones: ${activeQuestions.length} preguntas. (No guardamos respuestas).`;
    } else {
      elMeta.textContent = `Modo formación: ${activeQuestions.length} preguntas. (No guardamos respuestas).`;
    }

    renderQuestion();
  }

  function renderQuestion() {
    locked = false;
    btnNext.disabled = true;

    elFb.style.display = "none";
    elFb.className = "trivia-feedback";
    elFb.textContent = "";

    const q = activeQuestions[idx];

    elProgress.textContent = `Pregunta ${idx + 1} de ${activeQuestions.length}`;
const aciertosTxt = `Aciertos: ${score}/${idx}`; // idx preguntas ya respondidas (antes de contestar esta)
const perfilTxt = (mode === "campaign")
  ? `<span class="trivia-badge trivia-badge--campaign">🗳️ Perfil en construcción</span>`
  : `<span class="trivia-badge">📚 Formación activa</span>`;

elScore.innerHTML = `
  ${perfilTxt}
  <span class="trivia-badge">✅ ${score} aciertos</span>
`;

    elQ.textContent = q.question;

    let opts = optionsCache.get(q.id);
    if (!opts) {
      opts = shuffle(q.options);
      optionsCache.set(q.id, opts);
    }

    elOpts.innerHTML = "";
    opts.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "trivia-option";
      btn.type = "button";
      btn.dataset.key = opt.key;
      btn.innerHTML = `<b>${opt.key}.</b> ${opt.text}`;
      btn.addEventListener("click", () => selectOption(opt.key));
      elOpts.appendChild(btn);
    });
  }

  function selectOption(selectedKey) {
    if (locked) return;
    locked = true;

    const q = activeQuestions[idx];
    const correctKeys = q.correct;
    const isCorrect = correctKeys.includes(selectedKey);

    // sumar perfil SOLO en campaña (si existe profile)
    if (mode === "campaign") {
      const shownOptions = optionsCache.get(q.id) || q.options;
      const selectedOption = shownOptions.find(o => o.key === selectedKey);
      if (selectedOption && selectedOption.profile && profileCounter[selectedOption.profile] != null) {
        profileCounter[selectedOption.profile] += 1;
      }
    }

    // marcar botones
    const buttons = Array.from(elOpts.querySelectorAll("button.trivia-option"));
    buttons.forEach((b) => {
      b.disabled = true;
      const k = b.dataset.key;
      if (correctKeys.includes(k)) b.classList.add("correct");
      if (k === selectedKey && !isCorrect) b.classList.add("wrong");
    });

if (isCorrect) {
  score += 1;

  // 🎉 CONFETTI
  if (typeof confetti === "function") {
confetti({
  particleCount: 60,
  spread: 55,
  colors: ['#198754', '#ff7a00'],
  origin: { y: 0.65 }
});
  }
}


    elFb.style.display = "block";
    elFb.classList.add(isCorrect ? "good" : "bad");
    elFb.textContent = isCorrect ? q.feedbackCorrect : q.feedbackIncorrect;

    elScore.textContent = `Puntos: ${score}${mode === "campaign" ? " | Perfil activo" : ""}`;
    btnNext.disabled = false;

    btnNext.textContent = (idx === activeQuestions.length - 1) ? "Finalizar" : "Siguiente";
  }

  function next() {
    if (idx === activeQuestions.length - 1) {
      finish();
      return;
    }
    idx += 1;
    renderQuestion();
  }

  function finish() {
    elOpts.innerHTML = "";
    btnNext.disabled = true;

    if (mode === "campaign") {
      // Perfil sindical
      const entries = Object.entries(profileCounter);
      const totalProfileAnswers = entries.reduce((acc, [,v]) => acc + v, 0);
      entries.sort((a, b) => b[1] - a[1]);
      const perfil = totalProfileAnswers > 0 ? entries[0][0] : null;

      let titulo = "";
      let mensaje = "";

      if (!perfil) {
        titulo = "Resultado: modo elecciones";
        mensaje = "Terminaste el bloque de elecciones. Si querés ver tu perfil, asegurate de que estas preguntas tengan opciones con etiqueta de perfil (transformador/administrativo/individualista).";
      } else if (perfil === "transformador") {
        titulo = "Perfil: Sindicalismo participativo y transformador";
        mensaje = "Tus respuestas reflejan que querés pertenecer a un sindicato con base, mandato y participación: más afiliación, más transparencia, más organización y defensa del rol del Estado en la actividad aeroportuaria. Ese es el camino para recuperar salario y ampliar derechos.";
      } else if (perfil === "administrativo") {
        titulo = "Perfil: Sindicalismo administrativo";
        mensaje = "Tus respuestas reflejan que priorizás estabilidad y gestión. Eso suma, pero hoy la realidad pide un plus: organización, participación y plan colectivo para recuperar derechos y fortalecer la función pública.";
      } else {
        titulo = "Perfil: Sindicalismo individualista";
        mensaje = "Tus respuestas reflejan que tenes una mirada más individual. En el Estado, cuando aprieta el ajuste, la experiencia muestra que la defensa real se logra con organización colectiva y solidaridad.";
      }

      elQ.innerHTML = `<strong>${titulo}</strong>`;
      elFb.style.display = "block";
      elFb.className = "trivia-feedback good";
      elFb.innerHTML = `
        <p>${mensaje}</p>
        <p style="margin-top:10px; font-weight:600;">
          Si querés un ORSNA fuerte y un salario digno: participá, sumate a los espacios, y ayudá a ampliar la afiliación.
        </p>
      `;

      btnNextRound.style.display = "none";
    } else {
      // Formación: cierre corto + invitar a modo elecciones
      elQ.innerHTML = `<strong>¡Listo! Terminaste la ronda de formación.</strong>`;
      elFb.style.display = "block";
      elFb.className = "trivia-feedback good";
      elFb.innerHTML = `
        <p><b>Puntaje:</b> ${score} / ${activeQuestions.length}.</p>
        <p style="margin-top:8px;">
          Lo importante no es “sacar 10”: es llevarte ideas claras para defenderte y defender al resto.
          Si querés, podés hacer otra ronda o probar el <b>modo elecciones</b> (perfil sindical).
        </p>
      `;

      btnNextRound.style.display = "inline-block";
    }

    btnRestart.style.display = "inline-block";
  }

  // events
  btnModeGeneral.addEventListener("click", () => startMode("general"));
  btnModeCampaign.addEventListener("click", () => startMode("campaign"));

  btnNext.addEventListener("click", next);

  btnRestart.addEventListener("click", () => {
    elGame.style.display = "none";
    elMeta.textContent = `Elegí un modo para comenzar. (No guardamos respuestas).`;
  });

  btnNextRound.addEventListener("click", () => {
    startMode("general");
  });

  // init
  loadTrivia().then(() => {
    elMeta.textContent = `Elegí un modo para comenzar. (No guardamos respuestas).`;
  }).catch((err) => {
    console.error(err);
    elMeta.textContent = "Error cargando trivia. Revisá que exista Docs/trivia.json y que GitHub Pages lo sirva.";
  });
})();


