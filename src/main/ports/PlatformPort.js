/**
 * @fileoverview Platform abstraction port interface
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

/**
 * Platform Port - Abstract interface for platform-specific operations
 * @class
 * @abstract
 */
class PlatformPort {
  /**
   * Get executable name with platform-specific extension
   * @param {string} baseName - Base executable name (node, npm, npx)
   * @returns {string} Platform-specific executable name
   * @abstract
   */
  async getExecutableName(baseName) {
    throw new Error('getExecutableName must be implemented by subclass');
  }

  /**
   * Get platform-specific shell command equivalent
   * @param {string} command - Command name (which, where, etc)
   * @returns {string} Platform-specific command
   * @abstract
   */
  async getShellCommand(command) {
    throw new Error('getShellCommand must be implemented by subclass');
  }

  /**
   * Get common installation paths for executables
   * @param {string} executable - Executable name
   * @returns {Promise<string[]>} Array of possible paths
   * @abstract
   */
  async getCommonPaths(executable) {
    throw new Error('getCommonPaths must be implemented by subclass');
  }

  /**
   * Get platform-specific environment configuration
   * @returns {Promise<Object>} Environment configuration object
   * @abstract
   */
  async getEnvironmentConfig() {
    throw new Error('getEnvironmentConfig must be implemented by subclass');
  }

  /**
   * Get default shell for the platform
   * @returns {string} Default shell path
   * @abstract
   */
  getDefaultShell() {
    throw new Error('getDefaultShell must be implemented by subclass');
  }

  /**
   * Get path separator for the platform
   * @returns {string} Path separator (; or :)
   * @abstract
   */
  getPathSeparator() {
    throw new Error('getPathSeparator must be implemented by subclass');
  }

  /**
   * Get file path separator for the platform
   * @returns {string} File path separator (\\ or /)
   * @abstract
   */
  getFileSeparator() {
    throw new Error('getFileSeparator must be implemented by subclass');
  }

  /**
   * Check if platform supports symlinks
   * @returns {boolean} Whether symlinks are supported
   * @abstract
   */
  supportsSymlinks() {
    throw new Error('supportsSymlinks must be implemented by subclass');
  }

  /**
   * Get platform-specific file permissions
   * @param {string} filePath - File path
   * @returns {Promise<Object>} File permissions object
   * @abstract
   */
  async getFilePermissions(filePath) {
    throw new Error('getFilePermissions must be implemented by subclass');
  }

  /**
   * Set platform-specific file permissions
   * @param {string} filePath - File path
   * @param {Object} permissions - Permissions object
   * @returns {Promise<boolean>} Success status
   * @abstract
   */
  async setFilePermissions(filePath, permissions) {
    throw new Error('setFilePermissions must be implemented by subclass');
  }

  /**
   * Get platform-specific temporary directory
   * @returns {string} Temporary directory path
   * @abstract
   */
  getTempDirectory() {
    throw new Error('getTempDirectory must be implemented by subclass');
  }

  /**
   * Get platform-specific user home directory
   * @returns {string} User home directory path
   * @abstract
   */
  getHomeDirectory() {
    throw new Error('getHomeDirectory must be implemented by subclass');
  }

  /**
   * Get platform-specific application data directory
   * @returns {string} App data directory path
   * @abstract
   */
  getAppDataDirectory() {
    throw new Error('getAppDataDirectory must be implemented by subclass');
  }

  /**
   * Check if running on Windows
   * @returns {boolean} True if Windows platform
   * @abstract
   */
  isWindows() {
    throw new Error('isWindows must be implemented by subclass');
  }

  /**
   * Check if running on Unix-like system
   * @returns {boolean} True if Unix-like platform
   * @abstract
   */
  isUnix() {
    throw new Error('isUnix must be implemented by subclass');
  }

  /**
   * Check if running on macOS
   * @returns {boolean} True if macOS platform
   * @abstract
   */
  isMacOS() {
    throw new Error('isMacOS must be implemented by subclass');
  }

  /**
   * Check if running on Linux
   * @returns {boolean} True if Linux platform
   * @abstract
   */
  isLinux() {
    throw new Error('isLinux must be implemented by subclass');
  }

  /**
   * Get platform identifier
   * @returns {string} Platform identifier (win32, darwin, linux)
   * @abstract
   */
  getPlatform() {
    throw new Error('getPlatform must be implemented by subclass');
  }

  /**
   * Get architecture identifier
   * @returns {string} Architecture identifier (x64, arm64)
   * @abstract
   */
  getArchitecture() {
    throw new Error('getArchitecture must be implemented by subclass');
  }

  /**
   * Get platform-specific termination signal
   * @returns {string} Termination signal for graceful shutdown
   * @abstract
   */
  getTerminationSignal() {
    throw new Error('getTerminationSignal must be implemented by subclass');
  }

  /**
   * Get platform-specific force termination signal
   * @returns {string} Force termination signal for immediate shutdown
   * @abstract
   */
  getForceTerminationSignal() {
    throw new Error('getForceTerminationSignal must be implemented by subclass');
  }
}

module.exports = {
  PlatformPort
};