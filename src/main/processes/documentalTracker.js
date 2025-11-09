function createDocumentalTracker({ fs, path, processesFilePath } = {}) {
  if (!fs) {
    throw new Error('fs dependency is required');
  }

  if (!path || typeof path.join !== 'function') {
    throw new Error('path dependency is required');
  }

  const filePath = processesFilePath || path.join(process.cwd(), 'documental-processes.json');

  let activeProcesses = {};

  function loadProcesses() {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        activeProcesses = JSON.parse(data);
        console.log('📂 Loaded Documental processes from file:', Object.keys(activeProcesses));
      } else {
        activeProcesses = {};
      }
    } catch (error) {
      console.error('Error loading Documental processes:', error);
      activeProcesses = {};
    }

    return getProcessesSnapshot();
  }

  function persistProcesses() {
    try {
      fs.writeFileSync(filePath, JSON.stringify(activeProcesses, null, 2));
      console.log('💾 Saved Documental processes to file');
    } catch (error) {
      console.error('Error saving Documental processes:', error);
    }
  }

  function addProcess(pid, processInfo) {
    activeProcesses[pid] = {
      pid,
      port: processInfo.port,
      projectId: processInfo.projectId,
      startTime: Date.now(),
      command: processInfo.command,
      cwd: processInfo.cwd
    };
    persistProcesses();
    console.log(`➕ Added Documental process to tracking: PID ${pid}, Port ${processInfo.port}`);
    return getProcess(pid);
  }

  function removeProcess(pid) {
    if (activeProcesses[pid]) {
      delete activeProcesses[pid];
      persistProcesses();
      console.log(`➖ Removed Documental process from tracking: PID ${pid}`);
      return true;
    }
    return false;
  }

  function updateProcess(pid, updates) {
    if (!activeProcesses[pid]) {
      return false;
    }

    activeProcesses[pid] = {
      ...activeProcesses[pid],
      ...updates
    };
    persistProcesses();
    return true;
  }

  function getProcess(pid) {
    const process = activeProcesses[pid];
    return process ? { ...process } : undefined;
  }

  function hasProcess(pid) {
    return Boolean(activeProcesses[pid]);
  }

  function getProcessesSnapshot() {
    return Object.fromEntries(
      Object.entries(activeProcesses).map(([pid, info]) => [pid, { ...info }])
    );
  }

  function getProcessList() {
    return Object.values(activeProcesses).map(info => ({ ...info }));
  }

  return {
    filePath,
    loadProcesses,
    addProcess,
    removeProcess,
    updateProcess,
    getProcess,
    hasProcess,
    getProcessesSnapshot,
    getProcessList
  };
}

module.exports = {
  createDocumentalTracker
};
