"use strict";

const BabyPool = (() => {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const STORAGE_KEY = "la-gran-espera.birth.v1";
  const bets = [
    { name: "Pao", date: "2026-11-16T11:00:00", color: "#ccc2e9" },
    { name: "Tavo", date: "2026-11-20T03:00:00", color: "#a8deca" },
    { name: "Fer", date: "2026-11-23T12:00:00", color: "#f1c4b1" },
    { name: "Dany", date: "2026-11-23T19:32:00", color: "#efbfd7" },
    { name: "Daniel", date: "2026-11-25T07:15:00", color: "#afcfe9" },
    { name: "Marité", date: "2026-11-26T22:00:00", color: "#f2c677" },
  ];

  // UTC is only an arithmetic container for a shared wall clock, not a timezone conversion.
  function parseLocal(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) return NaN;
    const [year, month, day, hour, minute, second] = match.slice(1).map((n) => Number(n || 0));
    if (year < 1000 || year > 9999) return NaN;
    const stamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const result = new Date(stamp);
    return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1
      && result.getUTCDate() === day && result.getUTCHours() === hour
      && result.getUTCMinutes() === minute && result.getUTCSeconds() === second ? stamp : NaN;
  }

  function toInput(stamp) {
    return new Date(stamp).toISOString().slice(0, 19);
  }

  function nowLocal() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  }

  const format = new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
  const formatSeconds = new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: "UTC",
  });
  function display(stamp, seconds = false) {
    return (seconds ? formatSeconds : format).format(new Date(stamp));
  }

  bets.forEach((bet) => { bet.time = parseLocal(bet.date); });
  const boundaries = bets.slice(1).map((bet, index) => (bet.time + bets[index].time) / 2);
  const start = parseLocal("2026-11-14T00:00:00");
  const end = parseLocal("2026-11-29T00:00:00");

  function rank(stamp) {
    if (!Number.isFinite(stamp)) throw new RangeError("La fecha no es válida.");
    return bets.map((bet) => ({ ...bet, distance: Math.abs(stamp - bet.time) }))
      .sort((a, b) => a.distance - b.distance || a.time - b.time);
  }

  function winners(stamp) {
    const sorted = rank(stamp);
    return sorted.filter((bet) => bet.distance === sorted[0].distance);
  }

  function duration(ms) {
    if (ms === 0) return "Coincidencia exacta";
    let remaining = Math.floor(ms / 1000);
    const units = [[86400, "d"], [3600, "h"], [60, "min"], [1, "s"]];
    const parts = [];
    for (const [size, label] of units) {
      const amount = Math.floor(remaining / size);
      remaining %= size;
      if (amount) parts.push(`${amount} ${label}`);
    }
    return parts.join(" ");
  }

  function windowLabel(index) {
    if (index === 0) return `Antes de ${display(boundaries[0], true)}`;
    if (index === bets.length - 1) return `Después de ${display(boundaries.at(-1), true)}`;
    return `${display(boundaries[index - 1], true)} → ${display(boundaries[index], true)}`;
  }

  function mount() {
    const $ = (id) => document.getElementById(id);
    let savedBirth = null;
    let simulation = parseLocal($("sim-date").value);

    const storageError = (message) => {
      $("storage-status").textContent = message;
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseLocal(raw);
        if (!Number.isFinite(parsed)) {
          storageError("El resultado guardado no tiene una fecha válida. Registra uno nuevo para reemplazarlo.");
        } else {
          savedBirth = parsed;
        }
      }
    } catch (error) {
      storageError(`No se pudo leer el almacenamiento de este navegador (${error.name}). El simulador sigue disponible.`);
    }

    $("participant-list").innerHTML = bets.map((bet, index) => `
      <button class="participant" data-bet="${index}" aria-label="Probar apuesta de ${bet.name}: ${display(bet.time)}">
        <span class="avatar" style="background:${bet.color}">${bet.name.charAt(0)}</span>
        <span><span class="person-name">${bet.name}</span><span class="person-date">${display(bet.time)}</span>
        <span class="person-window">Gana: ${windowLabel(index)}</span></span>
        <span class="person-arrow" aria-hidden="true">↗</span>
      </button>`).join("");

    $("prediction-markers").innerHTML = bets.map((bet, index) => `
      <button class="prediction-marker ${index === 3 ? "stagger" : ""}"
        style="left:${100 * (bet.time - start) / (end - start)}%"
        data-bet="${index}" aria-label="Probar apuesta de ${bet.name}">${bet.name}</button>`).join("");

    $("timeline-track").innerHTML = bets.map((bet, index) => {
      const left = index === 0 ? start : boundaries[index - 1];
      const right = index === bets.length - 1 ? end : boundaries[index];
      return `<button class="time-segment" style="width:${100 * (right - left) / (end - start)}%;background:${bet.color}"
        data-segment="${index}" aria-label="Explorar intervalo ganador de ${bet.name}"
        title="${bet.name}: ${windowLabel(index)}">${index === 3 ? "" : bet.name}</button>`;
    }).join("");
    $("timeline-axis").innerHTML = [14, 17, 20, 23, 26, 29].map((day) => `<span>${day} nov</span>`).join("");

    function updateSimulation(stamp) {
      simulation = stamp;
      const sorted = rank(stamp);
      const winning = winners(stamp);
      const tied = winning.length > 1;
      $("winner-box").style.background = `${winning[0].color}55`;
      $("winner-box").style.borderColor = `${winning[0].color}`;
      $("winner-box").innerHTML = `
        <span class="winner-symbol" aria-hidden="true">${tied ? "↔" : "✦"}</span>
        <div><span class="mini-label">${tied ? "¡EMPATE EXACTO!" : "SI LLEGA EN ESE MOMENTO, GANA"}</span>
        <strong>${winning.map((bet) => bet.name).join(" y ")}</strong>
        <small>${sorted[0].distance === 0 ? "Su apuesta coincide al segundo." : `A ${duration(sorted[0].distance)} de su apuesta${tied ? " · comparten la victoria" : ""}.`}</small></div>`;
      $("ranking").innerHTML = sorted.map((bet, index) => `
        <div class="rank-row"><span class="rank-number">${index > 0 && bet.distance === sorted[index - 1].distance ? "=" : String(index + 1).padStart(2, "0")}</span>
        <span class="rank-name"><i class="color-dot" style="background:${bet.color}"></i>${bet.name}</span>
        <strong>${duration(bet.distance)}</strong></div>`).join("");
      $("date-slider").value = String(Math.max(0, Math.min((end - start) / MINUTE, (stamp - start) / MINUTE)));
      const position = Math.max(0, Math.min(100, 100 * (stamp - start) / (end - start)));
      $("timeline-cursor").style.left = `${position}%`;
      $("timeline-cursor").querySelector("span").textContent = stamp < start ? "Antes del 14" : stamp > end ? "Después del 29" : "Tu fecha";
      $("date-slider").setAttribute("aria-valuetext", `${display(stamp, true)}. ${tied ? "Empatan" : "Gana"} ${winning.map((bet) => bet.name).join(" y ")}.`);
    }

    function setSimulation(stamp) {
      $("sim-date").value = toInput(stamp);
      $("sim-error").hidden = true;
      $("sim-date").removeAttribute("aria-invalid");
      updateSimulation(stamp);
    }

    $("sim-date").addEventListener("input", () => {
      const stamp = parseLocal($("sim-date").value);
      const valid = Number.isFinite(stamp);
      $("sim-error").hidden = valid;
      $("sim-error").textContent = valid ? "" : "Introduce una fecha y hora completas y válidas para actualizar el resultado.";
      $("sim-date").setAttribute("aria-invalid", String(!valid));
      if (valid) updateSimulation(stamp);
    });
    $("date-slider").addEventListener("input", () => setSimulation(start + Number($("date-slider").value) * MINUTE));
    document.querySelectorAll("[data-bet]").forEach((button) => {
      button.addEventListener("click", () => setSimulation(bets[Number(button.dataset.bet)].time));
    });
    document.querySelectorAll("[data-segment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.segment);
        const left = index === 0 ? start : boundaries[index - 1];
        const right = index === bets.length - 1 ? end : boundaries[index];
        setSimulation(Math.floor((left + right) / 2000) * 1000);
      });
    });

    function renderSaved() {
      $("saved-result").hidden = savedBirth === null;
      $("clear-birth").hidden = savedBirth === null;
      $("open-birth").textContent = savedBirth === null ? "¡Ya llegó el bebé! ↗" : "Ver / editar nacimiento ↗";
      if (savedBirth !== null) {
        const winning = winners(savedBirth);
        $("saved-result").textContent = `♡ Nacimiento registrado: ${display(savedBirth, true)} de ${new Date(savedBirth).getUTCFullYear()}. ${winning.length > 1 ? "¡Empatan" : "¡Gana"} ${winning.map((bet) => bet.name).join(" y ")}! Distancia: ${duration(winning[0].distance)}. Guardado solo en este navegador.`;
      }
    }

    function updateCountdown() {
      const now = nowLocal();
      const next = bets.find((bet) => bet.time > now);
      if (savedBirth !== null || !next) {
        $("next-name").textContent = savedBirth !== null ? "La espera ya tiene su final." : "Todas las apuestas ya pasaron.";
        $("next-date").textContent = savedBirth !== null ? `Bienvenida a una nueva historia · ${display(savedBirth)}` : "El simulador sigue abierto para cualquier fecha.";
        $("countdown").innerHTML = '<span class="countdown-unit"><strong>♡</strong><span>CADA LLEGADA TIENE SU MOMENTO</span></span>';
        $("countdown-caption").textContent = savedBirth !== null ? "Resultado registrado en este dispositivo." : "Que pase una apuesta no determina cuándo nacerá el bebé.";
        return;
      }
      $("next-name").textContent = `${next.name} tiene una corazonada.`;
      $("next-date").textContent = `${display(next.time)} · 2026`;
      const diff = next.time - now;
      const values = [Math.floor(diff / DAY), Math.floor(diff % DAY / HOUR), Math.floor(diff % HOUR / MINUTE), Math.floor(diff % MINUTE / 1000)];
      $("countdown").innerHTML = values.map((value, index) =>
        `<div class="countdown-unit"><strong>${String(value).padStart(2, "0")}</strong><span>${["DÍAS", "HORAS", "MIN", "SEG"][index]}</span></div>`).join("");
      $("countdown-caption").textContent = "Cuenta regresiva a una apuesta, no a la fecha de parto.";
    }

    $("open-guide").addEventListener("click", () => $("guide-dialog").showModal());
    $("open-birth").addEventListener("click", () => {
      $("birth-date").value = toInput(savedBirth ?? nowLocal());
      $("birth-error").hidden = true;
      $("birth-dialog").showModal();
    });
    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => $(button.dataset.close).close());
    });
    $("birth-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const stamp = parseLocal($("birth-date").value);
      if (!Number.isFinite(stamp) || stamp > nowLocal()) {
        $("birth-error").textContent = "Para registrar un nacimiento real, elige una fecha válida que no esté en el futuro. Para probar fechas futuras, usa el simulador.";
        $("birth-error").hidden = false;
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, toInput(stamp));
      } catch (error) {
        $("birth-error").textContent = `No se pudo guardar el resultado (${error.name}). Revisa los permisos de almacenamiento del navegador.`;
        $("birth-error").hidden = false;
        return;
      }
      savedBirth = stamp;
      storageError("");
      renderSaved();
      updateCountdown();
      setSimulation(stamp);
      $("birth-dialog").close();
      $("celebration").innerHTML = Array.from({ length: 45 }, (_, index) => `<i class="confetti" style="left:${(index * 31) % 100}%;background:${bets[index % bets.length].color};animation-delay:${index % 7 * .07}s;--drift:${index % 2 ? 90 : -90}px"></i>`).join("");
      setTimeout(() => { $("celebration").replaceChildren(); }, 4000);
    });
    $("clear-birth").addEventListener("click", () => {
      if (!confirm("¿Borrar el nacimiento guardado en este navegador? Las apuestas no se borrarán.")) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        $("birth-error").textContent = `No se pudo borrar el resultado (${error.name}). Revisa los permisos del navegador.`;
        $("birth-error").hidden = false;
        return;
      }
      savedBirth = null;
      storageError("");
      renderSaved();
      updateCountdown();
      $("birth-dialog").close();
    });
    setSimulation(savedBirth ?? simulation);
    renderSaved();
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  return { bets, boundaries, parseLocal, toInput, rank, winners, mount };
})();

if (typeof document !== "undefined") BabyPool.mount();
if (typeof module !== "undefined") module.exports = BabyPool;
