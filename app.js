const DURATIONS = [30, 60, 180];
const RADIUS = 174;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PREFS_KEY = "pomodoro-prefs-v1";
const STATS_KEY = "pomodoro-stats-v1";

const $ = (selector) => document.querySelector(selector);
const elements = {
  panel: $(".timer-panel"), progress: $("#progressCircle"), time: $("#timeDisplay"),
  state: $("#timerState"), caption: $("#timerCaption"), label: $("#sessionLabel"),
  number: $("#sessionNumber"), start: $("#startButton"), startText: $("#startText"),
  reset: $("#resetButton"), presets: [...document.querySelectorAll(".preset")],
  sound: $("#soundButton"), theme: $("#themeButton"), dailyTime: $("#dailyTime"),
  sessionCount: $("#sessionCount"), momentum: $("#momentumProgress"), toast: $("#toast"),
};

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
};
const dateKey = () => new Date().toLocaleDateString("en-CA");
const prefs = read(PREFS_KEY, {});
let selectedMinutes = DURATIONS.includes(prefs.duration) ? prefs.duration : 30;
let totalSeconds = selectedMinutes * 60;
let remainingSeconds = totalSeconds;
let running = false;
let endTime = 0;
let intervalId;
let toastId;
let audioContext;
let soundEnabled = prefs.sound !== false;
let theme = prefs.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
let stats = read(STATS_KEY, { date: dateKey(), minutes: 0, sessions: 0 });
if (stats.date !== dateKey()) stats = { date: dateKey(), minutes: 0, sessions: 0 };

const savePrefs = () => write(PREFS_KEY, { duration: selectedMinutes, sound: soundEnabled, theme });
const format = (value) => {
  const seconds = Math.max(0, Math.ceil(value));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const caption = () => selectedMinutes === 60 ? "1 hour deep work" : selectedMinutes === 180 ? "3 hour immersion" : "30 minute focus";

function showToast(message) {
  clearTimeout(toastId);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastId = setTimeout(() => elements.toast.classList.remove("show"), 2100);
}

function updateStats() {
  elements.dailyTime.textContent = stats.minutes >= 60 ? `${Math.floor(stats.minutes / 60)}h ${stats.minutes % 60}m` : `${stats.minutes} min`;
  elements.sessionCount.textContent = stats.sessions;
  elements.number.textContent = String(stats.sessions + 1).padStart(2, "0");
  elements.momentum.style.width = `${Math.min(100, stats.minutes / 180 * 100)}%`;
}

function render() {
  const progress = remainingSeconds / totalSeconds;
  elements.time.textContent = format(remainingSeconds);
  elements.time.dateTime = `PT${Math.ceil(remainingSeconds)}S`;
  elements.progress.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  elements.caption.textContent = caption();
  elements.panel.classList.toggle("running", running);
  if (running) {
    elements.state.textContent = "Focus in progress";
    elements.startText.textContent = "Pause";
    document.title = `${format(remainingSeconds)} · Pomodoro`;
  } else {
    elements.state.textContent = remainingSeconds < totalSeconds ? "Session paused" : "Ready when you are";
    elements.startText.textContent = remainingSeconds < totalSeconds ? "Resume focus" : "Start focus";
    document.title = "Pomodoro — Make time count";
  }
}

function prepareAudio() {
  if (!soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function chime() {
  prepareAudio();
  if (!audioContext) return;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + index * .16;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(.14, start + .02);
    gain.gain.exponentialRampToValueAtTime(.001, start + .65);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + .7);
  });
}

function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["var(--accent)", "#ffbd79", "#8da8ff", "var(--text)"];
  for (let i = 0; i < 28; i += 1) {
    const dot = document.createElement("i");
    const angle = Math.PI * 2 * i / 28;
    const distance = 110 + Math.random() * 180;
    dot.className = "confetti";
    dot.style.cssText = `--x:${Math.cos(angle) * distance}px;--y:${Math.sin(angle) * distance}px;--r:${Math.random() * 400}deg;background:${colors[i % 4]}`;
    document.body.append(dot);
    setTimeout(() => dot.remove(), 1000);
  }
}

function complete() {
  running = false;
  clearInterval(intervalId);
  remainingSeconds = 0;
  stats.minutes += selectedMinutes;
  stats.sessions += 1;
  write(STATS_KEY, stats);
  updateStats();
  render();
  elements.state.textContent = "Session complete";
  elements.startText.textContent = "Start again";
  elements.label.textContent = "Nicely done";
  document.title = "Session complete · Pomodoro";
  chime(); celebrate(); showToast("Focus session complete — nice work!");
}

function tick() {
  remainingSeconds = Math.max(0, (endTime - Date.now()) / 1000);
  render();
  if (remainingSeconds <= 0) complete();
}

function toggleTimer() {
  if (running) {
    remainingSeconds = Math.max(0, (endTime - Date.now()) / 1000);
    running = false;
    clearInterval(intervalId);
  } else {
    if (remainingSeconds <= 0) remainingSeconds = totalSeconds;
    elements.label.textContent = "Focus session";
    running = true;
    endTime = Date.now() + remainingSeconds * 1000;
    clearInterval(intervalId);
    intervalId = setInterval(tick, 250);
  }
  render();
}

function reset(announce = true) {
  running = false;
  clearInterval(intervalId);
  remainingSeconds = totalSeconds;
  elements.label.textContent = "Focus session";
  render();
  if (announce) showToast("Timer reset");
}

function selectDuration(minutes, announce = true) {
  selectedMinutes = minutes;
  totalSeconds = minutes * 60;
  elements.presets.forEach((button) => {
    const active = Number(button.dataset.minutes) === minutes;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active);
  });
  savePrefs(); reset(false);
  if (announce) showToast(`${minutes === 60 ? "1 hour" : minutes === 180 ? "3 hours" : "30 minutes"} selected`);
}

function setTheme(next) {
  theme = next;
  document.documentElement.dataset.theme = theme;
  elements.theme.ariaLabel = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
  savePrefs();
}

elements.progress.style.strokeDasharray = CIRCUMFERENCE;
elements.start.addEventListener("click", () => { prepareAudio(); toggleTimer(); });
elements.reset.addEventListener("click", () => reset());
elements.presets.forEach((button) => button.addEventListener("click", () => selectDuration(Number(button.dataset.minutes))));
elements.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  elements.sound.setAttribute("aria-pressed", soundEnabled);
  elements.sound.ariaLabel = soundEnabled ? "Mute sound" : "Turn sound on";
  savePrefs(); showToast(soundEnabled ? "Sound on" : "Sound muted");
});
elements.theme.addEventListener("click", () => setTheme(theme === "dark" ? "light" : "dark"));
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); prepareAudio(); toggleTimer(); }
  else if (event.key.toLowerCase() === "r") reset();
  else if (["1", "2", "3"].includes(event.key)) selectDuration(DURATIONS[Number(event.key) - 1]);
});
document.addEventListener("visibilitychange", () => { if (running && !document.hidden) tick(); });

setTheme(theme);
elements.sound.setAttribute("aria-pressed", soundEnabled);
selectDuration(selectedMinutes, false);
updateStats();
