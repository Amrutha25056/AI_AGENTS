"use strict";

const DESTINATIONS_API = "/api/destinations";
const MEMORY_API = "/api/memory";
const PLAN_API = "/api/plan";
const APPROVAL_API = "/api/booking-approval";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function rupees(value) {
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function displayPreference(value) {
  return typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "";
}

function showMessage(element, message, kind = "error") {
  element.textContent = message;
  element.className = `message is-visible ${kind}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message";
}

function attractionMarkup(attraction) {
  const isOpen = Boolean(attraction.open);
  const statusText = isOpen ? "Open in sample data" : "Closed in sample data";
  return `<li class="attraction-row"><span class="attraction-marker ${Number(attraction.cost) === 0 ? "free-marker" : ""}" aria-hidden="true">${Number(attraction.cost) === 0 ? "✳" : "•"}</span><span class="attraction-name">${escapeHtml(attraction.name)}${Number(attraction.cost) === 0 ? '<small>FREE</small>' : ""}</span><span class="attraction-cost">${rupees(attraction.cost)}</span><span class="attraction-status ${isOpen ? "status-open" : "status-closed"}">${statusText}</span></li>`;
}

function renderDestinations(data) {
  const grid = document.querySelector("#destination-grid");
  const select = document.querySelector("#destination");
  const names = Object.keys(data);
  if (!names.length) throw new Error("No local destinations are configured.");

  select.innerHTML = '<option value="">Choose a destination</option>' + names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  const savedPreference = displayPreference(window.travelMateMemory?.preferences?.travel_style);
  if (["Nature", "History", "Relaxation"].includes(savedPreference)) {
    document.querySelector("#preference").value = savedPreference;
  }

  grid.innerHTML = names.map((name, index) => {
    const attractions = data[name];
    const availableCount = attractions.filter((place) => place.open).length;
    return `<article class="destination-card" style="--card-index:${index}"><div class="destination-card-head"><div><span class="destination-kicker">SAMPLE STOP 0${index + 1}</span><h3>${escapeHtml(name)}</h3></div><span class="destination-icon" aria-hidden="true">${name === "Mysuru" ? "⌂" : "⌁"}</span></div><ul class="attraction-list">${attractions.map(attractionMarkup).join("")}</ul><div class="destination-card-footer"><span>${availableCount} attractions marked open in sample data</span><button type="button" class="choose-destination" data-destination="${escapeHtml(name)}">Plan this trip <span aria-hidden="true">↗</span></button></div></article>`;
  }).join("");

  grid.querySelectorAll(".choose-destination").forEach((button) => {
    button.addEventListener("click", () => {
      const customDestination = document.querySelector("#destination-custom");
      customDestination.value = "";
      select.value = button.dataset.destination;
      document.querySelector("#planner").scrollIntoView({ behavior: "smooth" });
      select.focus({ preventScroll: true });
    });
  });
}

function renderMemory(memory) {
  const container = document.querySelector("#memory-content");
  const trip = memory.last_trip;
  if (!trip || !trip.destination) {
    container.innerHTML = `<div class="memory-empty"><span aria-hidden="true">⌂</span><div><h3>No saved trip yet</h3><p>Generate a trip plan and it will be remembered here.</p></div></div>`;
    return;
  }
  container.innerHTML = `<div class="memory-details"><span class="memory-destination">${escapeHtml(trip.destination)}</span><div class="memory-stats"><div><span>TRIP LENGTH</span><strong>${Number(trip.days)} days</strong></div><div><span>BUDGET</span><strong>${rupees(trip.budget)}</strong></div><div><span>STYLE</span><strong>${escapeHtml(displayPreference(trip.preference))}</strong></div><div><span>ESTIMATED TOTAL</span><strong>${rupees(trip.estimated_cost)}</strong></div></div></div>`;
}

function renderPlan(plan) {
  const results = document.querySelector("#plan-results");
  const banner = document.querySelector("#budget-banner");
  const budgetCards = document.querySelector("#budget-cards");
  const breakdown = plan.budget_breakdown;
  const initialTotal = plan.initial_budget.total;
  const difference = Number(breakdown.budget) - Number(plan.estimated_total);
  const budget = Number(breakdown.budget);
  const ratio = budget > 0 ? Math.min(100, (Number(plan.estimated_total) / budget) * 100) : 0;
  const budgetMessage = plan.within_budget
    ? `${rupees(Math.max(0, difference))} remaining in your estimate`
    : `${rupees(Math.abs(difference))} over the entered budget`;

  document.querySelector("#results-heading").textContent = `${plan.destination}, ${plan.days} ${plan.days === 1 ? "day" : "days"}`;
  banner.className = `budget-banner ${plan.within_budget ? "is-within" : "is-over"}`;
  banner.innerHTML = `<div class="budget-banner-copy"><span class="budget-status-icon">${plan.within_budget ? "✓" : "!"}</span><div><strong>${plan.within_budget ? "This plan fits your budget" : "The trip estimate is over budget"}</strong><span>${plan.within_budget ? budgetMessage : "We removed the most expensive available attractions first. Review the revised plan below."}</span></div></div><div class="budget-meter-wrap"><div class="budget-meter-label"><span>ESTIMATED / BUDGET</span><span>${budget === 0 ? "Zero budget" : `${Math.round(ratio)}%`}</span></div><div class="budget-meter" role="progressbar" aria-label="Estimated cost relative to budget" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio)}"><span style="width:${ratio}%"></span></div>${budget === 0 ? '<small class="zero-budget-note">A zero budget cannot cover the fixed daily estimates.</small>' : ""}</div>`;
  budgetCards.innerHTML = [
    { label: "Attraction expenses", value: breakdown.attraction_cost, mark: "01" },
    { label: "Food estimate", value: breakdown.food_cost, mark: "02" },
    { label: "Transport estimate", value: breakdown.transport_cost, mark: "03" },
    { label: "Estimated total", value: plan.estimated_total, mark: "Σ", total: true }
  ].map((item) => `<article class="budget-card ${item.total ? "total-card" : ""}"><span>${item.mark}</span><p>${item.label}</p><strong>${rupees(item.value)}</strong></article>`).join("");

  const itinerary = document.querySelector("#itinerary-list");
  itinerary.innerHTML = plan.itinerary.map((day) => `<article class="itinerary-day"><div class="day-marker"><span>DAY</span><strong>${String(day.day).padStart(2, "0")}</strong></div><div class="day-content"><h4>${escapeHtml(day.activity)}</h4><p>${day.free_day ? "Keep the day flexible and explore at your own pace." : `Sample attraction cost: ${rupees(day.estimated_attraction_cost)}`}</p></div><span class="day-status">${day.free_day ? "OPEN DAY" : "SAMPLE PLAN"}</span></article>`).join("");

  const removedList = document.querySelector("#removed-list");
  if (plan.removed_attractions.length) {
    removedList.hidden = false;
    removedList.innerHTML = `<strong>Removed during budget replanning</strong><ul>${plan.removed_attractions.map((place) => `<li>${escapeHtml(place.name)} <span>${rupees(place.cost)}</span></li>`).join("")}</ul><p>Starting estimate: ${rupees(initialTotal)} · Revised estimate: ${rupees(plan.estimated_total)} · Your entered budget was not changed.</p>`;
  } else {
    removedList.hidden = true;
    removedList.innerHTML = "";
  }
  document.querySelector("#approval-choice").hidden = true;
  document.querySelector("#approval-message").className = "message";
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadMemory() {
  const container = document.querySelector("#memory-content");
  try {
    const memory = await requestJson(MEMORY_API);
    window.travelMateMemory = memory;
    renderMemory(memory);
    const preference = displayPreference(memory.preferences?.travel_style);
    if (["Nature", "History", "Relaxation"].includes(preference)) {
      document.querySelector("#preference").value = preference;
    }
  } catch (error) {
    container.innerHTML = `<p class="inline-error">Saved trip memory couldn't be loaded. ${escapeHtml(error.message)}</p>`;
  }
}

