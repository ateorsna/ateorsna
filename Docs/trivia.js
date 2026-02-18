(() => {
  const $ = (id) => document.getElementById(id);

  const elMeta = $("triviaMeta");
  const elStart = $("triviaStart");
  const elGame = $("triviaGame");
  const btnStart = $("btnStartTrivia");
  const btnNext = $("btnNext");
  const btnRestart = $("btnRestart");
  const elProgress = $("triviaProgress");
  const elScore = $("triviaScore");
  const elQ = $("triviaQuestion");
  const elOpts = $("triviaOptions");
  const elFb = $("triviaFeedback");

  let questions = [];
  let idx = 0;
  let score = 0;
  let locked = false;
  let profileCounter = {
    transformador: 0,
    administrativo: 0,
    individualista: 0
  };

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Para que el orden de opciones quede fijo dentro de la misma pregunta,
  // guardamos un "shuffledOptions" por id.
  const optionsCache = new Map();

  function normalizeCorrect(correct) {
    // correct puede venir como string ("B") o como array (["A","C"])
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

    // Validación mínima + normalización
    questions = data.questions.map((q) => ({
      ...q,
      correct: normalizeCorrect(q.correct),
    }));

    elMeta.textContent = `Banco cargado: ${questions.length} preguntas.`;
  }

  function startGame() {
    idx = 0;
    score = 0;
    locked = false;
    profileCounter = {
      transformador: 0,
      administrativo: 0,
      individualista: 0
    };

    // opcional: mezclar el orden de preguntas para que no sea siempre el mismo
    questions = shuffle(questions);

    optionsCache.clear();

    elStart.style.display = "none";
    elGame.style.display = "block";
    btnRestart.style.display = "none";

    renderQuestion();
  }

  function renderQuestion() {
    locked = false;
    btnNext.disabled = true;
    elFb.style.display = "none";
    elFb.className = "trivia-feedback";
    elFb.textContent = "";

    const q = questions[idx];

    elProgress.textContent = `Pregunta ${idx + 1} de ${questions.length}`;
    elScore.textContent = `Puntos: ${score}`;

    elQ.textContent = q.question;

    // cache de opciones mezcladas por pregunta
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

    const q = questions[idx];
    const correctKeys = q.correct; // array
    const isCorrect = correctKeys.includes(selectedKey);
// sumar perfil (si la opción trae profile)
const selectedOption = q.options.find(o => o.key === selectedKey);
if (selectedOption && selectedOption.profile && profileCounter[selectedOption.profile] != null) {
  profileCounter[selectedOption.profile] += 1;
}

    // marcar botones
    const buttons = Array.from(elOpts.querySelectorAll("button.trivia-option"));
    buttons.forEach((b) => {
      b.disabled = true;
      const k = b.dataset.key;
      if (correctKeys.includes(k)) b.classList.add("correct");
      if (k === selectedKey && !isCorrect) b.classList.add("wrong");
    });

    // puntaje (si querés solo 1 punto por pregunta)
    if (isCorrect) score += 1;

    // feedback
    elFb.style.display = "block";
    elFb.classList.add(isCorrect ? "good" : "bad");
    elFb.textContent = isCorrect ? q.feedbackCorrect : q.feedbackIncorrect;

    elScore.textContent = `Puntos: ${score}`;
    btnNext.disabled = false;

    // último
    if (idx === questions.length - 1) {
      btnNext.textContent = "Finalizar";
    } else {
      btnNext.textContent = "Siguiente";
    }
  }

  function next() {
    if (idx === questions.length - 1) {
      finish();
      return;
    }
    idx += 1;
    renderQuestion();
  }

function finish() {
  elOpts.innerHTML = "";
  btnNext.disabled = true;

  // Determinar perfil dominante
  const entries = Object.entries(profileCounter);
  entries.sort((a, b) => b[1] - a[1]);
  const perfil = entries[0][0];

  let titulo = "";
  let mensaje = "";

  if (perfil === "transformador") {
    titulo = "Perfil: Sindicalismo Participativo y Transformador";
    mensaje = "Tus respuestas muestran una visión de sindicato activo, democrático y comprometido con ampliar derechos, fortalecer el rol del Estado y construir poder colectivo en el ORSNA. Este modelo apuesta a más afiliación, más participación y más organización.";
  } else if (perfil === "administrativo") {
    titulo = "Perfil: Sindicalismo Administrativo";
    mensaje = "Tu visión prioriza estabilidad y gestión institucional. Aun así, en contextos de pérdida salarial y ajuste, la organización y la participación son claves para recuperar derechos y fortalecer la función pública.";
  } else {
    titulo = "Perfil: Sindicalismo Individualista";
    mensaje = "Tus respuestas muestran una mirada más individual. Pero la experiencia sindical demuestra que, especialmente en el Estado, la defensa de derechos y salarios se logra con organización colectiva y solidaridad entre compañeras y compañeros.";
  }

  elQ.innerHTML = `<strong>${titulo}</strong>`;
  elFb.style.display = "block";
  elFb.className = "trivia-feedback good";
  elFb.innerHTML = `
    <p>${mensaje}</p>
    <p style="margin-top:10px; font-weight:600;">
      La renovación de la Junta Interna es una oportunidad para fortalecer el sindicato que necesitamos.
    </p>
  `;

  btnRestart.style.display = "inline-block";
}


  // events
  btnStart.addEventListener("click", startGame);
  btnNext.addEventListener("click", next);
  btnRestart.addEventListener("click", () => {
    elGame.style.display = "none";
    elStart.style.display = "block";
    elMeta.textContent = `Banco cargado: ${questions.length} preguntas.`;
  });

  // init
  loadTrivia().catch((err) => {
    console.error(err);
    elMeta.textContent = "Error cargando trivia. Revisá que exista Docs/trivia.json y que GitHub Pages lo sirva.";
  });
})();

