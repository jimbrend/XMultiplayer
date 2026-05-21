// open-dashboard.js — open local dashboard with OS-specific paths (Chrome extension)
const PROJECT_FOLDER = 'x-multiplayer';
const DASHBOARD_REL_PATH = 'x-multiplayer/dashboard/index.html';
const LOCALHOST_URL = 'http://localhost:3000';
const GITHUB_SOURCE = 'https://github.com/jimbrend/XMultiplayer';
const PATH_PREFIX = '/path-where-you-downloaded-X-Multiplayer-replace-this-to-launch-it';
const SERVER_CMD = 'cd x-multiplayer && node server.js';

const OS_HINTS = {
  mac: {
    label: 'macOS',
    defaultUser: 'YOUR_USERNAME',
    launchPath: `/Users/YOUR_USERNAME/Downloads/${PROJECT_FOLDER}/dashboard/index.html`,
    fileUrlPath: `${PATH_PREFIX}/${PROJECT_FOLDER}/dashboard/index.html`,
    displayPath: `${PATH_PREFIX}/${PROJECT_FOLDER}/dashboard/index.html`,
  },
  win: {
    label: 'Windows',
    defaultUser: 'YourName',
    launchPath: `C:\\Users\\YourName\\Downloads\\${PROJECT_FOLDER}\\dashboard\\index.html`,
    fileUrlPath: `${PATH_PREFIX}/${PROJECT_FOLDER}/dashboard/index.html`,
    displayPath: `${PATH_PREFIX}\\${PROJECT_FOLDER}\\dashboard\\index.html`,
  },
  linux: {
    label: 'Linux',
    defaultUser: 'youruser',
    launchPath: `/home/youruser/Downloads/${PROJECT_FOLDER}/dashboard/index.html`,
    fileUrlPath: `${PATH_PREFIX}/${PROJECT_FOLDER}/dashboard/index.html`,
    displayPath: `${PATH_PREFIX}/${PROJECT_FOLDER}/dashboard/index.html`,
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
    showStatus(
      statusEl,
      `Opened 𝕏 Multiplayer Dashboard in a new tab.\n\nThe multiplayer tutorial will begin on first launch.\n\nPath:\n${filePath}\n\nFor full history sync, run:\n${SERVER_CMD}`,
      'success'
    );
    return true;
  } catch {
    showStatus(
      statusEl,
      `Could not open automatically. Enable "Allow access to file URLs" for this extension in chrome://extensions.\n\nThen open:\n${filePath}`,
      'warn'
    );
    return false;
  }
}

async function openViaLocalhost(statusEl) {
  const ok = await tryLocalhost();
  if (ok) {
    await openTab(LOCALHOST_URL);
    showStatus(
      statusEl,
      `Opened 𝕏 Multiplayer Dashboard at ${LOCALHOST_URL}.\n\nYour seen posts from this extension are syncing into the dashboard.\n\nThe multiplayer tutorial will start automatically if this is your first visit.\n\nVerify the code: ${GITHUB_SOURCE}`,
      'success'
    );
    return true;
  }
  return false;
}

async function openDashboardForOs(osKey, statusEl) {
  const os = OS_HINTS[osKey];
  if (!os) return;

  const preview = document.getElementById('pathUrlPreview');
  if (preview) preview.textContent = os.displayPath;

  if (await openViaLocalhost(statusEl)) return;

  const launchPath = os.launchPath;
  const fileUrl = toFileUrl(launchPath);

  await copyText(
    [
      '𝕏 Multiplayer — open dashboard',
      '',
      'Replace the path prefix with where you downloaded the project:',
      os.displayPath,
      '',
      'Default example:',
      launchPath,
      '',
      'Start server (imports seen history):',
      SERVER_CMD,
      '',
      GITHUB_SOURCE,
    ].join('\n')
  );

  showStatus(statusEl, `Opening dashboard for ${os.label}…`, 'info');

  const savedRoot = await getSavedProjectPath();
  if (savedRoot) {
    const savedFull = resolveDashboardPath(savedRoot, osKey);
    if (savedFull && (await tryOpenDashboardFile(savedFull, statusEl))) return;
  }

  const downloadPath = await searchDownloadsForDashboard();
  if (downloadPath && (await tryOpenDashboardFile(downloadPath, statusEl))) return;

  if (fileUrl) {
    await openTab(fileUrl);
    showStatus(
      statusEl,
      [
        `Opened 𝕏 Multiplayer Dashboard in a new tab (${os.label}).`,
        '',
        'Edit the file path in the address bar if needed — replace:',
        PATH_PREFIX,
        'with your real download folder.',
        '',
        'Example:',
        launchPath,
        '',
        'For seen history import + multiplayer, run in terminal:',
        SERVER_CMD,
        '',
        'Tutorial walkthrough begins when the dashboard loads (first visit).',
        '',
        `Source: ${GITHUB_SOURCE}`,
      ].join('\n'),
      'success'
    );
    return;
  }

  showStatus(
    statusEl,
    [
      `${os.label}: copy this path into Finder / Explorer (⌘⇧G on Mac):`,
      launchPath,
      '',
      'Or run the server first:',
      SERVER_CMD,
      `Then open ${LOCALHOST_URL}`,
    ].join('\n'),
    'warn'
  );
}

