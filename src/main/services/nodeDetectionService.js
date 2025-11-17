/**
 * @fileoverview Managed Node.js detection and installation service
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { spawn } = require('child_process');
const { NodeRuntimeManager } = require('./nodeRuntimeManager.js');

/**
 * Handles discovery and installation of the managed Node.js runtime
 */
class NodeDetectionService {
  /**
   * Create service instance
   * @param {Object} dependencies - Dependency container
   * @param {Object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    this.logger = logger;
    this.runtimeManager = new NodeRuntimeManager({ logger });
    this.MIN_REQUIRED_MAJOR = 20;
  }

  /**
   * Detect current runtime state and system Node availability
   * @returns {Promise<Object>} Detection payload
   */
  async detectNodeInstallation() {
    this.logger.info('🔍 Verificando estado do Node.js gerenciado...');

    try {
      const runtimeInfo = await this.runtimeManager.getRuntimeInfo();
      const systemNode = await this.checkSystemNode();
      const recommendation = runtimeInfo.installed && runtimeInfo.isValid
        ? 'managed_ready'
        : 'install_required';

      return {
        runtime: this.normalizeRuntimeInfo(runtimeInfo),
        systemNode,
        recommendation
      };
    } catch (error) {
      this.logger.error('❌ Falha ao detectar Node.js:', error);
      return {
        runtime: this.normalizeRuntimeInfo(),
        systemNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  }

  /**
   * Normalize runtime data for renderer consumption
   * @param {import('./nodeRuntimeManager.js').RuntimeInfo} [runtimeInfo]
   * @returns {Object} Normalized runtime payload
   */
  normalizeRuntimeInfo(runtimeInfo) {
    if (!runtimeInfo) {
      return {
        installed: false,
        isValid: false,
        version: null,
        npmVersion: null,
        nodePath: null,
        npmPath: null,
        major: 0,
        minor: 0,
        patch: 0
      };
    }

    return {
      installed: runtimeInfo.installed,
      isValid: runtimeInfo.isValid,
      version: runtimeInfo.version,
      npmVersion: runtimeInfo.npmVersion,
      nodePath: runtimeInfo.nodePath,
      npmPath: runtimeInfo.npmPath,
      npxPath: runtimeInfo.installed ? this.runtimeManager.getNpxExecutablePath() : null,
      major: runtimeInfo.major,
      minor: runtimeInfo.minor,
      patch: runtimeInfo.patch
    };
  }

  /**
   * Install or update the managed Node runtime
   * @param {Object} [options] - Installation options
   * @param {boolean} [options.force=false] - Force reinstall
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Object>} Updated runtime info
   */
  async installManagedRuntime(options = {}) {
    const runtimeInfo = await this.runtimeManager.installRuntime(options);
    return this.normalizeRuntimeInfo(runtimeInfo);
  }

  /**
   * Get preferred Node executable (managed runtime)
   * @returns {Promise<string>} Executable path
   */
  async getPreferredNodeExecutable() {
    const runtimeInfo = await this.runtimeManager.getRuntimeInfo();
    if (!runtimeInfo.installed || !runtimeInfo.isValid || !runtimeInfo.nodePath) {
      throw new Error('Node.js gerenciado não instalado. Conclua a etapa de download.');
    }
    return runtimeInfo.nodePath;
  }

  /**
   * Get preferred npm executable (managed runtime)
   * @returns {Promise<string>} npm path
   */
  async getPreferredNpmExecutable() {
    const runtimeInfo = await this.runtimeManager.getRuntimeInfo();
    if (!runtimeInfo.installed || !runtimeInfo.isValid || !runtimeInfo.npmPath) {
      throw new Error('npm gerenciado não está disponível. Reinstale o Node.js.');
    }
    return runtimeInfo.npmPath;
  }

  /**
   * Get preferred npx executable (managed runtime)
   * @returns {Promise<string>} npx path
   */
  async getPreferredNpxExecutable() {
    const runtimeInfo = await this.runtimeManager.getRuntimeInfo();
    if (!runtimeInfo.installed || !runtimeInfo.isValid) {
      throw new Error('npx não está disponível. Reinstale o Node.js gerenciado.');
    }
    return this.runtimeManager.getNpxExecutablePath();
  }

  /**
   * Environment additions required when running managed Node/npm
   * @param {NodeJS.ProcessEnv} [baseEnv=process.env] - Base environment
   * @returns {NodeJS.ProcessEnv} Environment variables
   */
  getManagedRuntimeEnv(baseEnv = process.env) {
    return this.runtimeManager.buildRuntimeEnv(baseEnv);
  }

  /**
   * Discover system Node.js installation (if available)
   * @returns {Promise<Object|null>} System node description
   */
  async checkSystemNode() {
    return new Promise((resolve) => {
      const child = spawn('node', ['-p', 'JSON.stringify({ version: process.version, path: process.execPath })'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.on('error', () => resolve(null));
      child.on('close', (code) => {
        if (code !== 0 || !stdout) {
          resolve(null);
          return;
        }

        try {
          const payload = JSON.parse(stdout.trim());
          const parsed = this.runtimeManager.parseVersion(payload.version || '');
          resolve({
            version: parsed.clean,
            rawVersion: payload.version,
            path: payload.path,
            major: parsed.major,
            minor: parsed.minor,
            patch: parsed.patch,
            isValid: parsed.major >= this.MIN_REQUIRED_MAJOR
          });
        } catch (error) {
          this.logger.warn('⚠️ Não foi possível analisar dados do Node.js do sistema:', error.message);
          resolve(null);
        }
      });
    });
  }
}

module.exports = { NodeDetectionService };
