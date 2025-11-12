/**
 * @fileoverview Unix/Linux/macOS-specific platform adapter implementation
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { PlatformPort } = require('../ports/PlatformPort.js');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Unix Platform Adapter
 * Implements Unix-specific platform operations (Linux, macOS, FreeBSD, etc.)
 * @class
 * @extends PlatformPort
 */
class UnixPlatformAdapter extends PlatformPort {
  /**
   * Get executable name without extension (Unix style)
   * @param {string} baseName - Base executable name
   * @returns {string} Unix executable name
   */
  async getExecutableName(baseName) {
    // Unix executables typically don't have extensions
    const unixAliases = {
      node: 'node',
      npm: 'npm',
      npx: 'npx',
      git: 'git',
      curl: 'curl',
      wget: 'wget',
      python: 'python3',
      pip: 'pip3'
    };
    
    return unixAliases[baseName] || baseName;
  }

  /**
   * Get Unix-specific shell command
   * @param {string} command - Command name
   * @returns {string} Unix-specific command
   */
  async getShellCommand(command) {
    const unixCommands = {
      where: 'which', // Windows where -> Unix which
      dir: 'ls',      // Windows dir -> Unix ls
      cls: 'clear',    // Windows cls -> Unix clear
      type: 'cat',     // Windows type -> Unix cat
      del: 'rm',       // Windows del -> Unix rm
      copy: 'cp',      // Windows copy -> Unix cp
      move: 'mv',      // Windows move -> Unix mv
      cd: 'pwd',       // Windows cd -> Unix pwd for current dir
      md: 'mkdir',     // Windows md -> Unix mkdir
      rd: 'rmdir',     // Windows rd -> Unix rmdir
      tasklist: 'ps',  // Windows tasklist -> Unix ps
      taskkill: 'kill' // Windows taskkill -> Unix kill
    };
    
    return unixCommands[command] || command;
  }

  /**
   * Get common installation paths for Unix executables
   * @param {string} executable - Executable name
   * @returns {Promise<string[]>} Array of possible Unix paths
   */
  async getCommonPaths(executable) {
    const homeDir = os.homedir();
    const executableName = await this.getExecutableName(executable);
    
    const commonPaths = [
      // System-wide installations
      '/usr/local/bin/' + executableName,
      '/usr/bin/' + executableName,
      '/opt/local/bin/' + executableName, // MacPorts
      '/opt/homebrew/bin/' + executableName, // Apple Silicon Homebrew
      '/usr/local/homebrew/bin/' + executableName, // Intel Homebrew
      '/snap/bin/' + executableName, // Snap packages
      
      // User-specific installations
      path.join(homeDir, '.local', 'bin', executableName),
      path.join(homeDir, '.bin', executableName),
      path.join(homeDir, 'bin', executableName),
      
      // Node Version Manager (NVM)
      path.join(homeDir, '.nvm', 'current', 'bin', executableName),
      path.join(homeDir, '.nvm', 'versions', 'node', '*', 'bin', executableName),
      
      // Volta (Node version manager)
      path.join(homeDir, '.volta', 'bin', executableName),
      path.join(homeDir, '.volta', 'tools', 'image', 'node', '*', 'bin', executableName),
      
      // fnm (Fast Node Manager)
      path.join(homeDir, '.fnm', 'current', 'bin', executableName),
      path.join(homeDir, '.fnm', 'node-versions', '*', 'bin', executableName),
      
      // Nodenv
      path.join(homeDir, '.nodenv', 'versions', '*', 'bin', executableName),
      path.join(homeDir, '.nodenv', 'shims', executableName),
      
      // ASDF (Version manager)
      path.join(homeDir, '.asdf', 'installs', 'nodejs', '*', 'bin', executableName),
      path.join(homeDir, '.asdf', 'shims', executableName),
      
      // macOS specific
      '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/' + executableName,
      
      // Linux distribution specific
      '/usr/lib/nodejs/' + executableName,
      '/usr/libexec/' + executableName,
      
      // Flatpak
      '/var/lib/flatpak/exports/bin/' + executableName,
      path.join(homeDir, '.local', 'share', 'flatpak', 'exports', 'bin', executableName)
    ];
    
    // Add current working directory and system PATH
    commonPaths.push(executableName);
    
    return commonPaths;
  }