function initPlanner() {
  const form = document.querySelector("#trip-form");
  const submit = document.querySelector("#generate-plan");
  const formMessage = document.querySelector("#form-message");
  const approvalChoice = document.querySelector("#approval-choice");
  const approvalMessage = document.querySelector("#approval-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(formMessage);
    if (!form.reportValidity()) return;
    const customDestination = form.elements["destination-custom"].value.trim();
    const destination = customDestination || form.elements.destination.value;
    if (!destination) {
      showMessage(formMessage, "Enter a destination name or choose a sample destination.");
      return;
    }
    const payload = {
      destination,
      days: Number(form.elements.days.value),
      budget: Number(form.elements.budget.value),
      preference: form.elements.preference.value
    };
    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.querySelector(".submit-label").textContent = "Planning...";
    try {
      const plan = await requestJson(PLAN_API, { method: "POST", body: JSON.stringify(payload) });
      renderPlan(plan);
      await loadMemory();
    } catch (error) {
      showMessage(formMessage, error.message);
    } finally {
      submit.disabled = false;
      submit.classList.remove("is-loading");
      submit.querySelector(".submit-label").textContent = "Generate My Trip";
    }
  });

  document.querySelector("#reset-planner").addEventListener("click", () => {
    form.reset();
    document.querySelector("#plan-results").hidden = true;
    clearMessage(formMessage);
    clearMessage(approvalMessage);
    approvalChoice.hidden = true;
    document.querySelector("#destination").focus();
  });

  document.querySelector("#request-approval").addEventListener("click", () => {
    approvalChoice.hidden = false;
    approvalMessage.className = "message";
    approvalChoice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  async function sendApproval(approved) {
    const buttons = approvalChoice.querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await requestJson(APPROVAL_API, { method: "POST", body: JSON.stringify({ approved }) });
      showMessage(approvalMessage, result.message, "success");
      approvalChoice.hidden = true;
    } catch (error) {
      showMessage(approvalMessage, error.message);
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  document.querySelector("#approve-yes").addEventListener("click", () => sendApproval(true));
  document.querySelector("#approve-no").addEventListener("click", () => sendApproval(false));
  document.querySelector("#refresh-memory").addEventListener("click", loadMemory);
}

async function init() {
  initPlanner();
  const grid = document.querySelector("#destination-grid");
  try {
    const [destinations, memory] = await Promise.all([
      requestJson(DESTINATIONS_API), requestJson(MEMORY_API)
    ]);
    window.travelMateMemory = memory;
    renderDestinations(destinations);
    renderMemory(memory);
    const preference = displayPreference(memory.preferences?.travel_style);
    if (["Nature", "History", "Relaxation"].includes(preference)) {
      document.querySelector("#preference").value = preference;
    }
  } catch (error) {
    grid.innerHTML = `<p class="inline-error">TravelMate couldn't load its local data. Check that Flask is running, then refresh this page. ${escapeHtml(error.message)}</p>`;
    showMessage(document.querySelector("#form-message"), error.message);
  }
}

document.addEventListener("DOMContentLoaded", init);