// Gordon Mission Control - Main Script

const INSTANCES = {
  day: {
    url: 'https://day.singularity-labs.org',
    name: 'Brother Day',
    host: 'Linux Laptop'
  },
  dusk: {
    url: 'https://dusk.singularity-labs.org', 
    name: 'Brother Dusk',
    host: 'Beelink'
  },
  dawn: {
    url: 'https://dawn.singularity-labs.org',
    name: 'Brother Dawn', 
    host: 'Gaming PC'
  }
};

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
});

// Expose functions globally for onclick handlers
window.refreshPanel = refreshPanel;
window.refreshAll = refreshAll;
window.openExternal = openExternal;
