// Gordon Mission Control - Main Script

const INSTANCES = {
  day: {
    url: 'https://day.singularity-labs.org',
    name: 'Brother Day',
    host: 'Linux Laptop',
    specs: { cores: 8, ramGB: 32 }
  },
  dusk: {
    url: 'https://dusk.singularity-labs.org', 
    name: 'Brother Dusk',
    host: 'Beelink',
    specs: { cores: 4, ramGB: 16 }
  },
  dawn: {
    url: 'https://dawn.singularity-labs.org',
    name: 'Brother Dawn', 
    host: 'Gaming PC',
    specs: { cores: 16, ramGB: 64 }
  }
};

// System metrics state
const metrics = {
  day: { cpu: 0, ramUsed: 0, ramTotal: 32 },
  dusk: { cpu: 0, ramUsed: 0, ramTotal: 16 },
  dawn: { cpu: 0, ramUsed: 0, ramTotal: 64 }
};

// Update metrics display
function updateMetricsUI(instance) {
  const container = document.getElementById(`metrics-${instance}`);
  if (!container) return;
  
  const m = metrics[instance];
  const cpuFill = container.querySelector('.cpu-fill');
  const cpuValue = container.querySelector('.cpu-value');
  const ramFill = container.querySelector('.ram-fill');
  const ramValue = container.querySelector('.ram-value');
  
  if (cpuFill && cpuValue) {
    cpuFill.style.width = `${m.cpu}%`;
    cpuValue.textContent = `${m.cpu}%`;
  }
  
  if (ramFill && ramValue) {
    const ramPercent = (m.ramUsed / m.ramTotal) * 100;
    ramFill.style.width = `${ramPercent}%`;
    ramValue.textContent = `${m.ramUsed.toFixed(1)}GB`;
  }
}

// Fetch metrics from an instance (placeholder - needs backend)
async function fetchMetrics(instance) {
  // TODO: Implement actual metrics fetching via API
  // For now, simulate with random data for demo
  metrics[instance] = {
    cpu: Math.floor(Math.random() * 40) + 10,
    ramUsed: (Math.random() * INSTANCES[instance].specs.ramGB * 0.6) + 2,
    ramTotal: INSTANCES[instance].specs.ramGB
  };
  updateMetricsUI(instance);
}

// Fetch all metrics
function fetchAllMetrics() {
  Object.keys(INSTANCES).forEach(instance => {
    fetchMetrics(instance);
  });
}

// Check instance status
async function checkStatus(instance) {
  const statusItem = document.querySelector(`.status-item[data-instance="${instance}"]`);
  
  try {
    // Try to reach the instance (will fail due to CORS, but we can check if it responds)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(INSTANCES[instance].url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    statusItem.dataset.status = 'online';
  } catch (error) {
    // If aborted, it's offline. If other error, might still be online (CORS)
    if (error.name === 'AbortError') {
      statusItem.dataset.status = 'offline';
    } else {
      // CORS error usually means the server responded
      statusItem.dataset.status = 'online';
    }
  }
}

// Refresh a single panel
function refreshPanel(instance) {
  const frame = document.getElementById(`frame-${instance}`);
  const panel = frame.closest('.panel');
  
  panel.classList.add('loading');
  frame.src = frame.src;
  
  frame.onload = () => {
    panel.classList.remove('loading');
    checkStatus(instance);
  };
}

// Refresh all panels
function refreshAll() {
  Object.keys(INSTANCES).forEach(instance => {
    refreshPanel(instance);
  });
}

// Open instance in new tab
function openExternal(instance) {
  window.open(INSTANCES[instance].url, '_blank');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check all statuses
  Object.keys(INSTANCES).forEach(instance => {
    checkStatus(instance);
  });
  
  // Initial metrics fetch
  fetchAllMetrics();
  
  // Set up iframe load handlers
  Object.keys(INSTANCES).forEach(instance => {
    const frame = document.getElementById(`frame-${instance}`);
    frame.onload = () => {
      checkStatus(instance);
    };
    frame.onerror = () => {
      const statusItem = document.querySelector(`.status-item[data-instance="${instance}"]`);
      statusItem.dataset.status = 'offline';
    };
  });
  
  // Periodic status check (every 30 seconds)
  setInterval(() => {
    Object.keys(INSTANCES).forEach(instance => {
      checkStatus(instance);
    });
  }, 30000);
  
  // Periodic metrics update (every 10 seconds)
  setInterval(fetchAllMetrics, 10000);
});

// Expose functions globally for onclick handlers
window.refreshPanel = refreshPanel;
window.refreshAll = refreshAll;
window.openExternal = openExternal;
