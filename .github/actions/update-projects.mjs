import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const dataPath = path.join(rootDir, "data.js");

function loadSiteData(source) {
  return Function(`${source}; return SITE_DATA;`)();
}

function parseGithubRepo(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/i);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

function findProjectsArrayRange(source) {
  const propIndex = source.indexOf('"projects"');
  if (propIndex < 0) throw new Error('Cannot find "projects" in data.js');

  const arrayStart = source.indexOf("[", propIndex);
  if (arrayStart < 0) throw new Error('Cannot find "projects" array start in data.js');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) return { start: arrayStart, end: i + 1 };
    }
  }

  throw new Error('Cannot find "projects" array end in data.js');
}

function formatProjects(projects) {
  return JSON.stringify(projects, null, 2).replace(/\n/g, "\n  ");
}

async function fetchRepo(repo) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lartpang.github.io-project-updater",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${repo}`);
  }
  return response.json();
}

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
  const license = api.license?.spdx_id || api.license?.name || existing.license || "";
  const language = api.language || existing.language || "Markdown";

  return compactProject({
    name: existing.name || api.name,
    repo,
    fullName: api.full_name || repo,
    owner: api.owner?.login || repo.split("/")[0],
    ownerAvatar: api.owner?.avatar_url || "",
    url: api.html_url || existing.url,
    desc: api.description || existing.desc || "",
    language,
    stars: api.stargazers_count ?? existing.stars ?? 0,
    forks: api.forks_count ?? existing.forks ?? 0,
    watchers: api.subscribers_count ?? existing.watchers ?? api.watchers_count ?? 0,
    license,
    topics: Array.isArray(api.topics) ? api.topics.slice(0, 5) : (existing.topics || []),
    updatedAt: api.updated_at || existing.updatedAt || "",
    pushedAt: api.pushed_at || existing.pushedAt || "",
  });
}

async function main() {
  const source = await readFile(dataPath, "utf8");
  const siteData = loadSiteData(source);
  const projects = siteData.projects || [];
  const updated = [];

  for (const project of projects) {
    const repo = project.repo || parseGithubRepo(project.url);
    if (!repo) {
      updated.push(compactProject(project));
      continue;
    }

    const api = await fetchRepo(repo);
    updated.push(mergeProject(project, repo, api));
    console.log(`updated ${repo}`);
  }

  const range = findProjectsArrayRange(source);
  const nextSource =
    source.slice(0, range.start) +
    formatProjects(updated) +
    source.slice(range.end);

  await writeFile(dataPath, nextSource, "utf8");
  console.log(`wrote ${path.relative(rootDir, dataPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
