(() => {
  const INSTALL_DISMISSED_KEY = 'landos_world_install_dismissed_v1';
  const STORAGE_PERSIST_REQUESTED_KEY = 'landos_world_storage_persist_requested_v1';
  const LOCAL_SW_RELOAD_KEY = 'landos_world_local_sw_disabled_v1';
  const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  const SW_PATH = './service-worker.js';
  const STATUS_REQUEST_TIMEOUT_MS = 4000;
  const DEPLOYMENT_CHECK_TIMEOUT_MS = 6000;
  const RESTART_FEEDBACK_TIMEOUT_MS = 10000;
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const UPDATE_RELOAD_KEY = 'landos_world_update_reload_target_v1';
  const buildMetadata = window.LandoWorldBuildMetadata || {};
  const runningCommit = buildMetadata.commitFull || '';
  const runningVersion = buildMetadata.releaseVersion || '';

  let deferredInstallPrompt = null;
  let waitingWorker = null;
  let cacheStatus = null;
  let lastCacheUpdate = null;
  let offlineReadiness = 'preparing';
  let storageEstimate = null;
  let isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let updateRequested = false;
  let updateTargetCommit = '';
  let updateFeedback = '';
  let updateFeedbackTimeoutId = null;
  let dismissedUpdateCommit = '';
  let updatePendingSafety = false;
  let updateOperation = null;
  let updateBlockedReason = '';
  let latestRelease = null;
  let releaseCheckSequence = 0;
  let releaseStatus = buildMetadata.environment === 'local' ? 'local' : 'unverified';
  const updateBlockers = new Map();
  let controllerBuildMismatch = '';
  let controllerReloadPending = false;
  let activeRegistration = null;
  let statusRequestSequence = 0;
  let updateCheckTimerId = null;

  function isLocalPreview() {
    return LOCAL_PREVIEW_HOSTS.has(window.location?.hostname || '');
  }

  async function disableLocalPreviewServiceWorkers() {
    if (!navigator.serviceWorker?.getRegistrations) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) {
      window.sessionStorage?.removeItem(LOCAL_SW_RELOAD_KEY);
      return;
    }
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (navigator.serviceWorker.controller && window.location?.reload && window.sessionStorage?.getItem(LOCAL_SW_RELOAD_KEY) !== '1') {
      window.sessionStorage.setItem(LOCAL_SW_RELOAD_KEY, '1');
      window.location.reload();
    }
  }

  function getStatusEl() {
    return document.getElementById('pwa-network-status');
  }

  function getToastEl() {
    return document.getElementById('pwa-toast');
  }

  function getSettingsRoot() {
    return document.getElementById('pwa-offline-settings');
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return 'Not available';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024))} MB`;
    return `${formatNumber(bytes / (1024 * 1024 * 1024))} GB`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '0';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function formatTime(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function getConnectionLabel() {
    return navigator.onLine === false ? 'Offline' : 'Online';
  }

  function getOfflineReadinessLabel() {
    if (offlineReadiness === 'ready') return 'Ready';
    if (offlineReadiness === 'unavailable') return 'Unavailable';
    if (offlineReadiness === 'error') return 'Error';
    if (offlineReadiness === 'ready-after-refresh') return 'Ready after refresh';
    return 'Preparing';
  }

  function getStorageUsageLabel() {
    if (!storageEstimate || !Number.isFinite(storageEstimate.usage)) return 'Not available';
    return formatBytes(storageEstimate.usage);
  }

  function getRunningVersionLabel() {
    return runningVersion || 'Unknown';
  }

  function getLatestVersionLabel() {
    return latestRelease?.releaseVersion || 'Unknown';
  }

  function getReleaseStatusLabel() {
    if (releaseStatus === 'local') return 'Local build — not compared';
    if (releaseStatus === 'checking') return 'Checking';
    if (releaseStatus === 'current') return 'Up to date';
    if (releaseStatus === 'available') return 'Update available';
    return navigator.onLine === false ? 'Unable to verify / Offline' : 'Unable to verify';
  }

  function getBuildShortCommit() {
    return buildMetadata.commit || 'Unknown';
  }

  function getStatusClass(value) {
    if (value === 'Online' || value === 'Ready' || value === 'Yes' || value === 'Up to date') return 'pwa_status_value pwa_status_value--success';
    if (value === 'Offline' || value === 'Preparing' || value === 'Ready after refresh' || value === 'Update available' || value.startsWith('Unable to verify')) return 'pwa_status_value pwa_status_value--warning';
    if (value === 'Error') return 'pwa_status_value pwa_status_value--error';
    return 'pwa_status_value';
  }

  function wasInstallDismissed() {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function setInstallDismissed() {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
    } catch {
      /* storage unavailable */
    }
  }

  function renderNetworkStatus() {
    const el = getStatusEl();
    if (!el) return;
    const online = navigator.onLine !== false;
    el.hidden = online && offlineReadiness === 'ready';
    el.classList.toggle('is-offline', !online);
    el.classList.toggle('is-online', online);
    el.textContent = online ? 'Online' : 'Offline - using cached data';
    el.setAttribute('aria-label', online ? "Lando's World is online." : "Lando's World is offline and using cached data.");
  }

  function renderToast() {
    const el = getToastEl();
    if (!el) return;
    el.classList.toggle('pwa_toast--update', false);
    if (updateRequested) {
      el.hidden = false;
      el.innerHTML = `
        <span>Preparing Lando’s World ${escapeHtml(latestRelease?.releaseVersion || '')}…</span>
      `;
      return;
    }
    if (updateFeedback) {
      el.hidden = false;
      el.innerHTML = `
        <span>${escapeHtml(updateFeedback)}</span>
        <button type="button" data-pwa-action="${controllerBuildMismatch ? 'restart-client' : 'update-now'}">${controllerBuildMismatch ? 'Retry Restart' : 'Retry Update'}</button>
      `;
      return;
    }
    if (controllerBuildMismatch) {
      el.hidden = false;
      el.innerHTML = `
        <span class="pwa_update_message">A newer Lando’s World build now controls this tab. Restart this tab to finish updating.</span>
        ${updateBlockedReason ? `<span class="pwa_update_blocked" role="status">${escapeHtml(updateBlockedReason)}</span>` : ''}
        ${controllerReloadPending && !updateBlockedReason ? '<span role="status">Restart is pending.</span>' : ''}
        <button type="button" data-pwa-action="restart-client">${controllerReloadPending ? 'Restart pending' : 'Restart This Tab'}</button>
      `;
      return;
    }
    if (releaseStatus === 'available' && latestRelease?.commitFull !== runningCommit && latestRelease?.commitFull !== dismissedUpdateCommit) {
      el.classList.toggle('pwa_toast--update', true);
      el.hidden = false;
      el.innerHTML = `
        <div class="pwa_update_notice">
          <h2 class="pwa_update_title">Update Available</h2>
          <p class="pwa_update_primary_message">Lando’s World <span class="pwa_version_token">${escapeHtml(latestRelease.releaseVersion)}</span> is ready.</p>
          <p class="pwa_update_secondary_message">You’re currently using <span class="pwa_version_token">${escapeHtml(getRunningVersionLabel())}</span>.</p>
          ${updateBlockedReason ? `<p class="pwa_update_blocked" role="status">${escapeHtml(updateBlockedReason)}</p>` : ''}
          <div class="pwa_update_actions">
            <button type="button" class="pwa_update_primary_action" data-pwa-action="update-now">Update Now</button>
            <button type="button" class="pwa_update_secondary_action" data-pwa-action="later">Later</button>
          </div>
        </div>
      `;
      return;
    }
    if (deferredInstallPrompt && !isInstalled && !wasInstallDismissed()) {
      el.hidden = false;
      el.innerHTML = `
        <span>Install Lando's World</span>
        <button type="button" data-pwa-action="install">Install</button>
        <button type="button" data-pwa-action="dismiss-install" aria-label="Dismiss install prompt">Not now</button>
      `;
      return;
    }
    el.hidden = true;
    el.textContent = '';
  }

  function renderSettings() {
    const root = getSettingsRoot();
    if (!root) return;
    const connectionLabel = getConnectionLabel();
    const installedLabel = isInstalled ? 'Yes' : 'No';
    const offlineReadinessLabel = getOfflineReadinessLabel();
    const workerCacheVersion = cacheStatus?.version || 'Not available';
    root.innerHTML = `
      <section class="pwa_offline_panel" id="pwa-offline-panel" aria-labelledby="pwa-offline-title">
        <h2 id="pwa-offline-title">Application Status</h2>
        <dl>
          <div>
            <dt>Running Version</dt>
            <dd>${getRunningVersionLabel()}</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd><code>${getBuildShortCommit()}</code></dd>
          </div>
          <div>
            <dt>Latest Version</dt>
            <dd>${getLatestVersionLabel()}</dd>
          </div>
          <div>
            <dt>Update Status</dt>
            <dd class="${getStatusClass(getReleaseStatusLabel())}">${getReleaseStatusLabel()}</dd>
          </div>
          <div>
            <dt>Service Worker / Cache</dt>
            <dd title="${escapeHtml(workerCacheVersion)}"><code>${escapeHtml(workerCacheVersion.slice(0, 12))}</code></dd>
          </div>
          <div>
            <dt>Connection</dt>
            <dd class="${getStatusClass(connectionLabel)}">${connectionLabel}</dd>
          </div>
          <div>
            <dt>Application Installed</dt>
            <dd class="${getStatusClass(installedLabel)}">${installedLabel}</dd>
          </div>
          <div>
            <dt>Offline Ready</dt>
            <dd class="${getStatusClass(offlineReadinessLabel)}">${offlineReadinessLabel}</dd>
          </div>
          <div>
            <dt>Last Cache Update</dt>
            <dd>${formatTime(lastCacheUpdate || cacheStatus?.updatedAt)}</dd>
          </div>
          <div>
            <dt>Storage Used</dt>
            <dd>${getStorageUsageLabel()}</dd>
          </div>
        </dl>
        <button type="button" class="pwa_cache_button" data-pwa-action="clear-cache">Clear Application Cache</button>
        <p>Cache cleanup never deletes Lee-Lee's Tracker records or other local app data.</p>
      </section>
    `;
  }

  function normalizeDeploymentMetadata(value) {
    if (!value || typeof value !== 'object') throw new Error('Deployment metadata is missing.');
    const releaseParts = /^(\d{4}-\d{2}-\d{2})-([1-9]\d*)$/.exec(value.releaseVersion || '');
    const releaseDate = releaseParts ? new Date(`${releaseParts[1]}T00:00:00Z`) : null;
    if (!releaseParts || Number.isNaN(releaseDate.getTime()) || releaseDate.toISOString().slice(0, 10) !== releaseParts[1]) {
      throw new Error('Deployment release label is invalid.');
    }
    if (!/^[a-f0-9]{40}$/i.test(value.commitFull || '')) throw new Error('Deployment commit identity is invalid.');
    if ((value.shortCommit || '') !== value.commitFull.slice(0, 7)) throw new Error('Deployment short commit does not match the full commit.');
    if (String(value.deploymentRun || '') !== releaseParts[2]) throw new Error('Deployment run does not match the release label.');
    return value;
  }

  async function fetchLatestDeployment() {
    if (typeof fetch !== 'function') throw new Error('Network fetch is unavailable.');
    const endpoint = new URL('./deployment-version.json', window.location.href);
    endpoint.searchParams.set('check', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), DEPLOYMENT_CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint.href, {
        cache: 'no-store',
        credentials: 'same-origin',
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!response?.ok) throw new Error(`Deployment metadata request failed (${response?.status || 'network'}).`);
      return normalizeDeploymentMetadata(await response.json());
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function checkForDeployedRelease({ resurface = false } = {}) {
    const checkSequence = ++releaseCheckSequence;
    if (buildMetadata.environment === 'local') {
      releaseStatus = 'local';
      latestRelease = null;
      updateUi();
      return null;
    }
    if (resurface) {
      dismissedUpdateCommit = '';
    }
    if (navigator.onLine === false) {
      latestRelease = null;
      releaseStatus = 'unverified';
      updateUi();
      return null;
    }
    releaseStatus = 'checking';
    updateUi();
    try {
      const metadata = await fetchLatestDeployment();
      if (checkSequence !== releaseCheckSequence) return latestRelease;
      latestRelease = metadata;
      if (!runningCommit || !/^[a-f0-9]{40}$/i.test(runningCommit)) {
        releaseStatus = 'unverified';
      } else {
        releaseStatus = metadata.commitFull === runningCommit ? 'current' : 'available';
      }
      if (dismissedUpdateCommit && dismissedUpdateCommit !== metadata.commitFull) dismissedUpdateCommit = '';
      updateUi();
      return metadata;
    } catch (error) {
      if (checkSequence !== releaseCheckSequence) return latestRelease;
      latestRelease = null;
      releaseStatus = 'unverified';
      console.warn('Latest deployed release could not be verified.', error);
      updateUi();
      return null;
    }
  }

  function registerUpdateBlocker(name, isBlocked) {
    if (typeof name !== 'string' || !name || typeof isBlocked !== 'function') {
      throw new TypeError('An update blocker requires a name and a callback.');
    }
    const token = Symbol(name);
    updateBlockers.set(token, { name, isBlocked });
    notifyUpdateSafetyChanged();
    return () => {
      updateBlockers.delete(token);
      notifyUpdateSafetyChanged();
    };
  }

  function getUpdateBlockReason() {
    try {
      for (const blocker of updateBlockers.values()) {
        const result = blocker.isBlocked();
        if (result) return typeof result === 'string' ? result : `Finish or exit ${blocker.name} before updating.`;
      }
      return '';
    } catch (error) {
      console.warn('Update safety could not be verified.', error);
      return 'Update is ready, but the app could not verify that it is safe to reload.';
    }
  }

  function notifyUpdateSafetyChanged() {
    updateBlockedReason = getUpdateBlockReason();
    updateUi();
    if (controllerReloadPending && !updateBlockedReason) {
      restartCurrentClient();
    } else if (updatePendingSafety && !updateBlockedReason) {
      updatePendingSafety = false;
      updateRequested = true;
      updateUi();
      continuePendingUpdate();
    }
  }

  function updateUi() {
    renderNetworkStatus();
    renderToast();
    renderSettings();
  }

  async function refreshStorageEstimate() {
    if (!navigator.storage?.estimate) {
      storageEstimate = null;
      updateUi();
      return;
    }
    try {
      storageEstimate = await navigator.storage.estimate();
      updateUi();
    } catch (error) {
      storageEstimate = null;
      console.warn('Storage estimate is unavailable.', error);
      updateUi();
    }
  }

  async function requestPersistentStorageOnce() {
    if (!navigator.storage?.persist) return;
    try {
      if (localStorage.getItem(STORAGE_PERSIST_REQUESTED_KEY) === 'true') return;
      localStorage.setItem(STORAGE_PERSIST_REQUESTED_KEY, 'true');
      await navigator.storage.persist();
    } catch {
      /* persistence is optional */
    }
  }

  function getStatusTarget(registration = activeRegistration) {
    if (navigator.serviceWorker?.controller) {
      return { worker: navigator.serviceWorker.controller, requiresRefresh: false, role: 'controller' };
    }
    if (registration?.waiting) {
      return { worker: registration.waiting, requiresRefresh: true, role: 'waiting' };
    }
    if (registration?.active) {
      return { worker: registration.active, requiresRefresh: true, role: 'active' };
    }
    return null;
  }

  function applyCacheStatus(status, target) {
    cacheStatus = status;
    lastCacheUpdate = status?.updatedAt || lastCacheUpdate;
    if (status?.appCacheReady) {
      offlineReadiness = target?.requiresRefresh ? 'ready-after-refresh' : 'ready';
    } else {
      offlineReadiness = 'error';
    }
    updateUi();
  }

  function requestServiceWorkerStatus(registration = activeRegistration) {
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      offlineReadiness = 'unavailable';
      updateUi();
      return Promise.resolve(null);
    }
    if (typeof MessageChannel !== 'function') {
      offlineReadiness = 'error';
      console.warn('Service worker status request failed: MessageChannel is unavailable.');
      updateUi();
      return Promise.resolve(null);
    }
    const target = getStatusTarget(registration);
    if (!target?.worker?.postMessage) {
      offlineReadiness = registration?.installing ? 'preparing' : 'error';
      updateUi();
      return Promise.resolve(null);
    }

    const requestId = `pwa-status-${Date.now()}-${++statusRequestSequence}`;
    const channel = new MessageChannel();
    return new Promise((resolve) => {
      const cleanup = () => {
        clearTimeout(timeoutId);
        channel.port1.onmessage = null;
        channel.port1.close?.();
      };
      const timeoutId = setTimeout(() => {
        cleanup();
        offlineReadiness = 'error';
        console.warn('Service worker status request timed out.', {
          role: target.role,
          scope: registration?.scope || null,
          controller: navigator.serviceWorker?.controller?.scriptURL || null,
        });
        updateUi();
        resolve(null);
      }, STATUS_REQUEST_TIMEOUT_MS);

      channel.port1.onmessage = (event) => {
        const message = event.data || {};
        if (message.requestId !== requestId) return;
        cleanup();
        if (message.type === 'CACHE_STATUS') {
          applyCacheStatus(message.status, target);
          resolve(message.status);
          return;
        }
        offlineReadiness = 'error';
        console.warn('Service worker status request failed.', message.message || message.type || 'Unknown response');
        updateUi();
        resolve(null);
      };

      try {
        target.worker.postMessage({ type: 'GET_CACHE_STATUS', requestId }, [channel.port2]);
      } catch (error) {
        cleanup();
        offlineReadiness = 'error';
        console.warn('Service worker status request could not be sent.', error);
        updateUi();
        resolve(null);
      }
    });
  }

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }

  function trackInstallingWorker(worker, registration) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          waitingWorker = worker;
        } else {
          offlineReadiness = 'ready-after-refresh';
        }
        updateUi();
        requestServiceWorkerStatus(registration);
      }
      if (worker.state === 'activated') {
        requestServiceWorkerStatus(registration);
      }
      if (worker.state === 'redundant') {
        offlineReadiness = 'error';
        console.warn('Service worker installation failed or was replaced before activation.', {
          scope: registration?.scope || null,
          scriptURL: worker.scriptURL || null,
        });
        updateUi();
      }
    });
  }

  async function registerServiceWorker() {
    if (isLocalPreview()) {
      offlineReadiness = 'unavailable';
      updateUi();
      try {
        await disableLocalPreviewServiceWorkers();
      } catch (error) {
        console.warn('Local preview service-worker cleanup failed.', error);
      }
      return;
    }
    if (!('serviceWorker' in navigator)) {
      offlineReadiness = 'unavailable';
      updateUi();
      return;
    }
    if (!('caches' in window)) {
      offlineReadiness = 'unavailable';
      updateUi();
      return;
    }
    try {
      const registration = await withTimeout(
        navigator.serviceWorker.register(SW_PATH),
        STATUS_REQUEST_TIMEOUT_MS,
        'Service worker registration timed out.',
      );
      activeRegistration = registration;
      inspectControllerBuild();
      checkForServiceWorkerUpdate(registration);
      if (updateCheckTimerId === null && typeof window.setInterval === 'function') {
        updateCheckTimerId = window.setInterval(() => {
          checkForServiceWorkerUpdate(activeRegistration);
          checkForDeployedRelease();
        }, UPDATE_CHECK_INTERVAL_MS);
      }
      updateUi();
      withTimeout(
        navigator.serviceWorker.ready,
        STATUS_REQUEST_TIMEOUT_MS,
        'Service worker ready timed out.',
      )
        .then((readyRegistration) => {
          activeRegistration = readyRegistration;
          requestServiceWorkerStatus(readyRegistration);
          updateUi();
        })
        .catch((error) => {
          offlineReadiness = 'error';
          console.warn('Service worker readiness failed.', error);
          updateUi();
        });
      requestServiceWorkerStatus(registration);

      if (registration.waiting) {
        waitingWorker = registration.waiting;
        updateUi();
      }

      trackInstallingWorker(registration.installing, registration);
      registration.addEventListener('updatefound', () => {
        trackInstallingWorker(registration.installing, registration);
      });
    } catch (error) {
      offlineReadiness = 'error';
      console.warn('Service worker registration failed.', error);
      updateUi();
    }
  }

  async function checkForServiceWorkerUpdate(registration = activeRegistration) {
    if (!registration || navigator.onLine === false || document.visibilityState === 'hidden') return;
    try {
      await registration.update();
    } catch (error) {
      console.warn('Service worker update check failed.', error);
    }
  }

  async function clearApplicationCache() {
    if (navigator.onLine === false) {
      alert('Reconnect before clearing cached app files.');
      return;
    }
    if (!confirm("Clear cached app files? Lee-Lee's Tracker records and local data will not be deleted.")) return;
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
      offlineReadiness = 'preparing';
      cacheStatus = null;
      lastCacheUpdate = null;
      updateUi();
      controller.postMessage({ type: 'CLEAR_APPLICATION_CACHES' });
    } else if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('landos-world-')).map((key) => caches.delete(key)));
      offlineReadiness = 'preparing';
      cacheStatus = null;
      lastCacheUpdate = null;
      updateUi();
      registerServiceWorker();
    }
    refreshStorageEstimate();
  }

  async function handleInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    updateUi();
  }

  function showUpdateFailure(message) {
    if (updateFeedbackTimeoutId !== null) clearTimeout(updateFeedbackTimeoutId);
    updateFeedback = message;
    updateRequested = false;
    updatePendingSafety = false;
    updateUi();
    updateFeedbackTimeoutId = setTimeout(() => {
      updateFeedback = '';
      updateFeedbackTimeoutId = null;
      updateUi();
    }, RESTART_FEEDBACK_TIMEOUT_MS);
    updateFeedbackTimeoutId?.unref?.();
  }

  function requestWorkerBuildMetadata(worker) {
    if (!worker?.postMessage || typeof MessageChannel !== 'function') return Promise.reject(new Error('Worker metadata messaging is unavailable.'));
    const requestId = `pwa-build-${Date.now()}-${++statusRequestSequence}`;
    const channel = new MessageChannel();
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        channel.port1.close?.();
        reject(new Error('Service worker build identity timed out.'));
      }, STATUS_REQUEST_TIMEOUT_MS);
      channel.port1.onmessage = (event) => {
        const response = event.data || {};
        if (response.requestId !== requestId || response.type !== 'BUILD_METADATA') return;
        clearTimeout(timeoutId);
        channel.port1.close?.();
        try {
          resolve(normalizeDeploymentMetadata(response.metadata));
        } catch (error) {
          reject(error);
        }
      };
      try {
        worker.postMessage({ type: 'GET_BUILD_METADATA', requestId }, [channel.port2]);
      } catch (error) {
        clearTimeout(timeoutId);
        channel.port1.close?.();
        reject(error);
      }
    });
  }

  function waitForReleaseWorker(registration, expectedCommit, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const checkedStates = new WeakMap();
      const observedWorkers = new WeakSet();
      let settled = false;
      let pollId = null;
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (pollId !== null) clearTimeout(pollId);
        registration?.removeEventListener?.('updatefound', scheduleInspect);
      };
      const finish = (error, worker) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(worker);
      };
      const inspect = async () => {
        if (settled) return;
        const candidates = [...new Set([registration?.waiting, registration?.installing].filter(Boolean))];
        for (const worker of candidates) {
          if (!observedWorkers.has(worker)) {
            observedWorkers.add(worker);
            worker.addEventListener?.('statechange', scheduleInspect);
          }
          if (checkedStates.get(worker) === worker.state) continue;
          checkedStates.set(worker, worker.state);
          try {
            const metadata = await requestWorkerBuildMetadata(worker);
            if (metadata.commitFull === expectedCommit && worker.state === 'installed' && registration.waiting === worker) {
              finish(null, worker);
              return;
            }
          } catch {
            // Older waiting workers may not implement GET_BUILD_METADATA; keep watching for the deployed build.
          }
        }
        if (!settled) pollId = setTimeout(inspect, 250);
      };
      function scheduleInspect() {
        if (pollId !== null) clearTimeout(pollId);
        pollId = setTimeout(inspect, 0);
      }
      const timeoutId = setTimeout(() => finish(new Error('The update is taking longer than expected.')), timeoutMs);
      registration?.addEventListener?.('updatefound', scheduleInspect);
      inspect();
    });
  }

  function waitForControlledBuild(expectedCommit, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        navigator.serviceWorker?.removeEventListener?.('controllerchange', checkController);
        if (error) reject(error);
        else resolve(true);
      };
      const checkController = async () => {
        const controller = navigator.serviceWorker?.controller;
        if (!controller) return;
        try {
          const metadata = await requestWorkerBuildMetadata(controller);
          if (metadata.commitFull === expectedCommit) finish();
        } catch {
          // A transient controller transition is checked again until timeout.
        }
      };
      const timeoutId = setTimeout(() => finish(new Error('The new service worker did not take control in time.')), timeoutMs);
      navigator.serviceWorker?.addEventListener?.('controllerchange', checkController);
      checkController();
    });
  }

  function reloadAfterVerifiedControl(expectedCommit, { controllerRestart = false } = {}) {
    const blockedReason = getUpdateBlockReason();
    if (blockedReason) {
      if (controllerRestart) {
        controllerReloadPending = true;
      } else {
        updateRequested = false;
        updatePendingSafety = true;
      }
      updateBlockedReason = blockedReason;
      updateUi();
      return false;
    }
    try {
      if (window.sessionStorage.getItem(UPDATE_RELOAD_KEY) === expectedCommit) {
        showUpdateFailure('The update reload was already attempted. No reload loop was started.');
        return false;
      }
      window.sessionStorage.setItem(UPDATE_RELOAD_KEY, expectedCommit);
    } catch (error) {
      showUpdateFailure('The update is ready, but this browser could not set a reload-safety marker.');
      return false;
    }
    updateRequested = false;
    updateFeedback = '';
    window.location.reload();
    return true;
  }

  async function runPendingUpdate() {
    try {
        updateBlockedReason = getUpdateBlockReason();
        if (updateBlockedReason) {
          updateRequested = false;
          updatePendingSafety = true;
          updateUi();
          return;
        }
        if (navigator.onLine === false) throw new Error('You are offline. Reconnect before updating.');
        await checkForDeployedRelease();
        if (!latestRelease || releaseStatus !== 'available') throw new Error('A newer deployed version could not be verified.');
        updateTargetCommit = latestRelease.commitFull;
        const targetCommit = updateTargetCommit;
        if (!activeRegistration) throw new Error('The service worker is not ready yet.');
        await activeRegistration.update();
        const currentController = navigator.serviceWorker?.controller;
        if (currentController) {
          const activeMetadata = await requestWorkerBuildMetadata(currentController).catch(() => null);
          if (activeMetadata?.commitFull === targetCommit) {
            reloadAfterVerifiedControl(targetCommit);
            return;
          }
        }
        const worker = await waitForReleaseWorker(activeRegistration, targetCommit);
        updateBlockedReason = getUpdateBlockReason();
        if (updateBlockedReason) {
          updateRequested = false;
          updatePendingSafety = true;
          updateUi();
          return;
        }
        await checkForDeployedRelease();
        if (!latestRelease || releaseStatus !== 'available' || latestRelease.commitFull !== targetCommit) {
          throw new Error('The deployed release changed while preparing the update. Check again and retry.');
        }
        updateRequested = true;
        updateUi();
        const controlPromise = waitForControlledBuild(targetCommit);
        worker.postMessage({ type: 'SKIP_WAITING' });
        await controlPromise;
        updateRequested = false;
        reloadAfterVerifiedControl(targetCommit);
    } catch (error) {
      console.warn('Safe application update failed.', error);
      showUpdateFailure(error?.message || 'The update could not be completed.');
    }
  }

  function continuePendingUpdate() {
    if (updateOperation) return updateOperation;
    let operation;
    operation = Promise.resolve()
      .then(runPendingUpdate)
      .finally(() => {
        if (updateOperation === operation) updateOperation = null;
        updateUi();
      });
    updateOperation = operation;
    return updateOperation;
  }

  function updateNow() {
    if (updateOperation) return updateOperation;
    if (updatePendingSafety) return;
    updateFeedback = '';
    updateBlockedReason = getUpdateBlockReason();
    updateTargetCommit = latestRelease?.commitFull || '';
    if (updateBlockedReason) {
      updatePendingSafety = true;
      updateUi();
      return;
    }
    updatePendingSafety = false;
    updateRequested = true;
    updateUi();
    return continuePendingUpdate();
  }

  async function inspectControllerBuild() {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return;
    try {
      const metadata = await requestWorkerBuildMetadata(controller);
      if (metadata.commitFull === runningCommit) {
        controllerBuildMismatch = '';
        controllerReloadPending = false;
      } else {
        controllerBuildMismatch = metadata.commitFull;
      }
      updateUi();
    } catch (error) {
      console.warn('Controlling service worker build identity could not be verified.', error);
    }
  }

  function restartCurrentClient() {
    if (updateOperation) return updateOperation;
    if (!controllerBuildMismatch) return;
    updateBlockedReason = getUpdateBlockReason();
    if (updateBlockedReason) {
      controllerReloadPending = true;
      updateUi();
      return;
    }
    controllerReloadPending = true;
    updateFeedback = '';
    updateUi();
    let operation;
    operation = Promise.resolve()
      .then(async () => {
        const controller = navigator.serviceWorker?.controller;
        if (!controller) throw new Error('This tab no longer has a controlling service worker.');
        const metadata = await requestWorkerBuildMetadata(controller);
        if (metadata.commitFull !== controllerBuildMismatch) {
          throw new Error('The controlling build changed. Verify the current update status and try again.');
        }
        reloadAfterVerifiedControl(metadata.commitFull, { controllerRestart: true });
      })
      .catch((error) => {
        console.warn('Safe tab restart failed.', error);
        updateFeedback = error?.message || 'This tab could not verify the controlling build.';
        controllerReloadPending = false;
      })
      .finally(() => {
        if (updateOperation === operation) updateOperation = null;
        updateUi();
      });
    updateOperation = operation;
    return operation;
  }

  function dismissUpdate() {
    dismissedUpdateCommit = latestRelease?.commitFull || '';
    updateBlockedReason = '';
    updateUi();
  }

  function recoverReloadMarker() {
    try {
      const expectedCommit = window.sessionStorage.getItem(UPDATE_RELOAD_KEY);
      if (!expectedCommit) return;
      window.sessionStorage.removeItem(UPDATE_RELOAD_KEY);
      if (expectedCommit !== runningCommit) updateFeedback = 'The update became active, but this page could not confirm the expected build. No automatic retry was made.';
    } catch {
      // No reload was attempted if the safety marker could not be written.
    }
  }

  function handleClick(event) {
    const action = event.target.closest('[data-pwa-action]')?.dataset.pwaAction;
    if (!action) return;
    if (action === 'update-now') {
      updateNow();
      return;
    }
    if (action === 'restart-client') {
      restartCurrentClient();
      return;
    }
    if (action === 'later') {
      dismissUpdate();
      return;
    }
    if (action === 'install') {
      handleInstall();
      return;
    }
    if (action === 'dismiss-install') {
      deferredInstallPrompt = null;
      setInstallDismissed();
      updateUi();
      return;
    }
    if (action === 'clear-cache') {
      clearApplicationCache();
    }
  }

  function initEvents() {
    window.addEventListener('online', () => {
      updateUi();
      checkForServiceWorkerUpdate();
      checkForDeployedRelease({ resurface: true });
      window.dispatchEvent(new CustomEvent('lando:online'));
      window.LandosWeatherApp?.loadWeather?.();
      window.DailyChiefBriefing?.loadWeatherForBriefing?.();
    });
    window.addEventListener('offline', () => {
      latestRelease = null;
      releaseStatus = 'unverified';
      updateUi();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForServiceWorkerUpdate();
        checkForDeployedRelease({ resurface: true });
      }
    });
    window.addEventListener('pageshow', () => {
      checkForServiceWorkerUpdate();
      checkForDeployedRelease({ resurface: true });
    });
    window.addEventListener('lando:update-safety-changed', notifyUpdateSafetyChanged);
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateUi();
    });
    window.addEventListener('appinstalled', () => {
      isInstalled = true;
      deferredInstallPrompt = null;
      updateUi();
    });
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      requestServiceWorkerStatus(activeRegistration);
      inspectControllerBuild();
      updateUi();
    });
    navigator.serviceWorker?.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.type === 'CACHE_STATUS') {
        applyCacheStatus(message.status, { requiresRefresh: false });
      }
      if (message.type === 'CACHE_STATUS_ERROR') {
        offlineReadiness = 'error';
        console.warn('Application cache status is unavailable.', message.message);
        updateUi();
      }
      if (message.type === 'APPLICATION_CACHES_CLEARED') {
        offlineReadiness = 'preparing';
        cacheStatus = null;
        lastCacheUpdate = null;
        updateUi();
        refreshStorageEstimate();
      }
      if (message.type === 'APPLICATION_CACHES_REBUILT') {
        applyCacheStatus(message.status, { requiresRefresh: false });
        refreshStorageEstimate();
      }
      if (message.type === 'APPLICATION_CACHES_REBUILD_FAILED') {
        offlineReadiness = 'error';
        console.warn('Application cache rebuild failed.', message.message);
        updateUi();
        refreshStorageEstimate();
      }
    });
    document.addEventListener('click', handleClick);
  }

  function init() {
    initEvents();
    recoverReloadMarker();
    updateUi();
    registerServiceWorker();
    checkForDeployedRelease();
    refreshStorageEstimate();
    requestPersistentStorageOnce();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.LandosPWA = {
    registerServiceWorker,
    clearApplicationCache,
    checkForUpdates: checkForDeployedRelease,
    updateNow,
    dismissUpdate,
    registerUpdateBlocker,
    notifyUpdateSafetyChanged,
    getState: () => ({
      offlineReady: offlineReadiness === 'ready',
      offlineReadiness,
      isInstalled,
      cacheStatus,
      runningRelease: buildMetadata,
      latestRelease,
      releaseStatus,
      updateBlocked: Boolean(getUpdateBlockReason()),
      controllerBuildMismatch,
      controllerReloadPending,
      storageEstimate,
      hasDeferredInstallPrompt: Boolean(deferredInstallPrompt),
      hasWaitingWorker: Boolean(waitingWorker),
    }),
  };
})();
