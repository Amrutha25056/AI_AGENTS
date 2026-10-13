const messages = document.querySelector("#messages");
const controls = document.querySelector("#controls");
const notice = document.querySelector("#notice");
const stepIndicator = document.querySelector("#step-indicator");
const planResults = document.querySelector("#plan-results");
const planSummary = document.querySelector("#plan-summary");
const schedule = document.querySelector("#schedule");
const snapshotContent = document.querySelector("#snapshot-content");
const startOverButton = document.querySelector("#start-over");

let subjectOptions = [];
let currentStep = "subjects";
let selectedSubjects = [];
let examDays = null;
let studyHours = null;
let submitting = false;

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}-message`;

  const speaker = document.createElement("span");
  speaker.className = "message-speaker";
  speaker.textContent = role === "assistant" ? "STUDY BUDDY" : "YOU";

  const content = document.createElement("p");
  content.textContent = text;

  article.append(speaker, content);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function setNotice(text = "") {
  notice.textContent = text;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function addStepHeader(form, kicker, title, description) {
  form.append(
    makeElement("p", "control-kicker", kicker),
    makeElement("h2", "control-title", title),
    makeElement("p", "control-description", description),
  );
}

function addActions(form, primaryText, includeBack = false) {
  const actions = makeElement("div", "step-actions");
  if (includeBack) {
    const back = makeElement("button", "secondary-button", "← Back");
    back.type = "button";
    back.dataset.action = "back";
    actions.append(back);
  } else {
    actions.append(makeElement("span", ""));
  }

  const next = makeElement("button", "primary-button", primaryText);
  next.type = "submit";
  actions.append(next);
  form.append(actions);
}

function renderStep() {
  controls.replaceChildren();
  controls.hidden = false;
  planResults.hidden = true;
  setNotice();

  const form = makeElement("form", "step-form");
  form.noValidate = true;
  form.addEventListener("submit", handleStepSubmit);

  if (currentStep === "subjects") {
    stepIndicator.textContent = "STEP 1 OF 3";
    addStepHeader(
      form,
      "FIRST, THE SUBJECTS",
      "What are you studying?",
      "Choose one or more from the subjects in your planner.",
    );

    const options = makeElement("div", "subject-options");
    subjectOptions.forEach((subject) => {
      const label = makeElement("label", "subject-option");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "subjects";
      checkbox.value = subject.name;
      checkbox.checked = selectedSubjects.includes(subject.name);

      const glyph = makeElement("span", "subject-glyph", subject.name.slice(0, 1));
      glyph.setAttribute("aria-hidden", "true");
      const copy = makeElement("span", "subject-copy");
      const name = subject.name === "JAVA" ? "Java" : subject.name;
      copy.append(
        makeElement("strong", "", name),
        makeElement("small", "", `${subject.topics.length} topics`),
      );
      label.append(checkbox, glyph, copy);
      options.append(label);
    });
    form.append(options);
    addActions(form, "Next · exam date");
  } else if (currentStep === "days") {
    stepIndicator.textContent = "STEP 2 OF 3";
    addStepHeader(
      form,
      "YOUR EXAM WINDOW",
      "How many days do we have?",
      "Count the days from today until your exam.",
    );
    addNumberField(form, "days", "Days until your exam", "days", 1, 365, 1, examDays);
    addActions(form, "Next · daily study time", true);
  } else {
    stepIndicator.textContent = "STEP 3 OF 3";
    addStepHeader(
      form,
      "A REALISTIC RHYTHM",
      "How long can you study each day?",
      "Choose the time you can actually make space for, up to 24 hours.",
    );
    addNumberField(form, "hours", "Available study time", "hours per day", 0.01, 24, 0.1, studyHours);
    addActions(form, submitting ? "Making your plan…" : "Generate my study plan", true);
    if (submitting) form.querySelector("button[type='submit']").disabled = true;
  }

  controls.append(form);
}

function addNumberField(form, id, labelText, suffix, min, max, step, value) {
  const label = makeElement("label", "field-wrap");
  label.htmlFor = id;
  label.append(makeElement("span", "", labelText));

  const field = makeElement("span", "number-field");
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.type = "number";
  input.required = true;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.inputMode = "decimal";
  input.placeholder = "0";
  if (value !== null) input.value = String(value);

  field.append(input, makeElement("span", "number-suffix", suffix));
  label.append(field);
  form.append(label);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}

async function readJson(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
  if (!response.ok) {
    throw new Error(body.error || "Something went wrong. Please try again.");
  }
  return body;
}

async function loadSubjects() {
  controls.replaceChildren(makeElement("p", "control-description", "Getting the subject list…"));
  try {
    const response = await fetch("/api/subjects");
    const data = await readJson(response);
    subjectOptions = data.subjects;
    renderStep();
  } catch (error) {
    controls.replaceChildren();
    const message = makeElement("p", "control-description", error.message);
    const retry = makeElement("button", "secondary-button", "Try loading again");
    retry.type = "button";
    retry.addEventListener("click", loadSubjects);
    controls.append(message, retry);
  }
}

async function handleStepSubmit(event) {
  event.preventDefault();
  if (submitting) return;
  setNotice();

  if (currentStep === "subjects") {
    selectedSubjects = [...controls.querySelectorAll("input[name='subjects']:checked")]
      .map((input) => input.value);
    if (selectedSubjects.length === 0) {
      setNotice("Choose at least one subject to continue.");
      return;
    }
    const readableSubjects = selectedSubjects.map((subject) => (
      subject === "JAVA" ? "Java" : subject
    ));
    addMessage("user", readableSubjects.join(", "));
    currentStep = "days";
    addMessage("assistant", "Got it. How many days are left until your exam?");
    renderStep();
    return;
  }

  const input = controls.querySelector("input[type='number']");
  const value = Number(input.value);
  if (!input.value || !Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) {
    setNotice(`Enter a value from ${input.min} to ${input.max}.`);
    input.focus();
    return;
  }

  if (currentStep === "days") {
    if (!Number.isInteger(value)) {
      setNotice("Days must be a whole number.");
      input.focus();
      return;
    }
    examDays = value;
    addMessage("user", `${examDays} ${examDays === 1 ? "day" : "days"} until the exam.`);
    currentStep = "hours";
    addMessage("assistant", "Thanks. How many hours can you study on a typical day?");
    renderStep();
    return;
  }

  studyHours = value;
  addMessage("user", `${studyHours} ${studyHours === 1 ? "hour" : "hours"} each day.`);
  addMessage("assistant", "I'm arranging your subjects across the days you have.");
  await generatePlan();
}

async function generatePlan() {
  if (submitting) return;
  submitting = true;
  startOverButton.disabled = true;
  renderStep();
  const submitButton = controls.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Making your plan…";
  }

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjects: selectedSubjects,
        days: examDays,
        hours_per_day: studyHours,
      }),
    });
    const data = await readJson(response);
    displayPlan(data.plan);
    controls.hidden = true;
    planResults.hidden = false;
    addMessage("assistant", "Your plan is ready. You can adjust the inputs and generate another one whenever your schedule changes.");
    planResults.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    submitting = false;
    addMessage("assistant", error.message);
    currentStep = "hours";
    renderStep();
  } finally {
    submitting = false;
    startOverButton.disabled = false;
  }
}

function displayPlan(plan) {
  planSummary.replaceChildren();
  const summaryItems = [
    `${plan.topic_count} topics`,
    `${plan.schedule.length} ${plan.schedule.length === 1 ? "day" : "days"}`,
    `${plan.hours_per_day} ${plan.hours_per_day === 1 ? "hour" : "hours"} per day`,
  ];
  plan.subjects.forEach((subject) => {
    summaryItems.push(subject === "JAVA" ? "Java" : subject);
  });
  summaryItems.forEach((text) => planSummary.append(makeElement("span", "summary-pill", text)));

  schedule.replaceChildren();
  plan.schedule.forEach((day) => {
    const card = makeElement("article", "day-card");
    const heading = makeElement("div", "day-heading");
    heading.append(
      makeElement("h3", "", `Day ${day.day}`),
      makeElement("span", "", `${day.tasks.length} ${day.tasks.length === 1 ? "task" : "tasks"}`),
    );

    const taskList = makeElement("ul", "task-list");
    day.tasks.forEach((task) => {
      const row = makeElement("li", "task-row");
      row.dataset.kind = task.kind;
      row.append(makeElement("span", "task-dot"));

      const text = makeElement("span", "task-text");
      if (task.subject) {
        text.append(makeElement("span", "task-subject", task.subject));
      }
      text.append(document.createTextNode(task.topic));

      const duration = task.hours === null
        ? "Flexible"
        : `${task.hours} ${task.hours === 1 ? "hr" : "hrs"}`;
      row.append(text, makeElement("span", "task-duration", duration));
      taskList.append(row);
    });

    card.append(heading, taskList);
    schedule.append(card);
  });

  snapshotContent.replaceChildren();
  const stats = makeElement("div", "snapshot-stats");
  stats.append(
    makeSnapshotStat(String(plan.subjects.length), "subjects"),
    makeSnapshotStat(String(plan.topic_count), "topics"),
    makeSnapshotStat(String(plan.schedule.length), "planned days"),
    makeSnapshotStat(`${plan.hours_per_day}`, "hours each day"),
  );
  snapshotContent.append(stats);
  snapshotContent.append(
    makeElement(
      "p",
      "snapshot-subjects",
      plan.subjects.map((subject) => subject === "JAVA" ? "Java" : subject).join(" · "),
    ),
  );
  document.querySelector("#snapshot").classList.add("has-plan");
}

function makeSnapshotStat(value, label) {
  const stat = makeElement("div", "snapshot-stat");
  stat.append(makeElement("strong", "", value), makeElement("span", "", label));
  return stat;
}

function startOver() {
  selectedSubjects = [];
  examDays = null;
  studyHours = null;
  currentStep = "subjects";
  submitting = false;
  messages.replaceChildren();
  addMessage("assistant", "Hi! Let's make a study plan that feels doable. Which subjects are you preparing for?");
  planSummary.replaceChildren();
  schedule.replaceChildren();
  planResults.hidden = true;
  document.querySelector("#snapshot").classList.remove("has-plan");
  snapshotContent.replaceChildren(
    makeElement("p", "snapshot-empty", "Nothing planned yet. Your overview will appear here after we build a schedule."),
  );
  renderStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

controls.addEventListener("click", (event) => {
  if (event.target.closest("[data-action='back']")) {
    setNotice();
    currentStep = currentStep === "hours" ? "days" : "subjects";
    renderStep();
  }
});

startOverButton.addEventListener("click", startOver);
loadSubjects();