function wireOpenDashboardUI() {
  const panel = document.getElementById('openDashboardPanel');
  const openBtn = document.getElementById('openDashboard');
  const statusEl = document.getElementById('openDashboardStatus');
  const pathInput = document.getElementById('projectPathInput');
  const savePathBtn = document.getElementById('saveProjectPath');
  const localhostBtn = document.getElementById('openLocalhost');
  const copyServerBtn = document.getElementById('copyServerCmd');
  const runServerBtn = document.getElementById('runServerHint');

  if (!openBtn || !panel) return;

  openBtn.addEventListener('click', () => {
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) {
      showStatus(
        statusEl,
        [
          'Step 1: Run the server (imports seen history from this extension):',
          SERVER_CMD,
          '',
          'Step 2: Open localhost:3000 OR click your OS to open index.html',
          '',
          'Tutorial starts automatically on first dashboard launch.',
          '',
          GITHUB_SOURCE,
        ].join('\n'),
        'info'
      );
    }
  });

  copyServerBtn?.addEventListener('click', () => {
    copyText(SERVER_CMD).then(() => {
      showStatus(statusEl, `Copied:\n${SERVER_CMD}\n\nPaste in Terminal (Mac/Linux) or PowerShell (Windows), inside any folder — then cd into x-multiplayer if needed.`, 'success');
    });
  });

  runServerBtn?.addEventListener('click', () => {
    copyText(SERVER_CMD);
    showStatus(
      statusEl,
      [
        'Run this in Terminal / PowerShell:',
        '',
        SERVER_CMD,
        '',
        'What it does:',
        '• Serves the dashboard at http://localhost:3000',
        '• Imports posts you have seen on 𝕏 from this extension',
        '• Enables multiplayer, Raindrop, and the tutorial',
        '',
        'Requires Node.js: https://nodejs.org',
        '',
        `Verify source: ${GITHUB_SOURCE}`,
      ].join('\n'),
      'info'
    );
  });

  document.querySelectorAll('[data-os]').forEach((btn) => {
    btn.addEventListener('click', () => openDashboardForOs(btn.dataset.os, statusEl));
  });

  localhostBtn?.addEventListener('click', async () => {
    if (!(await openViaLocalhost(statusEl))) {
      showStatus(
        statusEl,
        [
          'Server not detected at localhost:3000.',
          '',
          'Run first:',
          SERVER_CMD,
          '',
          'Then click this button again.',
          '',
          'Or use macOS / Windows / Linux to open index.html directly.',
        ].join('\n'),
        'warn'
      );
    }
  });

  savePathBtn?.addEventListener('click', () => {
    const path = pathInput?.value.trim();
    if (!path) {
      showStatus(statusEl, 'Paste the folder that contains x-multiplayer (parent of dashboard/).', 'warn');
      return;
    }
    chrome.storage.local.set({ dashboardProjectPath: path }, () => {
      showStatus(statusEl, `Saved:\n${path}\n\nClick your OS button to open dashboard/index.html`, 'success');
    });
  });

  chrome.storage.local.get(['dashboardProjectPath'], (res) => {
    if (pathInput && res.dashboardProjectPath) pathInput.value = res.dashboardProjectPath;
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', wireOpenDashboardUI);
}
