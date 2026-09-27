const DURATIONS = { focus: [30, 60, 180], break: [5, 15] };
const RADIUS = 145;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STORAGE_KEY = "pomodoro-minimal-v1";

const elements = {
  timer: document.querySelector(".timer"), progress: document.querySelector("#progressCircle"),
  time: document.querySelector("#timeDisplay"), status: document.querySelector("#timerStatus"),
  start: document.querySelector("#startButton"), startText: document.querySelector("#startText"),
  reset: document.querySelector("#resetButton"),
  modeButtons: [...document.querySelectorAll(".mode-switch button")],
  presetGroups: [...document.querySelectorAll(".presets")],
  presets: [...document.querySelectorAll(".presets button")],
};

const readPreferences = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
};
const preferences = readPreferences();
let mode = preferences.mode === "break" ? "break" : "focus";
let focusMinutes = DURATIONS.focus.includes(preferences.focusMinutes) ? preferences.focusMinutes : 30;
let breakMinutes = DURATIONS.break.includes(preferences.breakMinutes) ? preferences.breakMinutes : 5;
let minutes = mode === "focus" ? focusMinutes : breakMinutes;
let totalSeconds = minutes * 60;
let remainingSeconds = totalSeconds;
let running = false;
let endTime = 0;
let intervalId;

const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, focusMinutes, breakMinutes })); }
  catch { /* Persistence is optional. */ }
};
const formatTime = (value) => {
  const seconds = Math.max(0, Math.ceil(value));
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours ? `${String(hours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
};
const render = () => {
  const value = formatTime(remainingSeconds);
  elements.time.textContent = value;
  elements.time.dateTime = `PT${Math.ceil(remainingSeconds)}S`;
  elements.time.classList.toggle("long", value.length > 5);
  elements.progress.style.strokeDashoffset = CIRCUMFERENCE * (1 - remainingSeconds / totalSeconds);
  elements.timer.classList.toggle("running", running);
  elements.startText.textContent = running ? "pause" : remainingSeconds < totalSeconds ? "resume" : "start";
  elements.status.textContent = running ? "Timer running" : remainingSeconds < totalSeconds ? "Timer paused" : "Timer ready";
  document.title = running ? `${value} · Pomodoro` : "Pomodoro";
};
const finish = () => {
  running = false;
  clearInterval(intervalId);
  remainingSeconds = 0;
  render();
  elements.startText.textContent = "again";
  elements.status.textContent = "Session complete";
  document.title = "Done · Pomodoro";
};
const tick = () => {
  remainingSeconds = Math.max(0, (endTime - Date.now()) / 1000);
  render();
  if (remainingSeconds <= 0) finish();
};
const toggle = () => {
  if (running) {
    remainingSeconds = Math.max(0, (endTime - Date.now()) / 1000);
    running = false;
    clearInterval(intervalId);
  } else {
    if (remainingSeconds <= 0) remainingSeconds = totalSeconds;
    running = true;
    endTime = Date.now() + remainingSeconds * 1000;
    clearInterval(intervalId);
    intervalId = setInterval(tick, 250);
  }
  render();
};
const reset = () => {
  running = false;
  clearInterval(intervalId);
  remainingSeconds = totalSeconds;
  render();
};
const selectDuration = (nextMinutes) => {
  minutes = nextMinutes;
  if (mode === "focus") focusMinutes = minutes;
  else breakMinutes = minutes;
  totalSeconds = minutes * 60;
  elements.presets.forEach((button) => {
    const active = button.dataset.mode === mode && Number(button.dataset.minutes) === minutes;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  save();
  reset();
};

const selectMode = (nextMode) => {
  mode = nextMode;
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.presetGroups.forEach((group) => {
    group.hidden = group.id !== `${mode}Presets`;
  });
  selectDuration(mode === "focus" ? focusMinutes : breakMinutes);
};

elements.progress.style.strokeDasharray = String(CIRCUMFERENCE);
elements.start.addEventListener("click", toggle);
elements.reset.addEventListener("click", reset);
elements.presets.forEach((button) => button.addEventListener("click", () => selectDuration(Number(button.dataset.minutes))));
elements.modeButtons.forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "Space") { event.preventDefault(); toggle(); }
  else if (event.key.toLowerCase() === "r") reset();
  else if (["1","2","3"].includes(event.key) && mode === "focus") selectDuration(DURATIONS.focus[Number(event.key) - 1]);
});
document.addEventListener("visibilitychange", () => { if (running && !document.hidden) tick(); });

selectMode(mode);
