// open-dashboard.js — open local dashboard with OS-specific hints (Chrome extension)
const PROJECT_FOLDER = 'x-multiplayer';
const DASHBOARD_REL_PATH = 'x-multiplayer/dashboard/index.html';
const DASHBOARD_FILE = 'dashboard/index.html';
const LOCALHOST_URL = 'http://localhost:3000';

const OS_HINTS = {
  mac: {
    label: 'macOS',
    emoji: '🍎',
    examples: [
      '~/Downloads/x-multiplayer/dashboard/index.html',
      '~/Desktop/x-multiplayer/dashboard/index.html',
      '~/Projects/x-multiplayer/dashboard/index.html',
    ],
    steps: [
      'Open Finder and press ⌘⇧G (Go to Folder).',
      'Paste the folder where you cloned the repo (must contain x-multiplayer/).',
      'Open dashboard/index.html in Chrome (File → Open File).',
      'Or run node server.js inside x-multiplayer, then use localhost below.',
    ],
    searchDirs: ['Downloads', 'Desktop', 'Documents'],
  },
  win: {
    label: 'Windows',
    emoji: '🪟',
    examples: [
      '%USERPROFILE%\\Downloads\\x-multiplayer\\dashboard\\index.html',
      '%USERPROFILE%\\Desktop\\x-multiplayer\\dashboard\\index.html',
      'C:\\Users\\You\\Projects\\x-multiplayer\\dashboard\\index.html',
    ],
    steps: [
      'Open File Explorer (Win+E).',
      'Go to Downloads or wherever you cloned x-multiplayer.',
      'Navigate to dashboard\\index.html and open with Chrome.',
      'Or run node server.js in the project folder, then use localhost below.',
    ],
    searchDirs: ['Downloads', 'Desktop', 'Documents'],
  },
  linux: {
    label: 'Linux',
    emoji: '🐧',
    examples: [
      '~/Downloads/x-multiplayer/dashboard/index.html',
      '~/x-multiplayer/dashboard/index.html',
      '~/Projects/x-multiplayer/dashboard/index.html',
    ],
    steps: [
      'Open your file manager (Files/Nautilus).',
      'Go to Downloads or your clone location.',
      'Open dashboard/index.html in Chrome.',
      'Or: cd x-multiplayer && node server.js, then use localhost below.',
    ],
    searchDirs: ['Downloads', 'Desktop', 'Documents'],
  },
};

function toFileUrl(absPath) {
  if (!absPath) return null;
  const normalized = absPath.replace(/\\/g, '/');
  if (/^file:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file:///${normalized}`;
}

function pathEndsWithDashboard(path) {
  if (!path) return false;
  const p = path.replace(/\\/g, '/').toLowerCase();
  return p.includes('x-multiplayer') && (p.endsWith('dashboard/index.html') || p.endsWith('dashboard/index.htm'));
}

function showStatus(el, message, type = 'info') {
  if (!el) return;
  el.textContent = message;
  el.className = 'open-status ' + type;
  el.style.display = 'block';
}

function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

async function tryLocalhost() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    await fetch(LOCALHOST_URL, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

function openTab(url) {
  return chrome.tabs.create({ url });
}

function searchDownloadsForDashboard() {
  return new Promise((resolve) => {
    if (!chrome.downloads?.search) {
      resolve(null);
      return;
    }
    chrome.downloads.search({}, (items) => {
      const matches = (items || [])
        .filter((i) => i.exists !== false && pathEndsWithDashboard(i.filename))
        .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      resolve(matches[0]?.filename || null);
    });
  });
}

function getSavedProjectPath() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['dashboardProjectPath'], (res) => {
      resolve(res.dashboardProjectPath || '');
    });
  });
}

function resolveDashboardPath(root, osKey) {
  if (!root) return null;
  const sep = osKey === 'win' ? '\\' : '/';
  let base = root.replace(/[/\\]+$/, '');
  const norm = base.replace(/\\/g, '/').toLowerCase();
  if (!norm.endsWith('/x-multiplayer')) {
    base = `${base}${sep}x-multiplayer`;
  }
  return `${base}${sep}dashboard${sep}index.html`;
}

