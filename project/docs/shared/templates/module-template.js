/**
 * @fileoverview Template for CommonJS modules in the main process
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { EventEmitter } = require('events');

/**
 * @typedef {Object} ModuleConfig
 * @property {string} name - Module name
 * @property {Object} options - Module options
 */

/**
 * Module template class
 * @class
 * @extends EventEmitter
 */
class ModuleTemplate extends EventEmitter {
  /**
   * Creates an instance of ModuleTemplate
   * @param {ModuleConfig} config - Module configuration
   * @example
   * const module = new ModuleTemplate({
   *   name: 'my-module',
   *   options: { debug: true }
   * });
   */
  constructor(config = {}) {
    super();
    this.config = {
      name: 'module-template',
      options: {},
      ...config
    };
    this.initialized = false;
  }

  /**
   * Initialize the module
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    if (this.initialized) {
      throw new Error('Module already initialized');
    }

    try {
      // Initialization logic here
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Cleanup module resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.initialized) {
      return;
    }

    try {
      // Cleanup logic here
      this.initialized = false;
      this.emit('cleanup');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get module status
   * @returns {Object} Module status
   */
  getStatus() {
    return {
      name: this.config.name,
      initialized: this.initialized,
      config: this.config
    };
  }
}

module.exports = {
  ModuleTemplate
};