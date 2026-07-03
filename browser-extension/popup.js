/* CareerLog Job Saver — popup logic.
 *
 * Reuses the existing backend: POST /api/auth/login for a bearer token and
 * POST /api/jobs to create a job. The active page is scraped for the job
 * title / company / location (JSON-LD JobPosting first, then Open Graph /
 * heading fallbacks). No build step — plain MV3. */

const DEFAULT_API = "http://localhost:8000";

const els = {
  loginView: document.getElementById("login-view"),
  saveView: document.getElementById("save-view"),
  logout: document.getElementById("logout"),
  apiBase: document.getElementById("api-base"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  login: document.getElementById("login"),
  jobTitle: document.getElementById("job-title"),
  company: document.getElementById("company"),
  location: document.getElementById("location"),
  status: document.getElementById("status"),
  employmentType: document.getElementById("employment-type"),
  url: document.getElementById("url"),
  save: document.getElementById("save"),
  msg: document.getElementById("status-msg"),
};

let apiBase = DEFAULT_API;
let token = null;
let pageUrl = "";

function setMsg(text, kind) {
  els.msg.textContent = text || "";
  els.msg.className = "status" + (kind ? " " + kind : "");
}

function show(view) {
  els.loginView.hidden = view !== "login";
  els.saveView.hidden = view !== "save";
  els.logout.hidden = view !== "save";
}

async function getState() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["apiBase", "token"], resolve)
  );
}

/* ----- page scraping (runs in the active tab) ----- */

function scrapeJobFromPage() {
  const EMPLOYMENT = {
    FULL_TIME: "full-time",
    PART_TIME: "part-time",
    CONTRACTOR: "contract",
    CONTRACT: "contract",
    TEMPORARY: "temporary",
    INTERN: "internship",
    INTERNSHIP: "internship",
  };

  function meta(selector) {
    const el = document.querySelector(selector);
    return el ? el.getAttribute("content") : null;
  }

  let title = null;
  let company = null;
  let location = null;
  let employmentType = null;

  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]'
  )) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const types = [].concat(node && node["@type"] ? node["@type"] : []);
      if (!types.includes("JobPosting")) continue;
      title = title || node.title || null;
      if (node.hiringOrganization) {
        company =
          company ||
          node.hiringOrganization.name ||
          (typeof node.hiringOrganization === "string"
            ? node.hiringOrganization
            : null);
      }
      if (node.employmentType) {
        const et = Array.isArray(node.employmentType)
          ? node.employmentType[0]
          : node.employmentType;
        employmentType = employmentType || EMPLOYMENT[String(et).toUpperCase()] || null;
      }
      const loc = node.jobLocation;
      const addr = (Array.isArray(loc) ? loc[0] : loc)?.address;
      if (addr) {
        location =
          location ||
          [addr.addressLocality, addr.addressRegion, addr.addressCountry]
            .filter(Boolean)
            .join(", ") ||
          null;
      }
    }
  }

  title = title || meta('meta[property="og:title"]') || document.title || "";
  company =
    company ||
    meta('meta[property="og:site_name"]') ||
    meta('meta[name="author"]') ||
    "";

  return {
    title: String(title).trim(),
    company: String(company).trim(),
    location: String(location || "").trim(),
    employmentType: employmentType || "",
    url: window.location.href,
  };
}

async function scrapeActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  pageUrl = tab.url || "";
  els.url.textContent = pageUrl;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobFromPage,
    });
    const data = result?.result;
    if (data) {
      els.jobTitle.value = data.title || "";
      els.company.value = data.company || "";
      els.location.value = data.location || "";
      if (data.url) {
        pageUrl = data.url;
        els.url.textContent = pageUrl;
      }
      if (data.employmentType) els.employmentType.value = data.employmentType;
    }
  } catch {
    // Some pages (chrome://, store pages) can't be scripted; let the user type.
    setMsg("Couldn't read this page — fill the fields manually.", "");
  }
}

/* ----- API ----- */

async function apiPost(path, body, withAuth) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth && token) headers.Authorization = "Bearer " + token;
  const res = await fetch(apiBase.replace(/\/$/, "") + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const message = json?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return json.data;
}

async function handleLogin() {
  apiBase = (els.apiBase.value || DEFAULT_API).trim();
  const email = els.email.value.trim();
  const password = els.password.value;
  if (!email || !password) {
    setMsg("Enter your email and password.", "error");
    return;
  }
  els.login.disabled = true;
  setMsg("Signing in…");
  try {
    const data = await apiPost("/api/auth/login", { email, password }, false);
    token = data.jwt;
    await chrome.storage.local.set({ apiBase, token });
    setMsg("");
    show("save");
    await scrapeActiveTab();
  } catch (err) {
    setMsg(err.message || "Sign in failed.", "error");
  } finally {
    els.login.disabled = false;
  }
}

async function handleSave() {
  if (!els.jobTitle.value.trim() || !els.company.value.trim()) {
    setMsg("Job title and company are required.", "error");
    return;
  }
  els.save.disabled = true;
  setMsg("Saving…");
  try {
    await apiPost(
      "/api/jobs",
      {
        url: pageUrl,
        jobTitle: els.jobTitle.value.trim(),
        company: els.company.value.trim(),
        salaryTarget: 0,
        status: els.status.value,
        location: els.location.value.trim(),
        employmentType: els.employmentType.value,
      },
      true
    );
    setMsg("Saved to CareerLog ✓", "ok");
  } catch (err) {
    if (err.status === 401) {
      token = null;
      await chrome.storage.local.remove("token");
      show("login");
      setMsg("Session expired — sign in again.", "error");
      return;
    }
    setMsg(err.message || "Failed to save.", "error");
  } finally {
    els.save.disabled = false;
  }
}

async function handleLogout() {
  token = null;
  await chrome.storage.local.remove("token");
  show("login");
  setMsg("");
}

async function init() {
  const state = await getState();
  apiBase = state.apiBase || DEFAULT_API;
  token = state.token || null;
  els.apiBase.value = apiBase;

  els.login.addEventListener("click", handleLogin);
  els.save.addEventListener("click", handleSave);
  els.logout.addEventListener("click", handleLogout);

  if (token) {
    show("save");
    await scrapeActiveTab();
  } else {
    show("login");
  }
}

document.addEventListener("DOMContentLoaded", init);
