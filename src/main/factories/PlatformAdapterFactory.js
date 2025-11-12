/**
 * @fileoverview Platform adapter factory for creating platform-specific instances
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { WindowsPlatformAdapter } = require('../adapters/WindowsPlatformAdapter.js');
const { UnixPlatformAdapter } = require('../adapters/UnixPlatformAdapter.js');

/**
 * Platform Adapter Factory
 * Creates appropriate platform adapter based on current operating system
 * @class
 */
class PlatformAdapterFactory {
  /**
   * Adapter cache for singleton instances
   * @type {Map<string, Object>}
   * @private
   */
  static _adapterCache = new Map();

  /**
   * Create platform adapter for current system
   * @param {string} [platform] - Platform override (for testing)
   * @returns {PlatformPort} Platform-specific adapter instance
   * @throws {Error} If platform is not supported
   */
  static createAdapter(platform = null) {
    const currentPlatform = platform || process.platform;
    
    // Check cache first
    if (this._adapterCache.has(currentPlatform)) {
      return this._adapterCache.get(currentPlatform);
    }
    
    let adapter;
    switch (currentPlatform) {
      case 'win32':
        adapter = new WindowsPlatformAdapter();
        break;
        
      case 'darwin':
      case 'linux':
      case 'freebsd':
      case 'openbsd':
      case 'sunos':
      case 'aix':
        adapter = new UnixPlatformAdapter();
        break;
        
      default:
        // For unknown platforms, default to Unix adapter
        adapter = new UnixPlatformAdapter();
        break;
    }
    
    // Cache the adapter
    this._adapterCache.set(currentPlatform, adapter);
    return adapter;
  }

  /**
   * Clear the adapter cache
   * @returns {void}
   */
  static clearCache() {
    this._adapterCache.clear();
  }

  /**
   * Get platform type category
   * @param {string} [platform] - Platform identifier
   * @returns {string} Platform type ('windows' or 'unix')
   */
  static getPlatformType(platform = null) {
    const currentPlatform = platform || process.platform;
    
    switch (currentPlatform) {
      case 'win32':
        return 'windows';
        
      case 'darwin':
      case 'linux':
      case 'freebsd':
      case 'openbsd':
      case 'sunos':
      case 'aix':
        return 'unix';
        
      default:
        return 'unix'; // Default to unix for unknown platforms
    }
  }

  /**
   * Get current platform identifier
   * @returns {string} Current platform identifier
   */
  static getCurrentPlatform() {
    return process.platform;
  }