async function tryOpenDashboardFile(filePath, statusEl) {
  const fileUrl = toFileUrl(filePath);
  if (!fileUrl) return false;
  try {
    await openTab(fileUrl);
    showStatus(statusEl, `Opened file in Chrome:\n${filePath}`, 'success');
    return true;
  } catch (e) {
    showStatus(
      statusEl,
      `Could not open file URL automatically. Enable "Allow access to file URLs" for this extension in chrome://extensions, then try again.\n\nPath:\n${filePath}`,
      'warn'
    );
    return false;
  }
}

async function openDashboardForOs(osKey, statusEl) {
  const os = OS_HINTS[osKey];
  if (!os) return;

  const reminder = `Open this file in Chrome:\n\n${DASHBOARD_REL_PATH}\n\n(wherever you cloned or saved the project)`;
  const examplePath = os.examples[0];
  await copyText(`${reminder}\n\nExample (${os.label}):\n${examplePath}`);

  showStatus(statusEl, `Looking for ${DASHBOARD_REL_PATH} on ${os.label}…`, 'info');

  // 1) Local dev server
  const localhostOk = await tryLocalhost();
  if (localhostOk) {
    await openTab(LOCALHOST_URL);
    showStatus(
      statusEl,
      `Opened ${LOCALHOST_URL} (node server.js is running).\n\nCopied path reminder:\n${DASHBOARD_REL_PATH}`,
      'success'
    );
    return;
  }

  // 2) Saved project folder
  const savedRoot = await getSavedProjectPath();
  if (savedRoot) {
    const savedFull = resolveDashboardPath(savedRoot, osKey);
    if (savedFull) {
      const opened = await tryOpenDashboardFile(savedFull, statusEl);
      if (opened) return;
    }
  }

  // 3) Downloads / recent download path
  const downloadPath = await searchDownloadsForDashboard();
  if (downloadPath) {
    const opened = await tryOpenDashboardFile(downloadPath, statusEl);
    if (opened) return;
  }

  // 4) Manual instructions
  const stepsText = [
    reminder,
    '',
    `${os.label} — typical locations:`,
    ...os.examples.map((e) => `  • ${e}`),
    '',
    ...os.steps,
    '',
    'Path copied to clipboard. Paste in Finder / Explorer address bar.',
    '',
    'Tip: Save your clone folder below, then click this OS button again.',
  ].join('\n');

  showStatus(statusEl, stepsText, 'warn');
}

function wireOpenDashboardUI() {
  const panel = document.getElementById('openDashboardPanel');
  const openBtn = document.getElementById('openDashboard');
  const statusEl = document.getElementById('openDashboardStatus');
  const pathInput = document.getElementById('projectPathInput');
  const savePathBtn = document.getElementById('saveProjectPath');
  const localhostBtn = document.getElementById('openLocalhost');

  if (!openBtn || !panel) return;

  openBtn.addEventListener('click', () => {
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) {
      showStatus(
        statusEl,
        `Find your clone folder, then open:\n${DASHBOARD_REL_PATH}`,
        'info'
      );
    }
  });

  document.querySelectorAll('[data-os]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openDashboardForOs(btn.dataset.os, statusEl);
    });
  });

  localhostBtn?.addEventListener('click', async () => {
    await openTab(LOCALHOST_URL);
    showStatus(
      statusEl,
      `Opened ${LOCALHOST_URL}\n\nIf the page fails, run in terminal:\ncd x-multiplayer\nnode server.js`,
      'info'
    );
  });

  savePathBtn?.addEventListener('click', () => {
    const path = pathInput?.value.trim();
    if (!path) {
      showStatus(statusEl, 'Enter the folder that contains x-multiplayer (not the dashboard file itself).', 'warn');
      return;
    }
    chrome.storage.local.set({ dashboardProjectPath: path }, () => {
      showStatus(statusEl, `Saved project folder:\n${path}\n\nNow click your OS button to open dashboard/index.html`, 'success');
    });
  });

  chrome.storage.local.get(['dashboardProjectPath'], (res) => {
    if (pathInput && res.dashboardProjectPath) pathInput.value = res.dashboardProjectPath;
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', wireOpenDashboardUI);
}
