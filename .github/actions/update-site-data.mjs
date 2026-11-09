// Refreshes the auto-generated parts of data.js:
//   - "projects": GitHub metadata for each listed repository
//   - "live":     GitHub totals, latest Tuchong photos, Yuque stats
// Every source is fetched independently; a failure keeps the previous value.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const dataPath = path.join(rootDir, "data.js");

const GITHUB_USER = "lartpang";
const TUCHONG_SITE = "11269264";
const YUQUE_USER = "lart";
const PHOTO_POSTS = 12;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function loadSiteData(source) {
  return Function(`${source}; return SITE_DATA;`)();
}

function parseGithubRepo(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

/* ---------- data.js editing ---------- */

// Range of the JSON value (array or object) of a top-level key, or null.
function findValueRange(source, key) {
  const propIndex = source.indexOf(`"${key}":`);
  if (propIndex < 0) return null;
  let start = propIndex + key.length + 3;
  while (/\s/.test(source[start])) start++;
  const open = source[start];
  if (open !== "[" && open !== "{") throw new Error(`"${key}" is not an array or object`);

  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Cannot find end of "${key}" in data.js`);
}

function format(value) {
  return JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
}

function setKey(source, key, value) {
  const range = findValueRange(source, key);
  if (range) return source.slice(0, range.start) + format(value) + source.slice(range.end);
  const end = source.lastIndexOf("}");
  return source.slice(0, end).replace(/\s*$/, "") + `,\n  "${key}": ${format(value)}\n};\n`;
}

/* ---------- fetch helpers ---------- */

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lartpang.github.io-site-updater",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

async function getText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

async function attempt(label, fn, fallback) {
  try {
    const value = await fn();
    console.log(`updated ${label}`);
    return value;
  } catch (error) {
    console.warn(`kept previous ${label}: ${error.message}`);
    return fallback;
  }
}

/* ---------- projects ---------- */

function compactProject(project) {
  return {
    name: project.name || "",
    repo: project.repo || "",
    fullName: project.fullName || project.repo || "",
    owner: project.owner || String(project.repo || "").split("/")[0] || "",
    ownerAvatar: project.ownerAvatar || "",
    url: project.url || "",
    desc: project.desc || "",
    language: project.language || "Markdown",
    stars: project.stars ?? 0,
    forks: project.forks ?? 0,
    watchers: project.watchers ?? 0,
    license: project.license || "",
    topics: Array.isArray(project.topics) ? project.topics : [],
    updatedAt: project.updatedAt || "",
    pushedAt: project.pushedAt || "",
  };
}

function mergeProject(existing, repo, api) {
  return compactProject({
    name: existing.name || api.name,
    repo,
    fullName: api.full_name || repo,
    owner: api.owner?.login || repo.split("/")[0],
    ownerAvatar: api.owner?.avatar_url || "",
    url: api.html_url || existing.url,
    desc: api.description || existing.desc || "",
    language: api.language || existing.language || "Markdown",
    stars: api.stargazers_count ?? existing.stars ?? 0,
    forks: api.forks_count ?? existing.forks ?? 0,
    watchers: api.subscribers_count ?? existing.watchers ?? api.watchers_count ?? 0,
    license: api.license?.spdx_id || api.license?.name || existing.license || "",
    topics: Array.isArray(api.topics) ? api.topics.slice(0, 5) : (existing.topics || []),
    updatedAt: api.updated_at || existing.updatedAt || "",
    pushedAt: api.pushed_at || existing.pushedAt || "",
  });
}

async function updateProjects(projects) {
  const updated = [];
  for (const project of projects) {
    const repo = project.repo || parseGithubRepo(project.url);
    if (!repo) {
      updated.push(compactProject(project));
      continue;
    }
    const api = await attempt(`repo ${repo}`, () => getJson(`https://api.github.com/repos/${repo}`, githubHeaders()), null);
    updated.push(api ? mergeProject(project, repo, api) : compactProject(project));
  }
  return updated;
}

/* ---------- live sources ---------- */

async function fetchGithub() {
  const user = await getJson(`https://api.github.com/users/${GITHUB_USER}`, githubHeaders());
  let stars = 0, forks = 0, page = 1;
  for (;;) {
    const repos = await getJson(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&page=${page}`,
      githubHeaders(),
    );
    for (const r of repos) if (!r.fork) { stars += r.stargazers_count || 0; forks += r.forks_count || 0; }
    if (repos.length < 100) break;
    page++;
  }
  return { followers: user.followers, repos: user.public_repos, stars, forks };
}

async function fetchPhotos() {
  const json = await getJson(
    `https://tuchong.com/rest/2/sites/${TUCHONG_SITE}/posts?count=${PHOTO_POSTS}&page=1`,
    { "User-Agent": BROWSER_UA },
  );
  const posts = (json.post_list || []).filter(p => p.images && p.images.length);
  if (!posts.length) throw new Error("no posts");
  return posts.map(p => {
    const img = p.images[0];
    return {
      title: String(p.title || "").replace(/\s+/g, " ").trim(),
      url: p.url,
      date: String(p.published_at || "").slice(0, 10),
      count: p.image_count || p.images.length,
      favorites: p.favorites || 0,
      image: img.source?.ft640 || img.source?.m || img.source?.l,
      width: img.width,
      height: img.height,
    };
  });
}

async function fetchYuque() {
  const html = await getText(`https://www.yuque.com/${YUQUE_USER}`, { "User-Agent": BROWSER_UA });
  const match = html.match(/decodeURIComponent\("([^"]*)"\)/);
  if (!match) throw new Error("page data not found");
  const user = JSON.parse(decodeURIComponent(match[1])).user;
  if (!user) throw new Error("user not found");
  return { docs: user.public_doc_count, books: user.public_books_count, followers: user.followers_count, likes: user.liked_count };
}

/* ---------- main ---------- */

async function main() {
  let source = await readFile(dataPath, "utf8");
  const siteData = loadSiteData(source);
  const prev = siteData.live || {};

  const projects = await updateProjects(siteData.projects || []);
  const live = {
    updatedAt: prev.updatedAt || "",
    github: await attempt("github", fetchGithub, prev.github || null),
    yuque: await attempt("yuque", fetchYuque, prev.yuque || null),
    csdn: prev.csdn || { visitors: "966K+", followers: "1.8K+" },
    photos: await attempt("photos", fetchPhotos, prev.photos || []),
  };

  // only bump the timestamp when something actually changed
  const strip = v => JSON.stringify({ ...v, updatedAt: "" });
  if (strip(live) !== strip(prev)) live.updatedAt = new Date().toISOString().slice(0, 10);

  source = setKey(source, "projects", projects);
  source = setKey(source, "live", live);
  await writeFile(dataPath, source, "utf8");
  console.log(`wrote ${path.relative(rootDir, dataPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
