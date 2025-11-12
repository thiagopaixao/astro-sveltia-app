/**
 * @fileoverview Windows-specific platform adapter implementation
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { PlatformPort } = require('../ports/PlatformPort.js');
const os = require('os');
const path = require('path');

/**
 * Windows Platform Adapter
 * Implements Windows-specific platform operations
 * @class
 * @extends PlatformPort
 */
class WindowsPlatformAdapter extends PlatformPort {
  /**
   * Get executable name with Windows extension
   * @param {string} baseName - Base executable name
   * @returns {string} Windows executable name with extension
   */
  async getExecutableName(baseName) {
    const extensions = {
      node: 'node.exe',
      npm: 'npm.cmd',
      npx: 'npx.cmd',
      git: 'git.exe',
      curl: 'curl.exe',
      wget: 'wget.exe'
    };
    
    return extensions[baseName] || `${baseName}.exe`;
  }

  /**
   * Get Windows-specific shell command equivalent
   * @param {string} command - Command name
   * @returns {string} Windows-specific command
   */
  async getShellCommand(command) {
    const windowsCommands = {
      which: 'where',
      ls: 'dir',
      clear: 'cls',
      cat: 'type',
      rm: 'del',
      cp: 'copy',
      mv: 'move',
      pwd: 'cd',
      mkdir: 'mkdir',
      rmdir: 'rmdir',
      echo: 'echo',
      env: 'set',
      ps: 'tasklist',
      kill: 'taskkill'
    };
    
    return windowsCommands[command] || command;
  }

  /**
   * Get common installation paths for Windows executables
   * @param {string} executable - Executable name
   * @returns {Promise<string[]>} Array of possible Windows paths
   */
  async getCommonPaths(executable) {
    const homeDir = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    
    const executableName = await this.getExecutableName(executable);
    
    const commonPaths = [
      // System-wide installations
      path.join(programFiles, 'nodejs', executableName),
      path.join(programFilesX86, 'nodejs', executableName),
      
      // User-specific installations
      path.join(localAppData, 'Programs', 'nodejs', executableName),
      path.join(homeDir, 'AppData', 'Local', 'Programs', 'nodejs', executableName),
      path.join(homeDir, 'nvm', 'current', executableName),
      path.join(homeDir, 'scoop', 'shims', executableName),
      
      // Chocolatey
      path.join(programFiles, 'chocolatey', 'bin', executableName),
      path.join(programFilesX86, 'chocolatey', 'bin', executableName),
      
      // Common development tools
      path.join(programFiles, 'Git', 'cmd', executableName),
      path.join(programFilesX86, 'Git', 'cmd', executableName),
      path.join(programFiles, 'Git', 'bin', executableName),
      path.join(programFilesX86, 'Git', 'bin', executableName)
    ];
    
    // Add current working directory and system PATH
    commonPaths.push(executableName);
    
    return commonPaths;
  }

  /**
   * Get Windows-specific environment configuration
   * @returns {Promise<Object>} Windows environment configuration
   */
  async getEnvironmentConfig() {
    return {
      PATH: process.env.PATH,
      PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC',
      USERPROFILE: process.env.USERPROFILE,
      APPDATA: process.env.APPDATA,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
      PROGRAMFILES: process.env.PROGRAMFILES,
      'PROGRAMFILES(X86)': process.env['PROGRAMFILES(X86)'],
      SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\Windows',
      TEMP: process.env.TEMP || process.env.TMP,
      NODE_ENV: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Get default Windows shell
   * @returns {string} Default Windows shell path
   */
  getDefaultShell() {
    return process.env.COMSPEC || 'cmd.exe';
  }

  /**
   * Get Windows path separator
   * @returns {string} Windows path separator
   */
  getPathSeparator() {
    return ';';
  }

  /**
   * Get Windows file path separator
   * @returns {string} Windows file path separator
   */
  getFileSeparator() {
    return '\\';
  }

  /**
   * Check if Windows supports symlinks
   * @returns {boolean} Windows symlink support status
   */
  supportsSymlinks() {
    // Windows supports symlinks on Vista+ with proper permissions
    return true;
  }

  /**
   * Get Windows file permissions
   * @param {string} filePath - File path
   * @returns {Promise<Object>} Windows file permissions
   */
  async getFilePermissions(filePath) {
    const fs = require('fs');
    try {
      const stats = fs.statSync(filePath);
      return {
        readable: true, // Windows uses ACLs, simplified here
        writable: !(stats.mode & 0x200), // Write permission check
        executable: stats.isFile() && filePath.endsWith('.exe'),
        mode: stats.mode
      };
    } catch (error) {
      return {
        readable: false,
        writable: false,
        executable: false,
        mode: null,
        error: error.message
      };
    }
  }

  /**
   * Set Windows file permissions
   * @param {string} filePath - File path
   * @param {Object} permissions - Permissions object
   * @returns {Promise<boolean>} Success status
   */
  async setFilePermissions(filePath, permissions) {
    const fs = require('fs');
    try {
      if (permissions.writable !== undefined) {
        const currentMode = fs.statSync(filePath).mode;
        const newMode = permissions.writable ? 
          currentMode | 0x200 : // Add write permission
          currentMode & ~0x200; // Remove write permission
        fs.chmodSync(filePath, newMode);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Windows temporary directory
   * @returns {string} Windows temp directory path
   */
  getTempDirectory() {
    return process.env.TEMP || process.env.TMP || path.join(os.tmpdir());
  }

  /**
   * Get Windows user home directory
   * @returns {string} Windows user home directory
   */
  getHomeDirectory() {
    return os.homedir();
  }

  /**
   * Get Windows application data directory
   * @returns {string} Windows app data directory
   */
  getAppDataDirectory() {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }

  /**
   * Check if running on Windows
   * @returns {boolean} True if Windows platform
   */
  isWindows() {
    return true;
  }

  /**
   * Check if running on Unix-like system
   * @returns {boolean} False for Windows
   */
  isUnix() {
    return false;
  }

  /**
   * Check if running on macOS
   * @returns {boolean} False for Windows
   */
  isMacOS() {
    return false;
  }

  /**
   * Check if running on Linux
   * @returns {boolean} False for Windows
   */
  isLinux() {
    return false;
  }

  /**
   * Get Windows platform identifier
   * @returns {string} Windows platform identifier
   */
  getPlatform() {
    return 'win32';
  }

  /**
   * Get Windows architecture identifier
   * @returns {string} Architecture identifier
   */
  getArchitecture() {
    return os.arch();
  }

  /**
   * Get Windows-specific script extension
   * @returns {string} Windows script extension
   */
  getScriptExtension() {
    return '.bat';
  }

  /**
   * Check if running with administrator privileges
   * @returns {boolean} True if running as administrator
   */
  isAdministrator() {
    try {
      // This is a simplified check - in production, you'd want to use Windows APIs
      return process.env.USERNAME === 'Administrator' || 
             process.env.USERNAME === 'SYSTEM' ||
             process.env.WINDIR.includes('Windows');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Windows-specific environment variable
   * @param {string} varName - Environment variable name
   * @returns {string|undefined} Environment variable value
   */
  getEnvironmentVariable(varName) {
    return process.env[varName];
  }

  /**
   * Set Windows-specific environment variable
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
   * Get Windows-specific termination signal
   * @returns {string} Windows termination signal
   */
  getTerminationSignal() {
    return 'SIGTERM';
  }

  /**
   * Get Windows-specific force termination signal
   * @returns {string} Windows force termination signal
   */
  getForceTerminationSignal() {
    return 'SIGKILL';
  }
}

module.exports = {
  WindowsPlatformAdapter
};