  /**
   * Get current architecture identifier
   * @returns {string} Current architecture identifier
   */
  static getCurrentArchitecture() {
    return process.arch;
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
    const unixPlatforms = ['darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix'];
    return unixPlatforms.includes(process.platform);
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

  /**
   * Check if current platform is FreeBSD
   * @returns {boolean} True if running on FreeBSD
   */
  static isFreeBSD() {
    return process.platform === 'freebsd';
  }

  /**
   * Check if current platform is OpenBSD
   * @returns {boolean} True if running on OpenBSD
   */
  static isOpenBSD() {
    return process.platform === 'openbsd';
  }

  /**
   * Check if current platform is SunOS
   * @returns {boolean} True if running on SunOS
   */
  static isSunOS() {
    return process.platform === 'sunos';
  }

  /**
   * Check if current platform is AIX
   * @returns {boolean} True if running on AIX
   */
  static isAIX() {
    return process.platform === 'aix';
  }

  /**
   * Check if current architecture is x64
   * @returns {boolean} True if running on x64 architecture
   */
  static isX64() {
    return process.arch === 'x64';
  }

  /**
   * Check if current architecture is ARM64
   * @returns {boolean} True if running on ARM64 architecture
   */
  static isARM64() {
    return process.arch === 'arm64';
  }

  /**
   * Check if current architecture is ARM
   * @returns {boolean} True if running on ARM architecture
   */
  static isARM() {
    return process.arch === 'arm';
  }

  /**
   * Check if current architecture is IA32
   * @returns {boolean} True if running on IA32 architecture
   */
  static isIA32() {
    return process.arch === 'ia32';
  }

  /**
   * Get platform and architecture combination
   * @returns {string} Platform-architecture string (e.g., "win32-x64")
   */
  static getPlatformArch() {
    return `${process.platform}-${process.arch}`;
  }

  /**
   * Get all supported platforms
   * @returns {string[]} Array of supported platform identifiers
   */
  static getSupportedPlatforms() {
    return ['win32', 'darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix'];
  }

  /**
   * Get all supported architectures
   * @returns {string[]} Array of supported architecture identifiers
   */
  static getSupportedArchitectures() {
    return ['x64', 'arm64', 'arm', 'ia32'];
  }

  /**
   * Check if platform-architecture combination is supported
   * @param {string} platform - Platform identifier
   * @param {string} arch - Architecture identifier
   * @returns {boolean} True if combination is supported
   */
  static isSupported(platform, arch) {
    return this.getSupportedPlatforms().includes(platform) && 
           this.getSupportedArchitectures().includes(arch);
  }

  /**
   * Get platform-specific information object
   * @returns {Object} Platform information
   */
  static getPlatformInfo() {
    const adapter = this.createAdapter();
    
    return {
      platform: adapter.getPlatform(),
      architecture: adapter.getArchitecture(),
      platformArch: this.getPlatformArch(),
      isWindows: adapter.isWindows(),
      isUnix: adapter.isUnix(),
      isMacOS: adapter.isMacOS(),
      isLinux: adapter.isLinux(),
      isFreeBSD: adapter.isFreeBSD(),
      isOpenBSD: adapter.isOpenBSD(),
      isSunOS: adapter.isSunOS(),
      isAIX: adapter.isAIX(),
      isX64: this.isX64(),
      isARM64: this.isARM64(),
      isARM: this.isARM(),
      isIA32: this.isIA32(),
      pathSeparator: adapter.getPathSeparator(),
      fileSeparator: adapter.getFileSeparator(),
      scriptExtension: adapter.getScriptExtension(),
      defaultShell: adapter.getDefaultShell(),
      tempDirectory: adapter.getTempDirectory(),
      homeDirectory: adapter.getHomeDirectory(),
      appDataDirectory: adapter.getAppDataDirectory(),
      supportsSymlinks: adapter.supportsSymlinks()
    };
  }

  /**
   * Create adapter for testing purposes
   * @param {string} platform - Mock platform
   * @param {string} arch - Mock architecture
   * @returns {PlatformPort} Mock adapter instance
   */
  static createTestAdapter(platform, arch) {
    // Store original values
    const originalPlatform = process.platform;
    const originalArch = process.arch;
    
    // Temporarily override for testing
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true
    });
    
    Object.defineProperty(process, 'arch', {
      value: arch,
      configurable: true
    });
    
    try {
      const adapter = this.createAdapter();
      
      // Restore original values
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
      
      Object.defineProperty(process, 'arch', {
        value: originalArch,
        configurable: true
      });
      
      return adapter;
    } catch (error) {
      // Restore original values on error
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
      
      Object.defineProperty(process, 'arch', {
        value: originalArch,
        configurable: true
      });
      
      throw error;
    }
  }

  /**
   * Validate platform adapter implementation
   * @param {PlatformPort} adapter - Adapter instance to validate
   * @returns {Object} Validation result
   */
  static validateAdapter(adapter) {
    const requiredMethods = [
      'getExecutableName',
      'getShellCommand',
      'getCommonPaths',
      'getEnvironmentConfig',
      'getDefaultShell',
      'getPathSeparator',
      'getFileSeparator',
      'supportsSymlinks',
      'getFilePermissions',
      'setFilePermissions',
      'getTempDirectory',
      'getHomeDirectory',
      'getAppDataDirectory',
      'isWindows',
      'isUnix',
      'isMacOS',
      'isLinux',
      'getPlatform',
      'getArchitecture'
    ];
    
    const validation = {
      valid: true,
      missingMethods: [],
      invalidMethods: []
    };
    
    for (const method of requiredMethods) {
      if (typeof adapter[method] !== 'function') {
        validation.valid = false;
        validation.missingMethods.push(method);
      }
    }
    
    // Test basic functionality
    try {
      adapter.getPlatform();
      adapter.getArchitecture();
      adapter.getPathSeparator();
      adapter.getFileSeparator();
    } catch (error) {
      validation.valid = false;
      validation.invalidMethods.push('basic functionality');
    }
    
    return validation;
  }
}

module.exports = {
  PlatformAdapterFactory
};