  /**
   * Get Unix-specific environment configuration
   * @returns {Promise<Object>} Unix environment configuration
   */
  async getEnvironmentConfig() {
    return {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      LOGNAME: process.env.LOGNAME,
      SHELL: process.env.SHELL,
      TERM: process.env.TERM,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
      DISPLAY: process.env.DISPLAY, // X11 display
      WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY, // Wayland display
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      XDG_DATA_HOME: process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
      NODE_ENV: process.env.NODE_ENV || 'development',
      NODE_PATH: process.env.NODE_PATH
    };
  }

  /**
   * Get default Unix shell
   * @returns {string} Default Unix shell path
   */
  getDefaultShell() {
    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Get Unix path separator
   * @returns {string} Unix path separator
   */
  getPathSeparator() {
    return ':';
  }

  /**
   * Get Unix file path separator
   * @returns {string} Unix file path separator
   */
  getFileSeparator() {
    return '/';
  }

  /**
   * Check if Unix supports symlinks
   * @returns {boolean} Unix symlink support status
   */
  supportsSymlinks() {
    return true; // Unix systems have excellent symlink support
  }

  /**
   * Get Unix file permissions
   * @param {string} filePath - File path
   * @returns {Promise<Object>} Unix file permissions
   */
  async getFilePermissions(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const mode = stats.mode;
      
      return {
        readable: (mode & 0o444) !== 0,  // Read permissions
        writable: (mode & 0o222) !== 0,  // Write permissions
        executable: (mode & 0o111) !== 0, // Execute permissions
        mode: mode,
        octal: (mode & 0o777).toString(8), // Traditional Unix octal notation
        owner: {
          read: (mode & 0o400) !== 0,
          write: (mode & 0o200) !== 0,
          execute: (mode & 0o100) !== 0
        },
        group: {
          read: (mode & 0o040) !== 0,
          write: (mode & 0o020) !== 0,
          execute: (mode & 0o010) !== 0
        },
        other: {
          read: (mode & 0o004) !== 0,
          write: (mode & 0o002) !== 0,
          execute: (mode & 0o001) !== 0
        }
      };
    } catch (error) {
      return {
        readable: false,
        writable: false,
        executable: false,
        mode: null,
        octal: null,
        error: error.message
      };
    }
  }

