/**
 * @fileoverview Platform-specific process inspector factory
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { WindowsProcessInspector } = require('./windows.js');
const { UnixProcessInspector } = require('./unix.js');

/**
 * Platform factory for creating appropriate process inspectors
 * @class
 */
class ProcessInspectorFactory {
  /**
   * Get the appropriate process inspector for the current platform
   * @returns {Object} Process inspector instance
   */
  static getInspector() {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return WindowsProcessInspector;
      
      case 'darwin':
      case 'linux':
      case 'freebsd':
      case 'openbsd':
      case 'sunos':
        return UnixProcessInspector;
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get platform name
   * @returns {string} Platform identifier
   */
  static getPlatformName() {
    return process.platform;
  }

  /**
   * Check if current platform is Windows
   * @returns {boolean} True if running on Windows
   */
  static isWindows() {
    return process.platform === 'win32';
  }

  /**
   * Check if current platform is Unix-like
   * @returns {boolean} True if running on Unix-like system
   */
  static isUnix() {
    return ['darwin', 'linux', 'freebsd', 'openbsd', 'sunos'].includes(process.platform);
  }

  /**
   * Check if current platform is macOS
   * @returns {boolean} True if running on macOS
   */
  static isMacOS() {
    return process.platform === 'darwin';
  }

  /**
   * Check if current platform is Linux
   * @returns {boolean} True if running on Linux
   */
  static isLinux() {
    return process.platform === 'linux';
  }
}

module.exports = {
  ProcessInspectorFactory
};