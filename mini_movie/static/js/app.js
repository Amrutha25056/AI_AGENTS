"use strict";

const API_URL = "/api/movies";
const FALLBACK_POSTER = "/static/images/placeholder.svg";

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Something went wrong. Please try again.");
    error.fields = payload.fields || {};
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric"
  }).format(date);
}

function posterFor(movie) {
  return escapeHtml(movie.poster_url || FALLBACK_POSTER);
}

function movieCard(movie) {
  return `<a class="movie-card" href="/movies/${movie.id}">
    <div class="movie-poster"><img src="${posterFor(movie)}" alt="Poster for ${escapeHtml(movie.title)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"><span class="poster-duration">${Number(movie.duration)} MIN</span><span class="poster-open" aria-hidden="true">↗</span></div>
    <div class="movie-card-copy"><div class="movie-card-meta"><span>${escapeHtml(movie.genre)}</span><span>${escapeHtml(formatDate(movie.created_at))}</span></div><h3>${escapeHtml(movie.title)}</h3></div>
  </a>`;
}

function showMessage(element, text, kind = "error") {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${kind} is-visible`;
}

function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("is-open", !expanded);
  });
}

async function initHome() {
  const container = document.querySelector("#recent-movies");
  try {
    const movies = await apiRequest(API_URL);
    container.innerHTML = movies.length
      ? movies.slice(0, 3).map(movieCard).join("")
      : `<div class="empty-state home-empty"><span class="empty-icon">✦</span><h3>Your first story starts here.</h3><p>Create a movie and it will show up here.</p><a class="text-link" href="/create">Make your first movie →</a></div>`;
  } catch (error) {
    container.innerHTML = `<p class="inline-error">${escapeHtml(error.message)}</p>`;
  }
}

async function initLibrary() {
  const grid = document.querySelector("#library-movies");
  const search = document.querySelector("#movie-search");
  const genre = document.querySelector("#genre-filter");
  const count = document.querySelector("#movie-count");
  const message = document.querySelector("#library-message");
  let movies = [];

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const selectedGenre = genre.value;
    const filtered = movies.filter((movie) => movie.title.toLocaleLowerCase().includes(term)
      && (!selectedGenre || movie.genre === selectedGenre));
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "movie" : "movies"}`;
    if (filtered.length) {
      grid.innerHTML = filtered.map(movieCard).join("");
    } else if (!movies.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-icon">▱</span><h2>No movies in your library yet</h2><p>Your next great little movie is one idea away.</p><a class="button button-primary" href="/create">Create your first movie ↗</a></div>`;
    } else {
      grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><h2>No matching movies</h2><p>Try another title or clear the genre filter.</p><button class="button button-outline" type="button" id="clear-filters">Clear filters</button></div>`;
      grid.querySelector("#clear-filters").addEventListener("click", () => {
        search.value = "";
        genre.value = "";
        render();
      });
    }
  }

  search.addEventListener("input", render);
  genre.addEventListener("change", render);
  try {
    movies = await apiRequest(API_URL);
    render();
  } catch (error) {
    count.textContent = "";
    grid.innerHTML = "";
    showMessage(message, error.message);
  }
}

function characterMarkup(character = {}, index = 0, canRemove = false) {
  return `<div class="character-entry">
    <div class="character-entry-top"><span class="character-index">CHARACTER ${String(index + 1).padStart(2, "0")}</span>${canRemove ? `<button type="button" class="remove-character" aria-label="Remove character">×</button>` : ""}</div>
    <input class="character-name" type="text" maxlength="40" placeholder="Character name" aria-label="Character name" value="${escapeHtml(character.name || "")}" required>
    <textarea class="character-description" rows="2" maxlength="180" placeholder="A brave inventor who never gives up..." aria-label="Character description">${escapeHtml(character.description || "")}</textarea>
  </div>`;
}

async function initCreate() {
  const form = document.querySelector("#movie-form");
  const list = document.querySelector("#character-list");
  const message = document.querySelector("#form-message");
  const submitButton = document.querySelector("#submit-movie");
  const editId = new URLSearchParams(window.location.search).get("edit");
  const plotInput = form.elements.plot;
  const plotCount = document.querySelector("#plot-count");
  let isEditing = Boolean(editId);

  plotInput.addEventListener("input", () => { plotCount.textContent = String(plotInput.value.length); });
  document.querySelector("#add-character").addEventListener("click", () => {
    const entries = list.querySelectorAll(".character-entry");
    if (entries.length >= 6) {
      showMessage(message, "A movie can have up to 6 characters.");
      return;
    }
    list.insertAdjacentHTML("beforeend", characterMarkup({}, entries.length, true));
    message.className = "message";
    refreshCharacterLabels();
    list.querySelector(".character-entry:last-child .character-name").focus();
  });
  list.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-character");
    if (!removeButton) return;
    removeButton.closest(".character-entry").remove();
    refreshCharacterLabels();
  });

  function refreshCharacterLabels() {
    list.querySelectorAll(".character-entry").forEach((entry, index) => {
      entry.querySelector(".character-index").textContent = `CHARACTER ${String(index + 1).padStart(2, "0")}`;
      const removeButton = entry.querySelector(".remove-character");
      if (index > 0 && !removeButton) {
        entry.querySelector(".character-entry-top").insertAdjacentHTML("beforeend", '<button type="button" class="remove-character" aria-label="Remove character">×</button>');
      }
      if (index === 0 && removeButton) removeButton.remove();
    });
  }

  if (isEditing) {
    document.querySelector("#form-heading").textContent = "Edit your movie";
    submitButton.querySelector(".button-label").textContent = "Save Changes";
    try {
      const movie = await apiRequest(`${API_URL}/${encodeURIComponent(editId)}`);
      form.elements.title.value = movie.title;
      form.elements.genre.value = movie.genre;
      form.elements.mood.value = movie.mood;
      form.elements.plot.value = movie.plot;
      form.elements.poster_url.value = movie.poster_url || "";
      form.querySelector(`input[name="duration"][value="${movie.duration}"]`).checked = true;
      list.innerHTML = movie.characters.map((character, index) => characterMarkup(character, index, index > 0)).join("");
      refreshCharacterLabels();
      plotCount.textContent = String(movie.plot.length);
    } catch (error) {
      showMessage(message, error.message);
      submitButton.disabled = true;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.className = "message";
    if (!form.reportValidity()) return;
    const characters = [...list.querySelectorAll(".character-entry")].map((entry) => ({
      name: entry.querySelector(".character-name").value.trim(),
      description: entry.querySelector(".character-description").value.trim()
    }));
    if (!characters.length || characters.some((character) => !character.name)) {
      showMessage(message, "Add at least one character and give each character a name.");
      return;
    }
    const movie = {
      title: form.elements.title.value.trim(), genre: form.elements.genre.value,
      plot: form.elements.plot.value.trim(), characters,
      duration: Number(form.querySelector('input[name="duration"]:checked').value),
      mood: form.elements.mood.value, poster_url: form.elements.poster_url.value.trim()
    };
    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.querySelector(".button-label").textContent = isEditing ? "Saving..." : "Creating...";
    try {
      const saved = await apiRequest(isEditing ? `${API_URL}/${encodeURIComponent(editId)}` : API_URL, {
        method: isEditing ? "PUT" : "POST", body: JSON.stringify(movie)
      });
      window.location.assign(`/movies/${saved.id}`);
    } catch (error) {
      const fieldDetails = Object.values(error.fields || {}).join(" ");
      showMessage(message, fieldDetails || error.message);
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      submitButton.querySelector(".button-label").textContent = isEditing ? "Save Changes" : "Create Movie";
    }
  });
}

function playerMarkup(movie) {
  return `<section class="player-section" aria-labelledby="player-heading">
    <div class="player-heading"><div><p class="eyebrow">YOUR STORY, IN MOTION</p><h2 id="player-heading">Movie preview</h2><p>A short animated storyboard made from your saved story and cast.</p></div><span class="player-runtime">ANIMATED CUT · 26 SEC</span></div>
    <div class="video-stage" id="video-stage"><canvas id="movie-canvas" width="1280" height="720" aria-label="Animated movie preview"></canvas><div class="stage-topline"><span>MINIMOVIE PICTURES</span><span id="scene-indicator">THE IDEA</span></div><div class="stage-center-control"><button id="stage-play" type="button" aria-label="Play movie preview">▶</button></div><div class="stage-credit">A STORY BY <span>${escapeHtml(movie.title)}</span></div></div>
    <div class="player-controls"><button class="player-icon-button" id="play-toggle" type="button" aria-label="Play preview">▶</button><span class="player-time" id="player-time">00:00</span><input id="player-seek" class="player-seek" type="range" min="0" max="26000" value="0" aria-label="Seek through movie preview"><span class="player-time">00:26</span><button class="player-icon-button fullscreen-button" id="fullscreen-toggle" type="button" aria-label="Enter fullscreen" title="Fullscreen">⛶</button><button class="button button-outline download-button" id="download-video" type="button">↓ Download video</button></div>
    <p class="player-status" id="player-status" role="status" aria-live="polite">Press play to watch your animated movie preview. Download creates a silent WebM video.</p>
  </section>`;
}

function detailsMarkup(movie) {
  const characterItems = movie.characters.map((character, index) => `<li class="cast-member"><span class="cast-number">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(character.name)}</h3><p>${escapeHtml(character.description || "A character in this story.")}</p></div></li>`).join("");
  return `<section class="movie-detail-hero">
    <div class="detail-poster"><img src="${posterFor(movie)}" alt="Poster for ${escapeHtml(movie.title)}" onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"><span class="poster-frame-label">MINIMOVIE ORIGINAL</span></div>
    <div class="detail-intro"><p class="eyebrow">${escapeHtml(movie.genre)} · ${Number(movie.duration)} MINUTES</p><h1>${escapeHtml(movie.title)}</h1><div class="detail-tags"><span>${escapeHtml(movie.mood)} mood</span><span>Created ${escapeHtml(formatDate(movie.created_at))}</span></div><p class="detail-plot">${escapeHtml(movie.plot)}</p><div class="detail-actions"><a class="button button-primary" href="/create?edit=${movie.id}">✎ Edit movie</a><button class="button button-danger" id="delete-movie" type="button">Delete movie</button></div><div id="details-message" class="message" role="status" aria-live="polite"></div></div>
  </section>${playerMarkup(movie)}
  <div class="details-content-grid"><section class="detail-section"><div class="detail-section-heading"><p class="eyebrow">THE PEOPLE IN THE PICTURE</p><h2>Meet the characters</h2></div><ul class="cast-list">${characterItems}</ul></section>
  <section class="detail-section script-section"><div class="script-heading"><div><p class="eyebrow">FIRST DRAFT, YOUR WAY</p><h2>Screenplay</h2></div><span class="script-mark">▤</span></div><p class="script-intro">A rule-based starting point built from the details you added. Keep shaping it into your own script.</p><div id="script-output" class="script-output ${movie.script ? "has-script" : ""}">${movie.script ? escapeHtml(movie.script) : `<div class="script-empty"><span>✦</span><p>Your screenplay draft will appear here.</p></div>`}</div><div class="script-actions"><button class="button button-primary" id="generate-script" type="button"><span>✧</span> ${movie.script ? "Regenerate Script" : "Generate Script"}</button><button class="button button-outline" id="copy-script" type="button" ${movie.script ? "" : "disabled"}>▢ Copy Script</button></div></section></div>`;
}

function drawMovieFrame(context, movie, seconds) {
  const width = 1280;
  const height = 720;
  const scenes = [
    { label: "THE IDEA", line: movie.plot },
    { label: "MEET THE CAST", line: `${movie.characters[0]?.name || "The lead"} steps into the story.` },
    { label: "THE TURN", line: `${movie.genre} brings an unexpected challenge.` },
    { label: "THE CHOICE", line: movie.characters.length > 1
      ? `${movie.characters[0].name} and ${movie.characters[1].name} decide what matters most.`
      : `${movie.characters[0]?.name || "The hero"} finds the courage to choose.` },
    { label: "THE LAST SHOT", line: `${movie.mood} is the feeling that stays after the final scene.` }
  ];
  const sceneIndex = Math.min(4, Math.floor(seconds / 5.2));
  const scene = scenes[sceneIndex];
  const colorsByGenre = {
    Action: ["#35172b", "#ed805e", "#202248"], Comedy: ["#432536", "#f7ad68", "#1c4750"],
    Romance: ["#54223d", "#ef9d9e", "#332a52"], Thriller: ["#111d35", "#7998a7", "#20182e"],
    Horror: ["#161b28", "#829a7b", "#382137"], "Sci-Fi": ["#142747", "#60d4d0", "#422456"],
    Drama: ["#26354b", "#edb27b", "#372940"]
  };
  const colors = colorsByGenre[movie.genre] || colorsByGenre.Drama;
  const progress = seconds / 26;
  const fade = Math.min(1, seconds * 1.5, (26 - seconds) * 1.5);
  const sky = context.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, colors[0]);
  sky.addColorStop(.56, colors[1]);
  sky.addColorStop(1, colors[2]);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(900 + Math.sin(seconds * .2) * 50, 240, 10, 900, 240, 480);
  glow.addColorStop(0, `${colors[1]}aa`);
  glow.addColorStop(1, `${colors[1]}00`);
  context.fillStyle = glow;
  context.fillRect(300, 0, 980, 620);

  context.globalAlpha = .22;
  for (let index = 0; index < 7; index += 1) {
    const x = ((index * 233 + seconds * (12 + index * 2)) % (width + 180)) - 100;
    const y = 95 + (index * 71) % 260 + Math.sin(seconds * .45 + index) * 12;
    context.fillStyle = index % 2 ? "#fce4d4" : "#d0f4f0";
    context.beginPath();
    context.ellipse(x, y, 62 + index * 5, 13 + index % 3 * 4, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.fillStyle = "#111523";
  context.beginPath();
  context.moveTo(0, 475);
  for (let x = 0; x <= width; x += 80) context.lineTo(x, 435 + Math.sin(x * .009 + sceneIndex) * 34);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  for (let index = 0; index < 8; index += 1) {
    const x = index * 172 - 24;
    const buildingHeight = 125 + (index * 57) % 105;
    context.fillStyle = "#11121c";
    context.fillRect(x, 492 - buildingHeight, 116, buildingHeight + 150);
    context.fillStyle = `${colors[1]}55`;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        context.fillRect(x + 15 + column * 31, 505 - buildingHeight + row * 30, 10, 13);
      }
    }
  }

  context.fillStyle = "#171722";
  context.beginPath();
  context.moveTo(0, 592);
  context.lineTo(width, 546);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();
  context.strokeStyle = `${colors[1]}66`;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 592);
  context.lineTo(width, 546);
  context.stroke();

  const cast = movie.characters.slice(0, 3);
  const castStart = width / 2 - ((cast.length - 1) * 160) / 2;
  cast.forEach((character, index) => {
    const bounce = Math.sin(seconds * 2.1 + index * 1.8) * 7;
    const x = castStart + index * 160;
    const y = 498 + bounce + Math.sin(progress * Math.PI * 2 + index) * 6;
    const tint = ["#f0a5b5", "#e7b778", "#83cecc"][index];
    context.fillStyle = "rgba(0,0,0,.24)";
    context.beginPath();
    context.ellipse(x, 613, 56, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = tint;
    context.beginPath();
    context.arc(x, y, 27, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#201a27";
    context.beginPath();
    context.roundRect(x - 37, y + 29, 74, 94, 22);
    context.fill();
    context.fillStyle = "rgba(255,255,255,.9)";
    context.font = "600 17px 'DM Sans', sans-serif";
    context.textAlign = "center";
    context.fillText(character.name.slice(0, 22), x, y + 151);
  });

  const vignette = context.createRadialGradient(width / 2, height / 2, 150, width / 2, height / 2, 760);
  vignette.addColorStop(.45, "rgba(5,5,12,0)");
  vignette.addColorStop(1, "rgba(5,5,12,.72)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = fade;
  context.fillStyle = "rgba(7,7,13,.52)";
  context.fillRect(0, 0, width, height);
  context.textAlign = "center";
  context.fillStyle = "#f7e9dd";
  context.font = "600 17px 'DM Sans', sans-serif";
  context.fillText(`SCENE 0${sceneIndex + 1}  /  ${scene.label}`, width / 2, 177);
  context.font = "600 48px 'Space Grotesk', sans-serif";
  context.fillText(movie.title.slice(0, 36), width / 2, 238);
  context.fillStyle = "#fff";
  context.font = "500 21px 'DM Sans', sans-serif";
  const caption = scene.line.length > 115 ? `${scene.line.slice(0, 112).trim()}…` : scene.line;
  context.fillText(caption, width / 2, 285, 1050);
  context.globalAlpha = 1;
}

function initMoviePlayer(movie) {
  const canvas = document.querySelector("#movie-canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const duration = 26;
  const playButton = document.querySelector("#play-toggle");
  const stageButton = document.querySelector("#stage-play");
  const seek = document.querySelector("#player-seek");
  const timeLabel = document.querySelector("#player-time");
  const sceneLabel = document.querySelector("#scene-indicator");
  const status = document.querySelector("#player-status");
  const stage = document.querySelector("#video-stage");
  const recordButton = document.querySelector("#download-video");
  let currentTime = 0;
  let lastFrame = 0;
  let animationId = 0;
  let isPlaying = false;
  let recorder = null;
  let recordedChunks = [];

  function render() {
    drawMovieFrame(context, movie, currentTime);
    seek.value = String(Math.round((currentTime / duration) * Number(seek.max)));
    timeLabel.textContent = `00:${String(Math.floor(currentTime)).padStart(2, "0")}`;
    sceneLabel.textContent = ["THE IDEA", "MEET THE CAST", "THE TURN", "THE CHOICE", "THE LAST SHOT"][Math.min(4, Math.floor(currentTime / 5.2))];
    playButton.textContent = isPlaying ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label", isPlaying ? "Pause preview" : "Play preview");
    stageButton.parentElement.classList.toggle("is-hidden", isPlaying);
  }

  function tick(timestamp) {
    if (!isPlaying) return;
    if (lastFrame) currentTime += (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    if (currentTime >= duration) {
      currentTime = duration;
      isPlaying = false;
      lastFrame = 0;
      render();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      else status.textContent = "Preview finished. Press play to watch again.";
      return;
    }
    render();
    animationId = window.requestAnimationFrame(tick);
  }

  function play() {
    if (currentTime >= duration) currentTime = 0;
    if (isPlaying) return;
    isPlaying = true;
    lastFrame = 0;
    status.textContent = "Playing your animated movie preview…";
    render();
    animationId = window.requestAnimationFrame(tick);
  }

  function pause() {
    isPlaying = false;
    lastFrame = 0;
    window.cancelAnimationFrame(animationId);
    render();
    if (!recorder || recorder.state === "inactive") status.textContent = "Preview paused. Press play to continue.";
  }

  playButton.addEventListener("click", () => isPlaying ? pause() : play());
  stageButton.addEventListener("click", play);
  seek.addEventListener("input", () => {
    currentTime = Number(seek.value) / Number(seek.max) * duration;
    lastFrame = 0;
    render();
  });
  document.querySelector("#fullscreen-toggle").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await stage.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      status.textContent = "Fullscreen is not available in this browser.";
    }
  });
  recordButton.addEventListener("click", () => {
    if (!window.MediaRecorder || !canvas.captureStream) {
      status.textContent = "Video export is not supported by this browser. You can still play the preview here.";
      return;
    }
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      status.textContent = "This browser cannot create a WebM download. You can still play the preview here.";
      return;
    }
    try {
      recordedChunks = [];
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) recordedChunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        const video = new Blob(recordedChunks, { type: mimeType });
        if (!video.size) {
          status.textContent = "The video could not be encoded. Try another browser.";
          recordButton.disabled = false;
          return;
        }
        const downloadUrl = URL.createObjectURL(video);
        const link = document.createElement("a");
        const safeTitle = movie.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mini-movie";
        link.href = downloadUrl;
        link.download = `${safeTitle}-preview.webm`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
        status.textContent = "Your WebM video is ready and downloading.";
        recordButton.disabled = false;
        recordButton.textContent = "↓ Download video";
      });
      recorder.start(250);
      recordButton.disabled = true;
      recordButton.textContent = "Recording preview…";
      currentTime = 0;
      render();
      play();
      status.textContent = "Recording the 26-second animated preview. Keep this page open until it finishes.";
    } catch (error) {
      recordButton.disabled = false;
      recordButton.textContent = "↓ Download video";
      status.textContent = "The browser could not start video recording. You can still play the preview here.";
    }
  });
  render();
}

async function initDetails() {
  const root = document.querySelector("#details-root");
  const movieId = document.body.dataset.movieId;
  try {
    let movie = await apiRequest(`${API_URL}/${encodeURIComponent(movieId)}`);
    document.title = `${movie.title} | MiniMovie`;
    root.innerHTML = detailsMarkup(movie);
    initMoviePlayer(movie);
    const message = document.querySelector("#details-message");
    document.querySelector("#delete-movie").addEventListener("click", async (event) => {
      if (!window.confirm(`Delete “${movie.title}”? This cannot be undone.`)) return;
      event.currentTarget.disabled = true;
      try {
        await apiRequest(`${API_URL}/${encodeURIComponent(movieId)}`, { method: "DELETE" });
        window.location.assign("/library");
      } catch (error) {
        event.currentTarget.disabled = false;
        showMessage(message, error.message);
      }
    });
    const generateButton = document.querySelector("#generate-script");
    generateButton.addEventListener("click", async () => {
      generateButton.disabled = true;
      generateButton.textContent = "Writing your first draft...";
      try {
        movie = await apiRequest(`${API_URL}/${encodeURIComponent(movieId)}/generate-script`, { method: "POST" });
        document.querySelector("#script-output").textContent = movie.script;
        document.querySelector("#script-output").classList.add("has-script");
        document.querySelector("#copy-script").disabled = false;
        generateButton.innerHTML = "✧ Regenerate Script";
        showMessage(message, "Your screenplay draft is ready and saved.", "success");
      } catch (error) {
        generateButton.textContent = "Generate Script";
        showMessage(message, error.message);
      } finally {
        generateButton.disabled = false;
      }
    });
    document.querySelector("#copy-script").addEventListener("click", async (event) => {
      if (!movie.script) return;
      try {
        await navigator.clipboard.writeText(movie.script);
        event.currentTarget.textContent = "✓ Copied";
        window.setTimeout(() => { event.currentTarget.textContent = "▢ Copy Script"; }, 1800);
      } catch (error) {
        showMessage(message, "Clipboard access is unavailable. Select and copy the screenplay text instead.");
      }
    });
  } catch (error) {
    root.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h2>We couldn't find that movie</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/library">Return to library</a></div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "create") initCreate();
  if (page === "library") initLibrary();
  if (page === "details") initDetails();
});