  /**
   * Set Unix file permissions
   * @param {string} filePath - File path
   * @param {Object} permissions - Permissions object
   * @returns {Promise<boolean>} Success status
   */
  async setFilePermissions(filePath, permissions) {
    try {
      let newMode = 0;
      
      if (permissions.readable) newMode |= 0o444;
      if (permissions.writable) newMode |= 0o222;
      if (permissions.executable) newMode |= 0o111;
      
      // If specific octal mode is provided, use it
      if (permissions.octal) {
        newMode = parseInt(permissions.octal, 8);
      }
      
      // If detailed permissions are provided
      if (permissions.owner) {
        if (permissions.owner.read) newMode |= 0o400;
        if (permissions.owner.write) newMode |= 0o200;
        if (permissions.owner.execute) newMode |= 0o100;
      }
      
      if (permissions.group) {
        if (permissions.group.read) newMode |= 0o040;
        if (permissions.group.write) newMode |= 0o020;
        if (permissions.group.execute) newMode |= 0o010;
      }
      
      if (permissions.other) {
        if (permissions.other.read) newMode |= 0o004;
        if (permissions.other.write) newMode |= 0o002;
        if (permissions.other.execute) newMode |= 0o001;
      }
      
      fs.chmodSync(filePath, newMode);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Unix temporary directory
   * @returns {string} Unix temp directory path
   */
  getTempDirectory() {
    return process.env.TMPDIR || '/tmp';
  }

  /**
   * Get Unix user home directory
   * @returns {string} Unix user home directory
   */
  getHomeDirectory() {
    return os.homedir();
  }

  /**
   * Get Unix application data directory
   * @returns {string} Unix app data directory
   */
  getAppDataDirectory() {
    // Follow XDG Base Directory Specification
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  /**
   * Check if running on Windows
   * @returns {boolean} False for Unix
   */
  isWindows() {
    return false;
  }

  /**
   * Check if running on Unix-like system
   * @returns {boolean} True for Unix platforms
   */
  isUnix() {
    return true;
  }

  /**
   * Check if running on macOS
   * @returns {boolean} True if macOS platform
   */
  isMacOS() {
    return process.platform === 'darwin';
  }

  /**
   * Check if running on Linux
   * @returns {boolean} True if Linux platform
   */
  isLinux() {
    return process.platform === 'linux';
  }

  /**
   * Get Unix platform identifier
   * @returns {string} Unix platform identifier
   */
  getPlatform() {
    return process.platform; // darwin, linux, freebsd, openbsd, sunos
  }

  /**
   * Get Unix architecture identifier
   * @returns {string} Architecture identifier
   */
  getArchitecture() {
    return os.arch();
  }

  /**
   * Get Unix-specific script extension
   * @returns {string} Unix script extension
   */
  getScriptExtension() {
    return '.sh';
  }

  /**
   * Check if running with root privileges
   * @returns {boolean} True if running as root
   */
  isRoot() {
    return process.getuid && process.getuid() === 0;
  }

  /**
   * Check if running with sudo
   * @returns {boolean} True if running with sudo
   */
  isSudo() {
    return process.env.SUDO_USER !== undefined || 
           process.env.SUDO_UID !== undefined ||
           process.env.SUDO_GID !== undefined;
  }

  /**
   * Get Unix-specific environment variable
   * @param {string} varName - Environment variable name
   * @returns {string|undefined} Environment variable value
   */
  getEnvironmentVariable(varName) {
    return process.env[varName];
  }

  /**
   * Set Unix-specific environment variable
   * @param {string} varName - Environment variable name
   * @param {string} value - Environment variable value
   * @returns {boolean} Success status
   */
  setEnvironmentVariable(varName, value) {
    try {
      process.env[varName] = value;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Unix distribution information (Linux only)
   * @returns {Promise<Object|null>} Distribution info or null
   */
  async getDistributionInfo() {
    if (!this.isLinux()) {
      return null;
    }
    
    const releaseFiles = [
      '/etc/os-release',
      '/etc/lsb-release',
      '/etc/redhat-release',
      '/etc/debian_version'
    ];
    
    for (const file of releaseFiles) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const info = {};
          
          content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
              let value = match[2].trim();
              // Remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              info[match[1]] = value;
            }
          });
          
          return info;
        }
      } catch (error) {
        // Continue to next file
      }
    }
    
    return null;
  }

  /**
   * Get Unix-specific termination signal
   * @returns {string} Unix termination signal
   */
  getTerminationSignal() {
    return 'SIGTERM';
  }

  /**
   * Get Unix-specific force termination signal
   * @returns {string} Unix force termination signal
   */
  getForceTerminationSignal() {
    return 'SIGKILL';
  }

  /**
   * Check if a package is installed via package manager
   * @param {string} packageName - Package name
   * @param {string} manager - Package manager (apt, yum, brew, etc)
   * @returns {Promise<boolean>} Whether package is installed
   */
  async isPackageInstalled(packageName, manager = 'auto') {
    const { spawn } = require('child_process');
    
    const managers = {
      apt: `dpkg -l ${packageName}`,
      yum: `rpm -q ${packageName}`,
      dnf: `dnf list installed ${packageName}`,
      pacman: `pacman -Q ${packageName}`,
      zypper: `zypper search -i ${packageName}`,
      brew: `brew list ${packageName}`,
      port: `port installed ${packageName}`,
      pkg: `pkg info ${packageName}`,
      snap: `snap list ${packageName}`,
      flatpak: `flatpak list --app --columns=application | grep ${packageName}`
    };
    
    let command = managers[manager];
    if (manager === 'auto') {
      // Auto-detect package manager
      if (this.isMacOS()) {
        command = managers.brew;
      } else if (this.isLinux()) {
        // Try common Linux package managers in order
        for (const mgr of ['apt', 'dnf', 'yum', 'pacman', 'zypper']) {
          if (fs.existsSync(`/usr/bin/${mgr}`)) {
            command = managers[mgr];
            break;
          }
        }
      }
    }
    
    if (!command) {
      return false;
    }
    
    return new Promise((resolve) => {
      const child = spawn(command, { shell: true });
      child.on('close', (code) => {
        resolve(code === 0);
      });
      child.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = {
  UnixPlatformAdapter
};