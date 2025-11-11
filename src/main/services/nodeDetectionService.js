/**
 * @fileoverview Node.js detection and management service
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Lazy load NodeBinaryDownloader only when needed
let NodeBinaryDownloader = null;
function getNodeBinaryDownloader() {
  if (!NodeBinaryDownloader) {
    try {
      // Only try to load downloader in development mode
      if (!app.isPackaged) {
        NodeBinaryDownloader = require('../../../scripts/download-node-binaries').NodeBinaryDownloader;
      }
    } catch (error) {
      // Downloader not available (e.g., in packaged app)
      // This is expected - in packaged apps, binaries should already be included
      NodeBinaryDownloader = null;
    }
  }
  return NodeBinaryDownloader;
}

/**
 * @typedef {Object} NodeVersionInfo
 * @property {string} version - Node.js version string
 * @property {string} path - Path to Node.js executable
 * @property {boolean} isValid - Whether version meets requirements
 * @property {boolean} isLTS - Whether version is LTS
 * @property {number} major - Major version number
 */

/**
 * @typedef {Object} NodeDetectionResult
 * @property {boolean} found - Whether Node.js was found
 * @property {NodeVersionInfo|null} systemNode - System Node.js information
 * @property {NodeVersionInfo|null} embeddedNode - Embedded Node.js information
 * @property {string} recommendation - Recommendation for user
 */

/**
 * Node.js Detection and Management Service
 * Handles detection of system Node.js and management of embedded binaries
 */
class NodeDetectionService {
  /**
   * Create an instance of NodeDetectionService
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.database - Database instance
   */
  constructor({ logger, database }) {
    this.logger = logger;
    this.database = database;
    this.resourcesPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'resources') 
      : path.join(__dirname, '../../../resources');
    
    const DownloaderClass = getNodeBinaryDownloader();
    this.downloader = DownloaderClass ? new DownloaderClass() : null;
    this.MIN_LTS_VERSION = 20; // Node.js 20 LTS minimum
  }

  /**
   * Detect Node.js installation and provide recommendations
   * @returns {Promise<NodeDetectionResult>} Detection result
   */
  async detectNodeInstallation() {
    this.logger.info('🔍 Detectando instalação do Node.js...');
    this.logger.info(`📁 Resources path: ${this.resourcesPath}`);
    this.logger.info(`📦 App packaged: ${app.isPackaged}`);
    this.logger.info(`🖥️ Platform: ${process.platform}-${process.arch}`);
    
    try {
      // 1. Check system Node.js
      const systemNode = await this.checkSystemNode();
      
      // 2. Check embedded Node.js
      const embeddedNode = await this.checkEmbeddedNode();
      
      // 3. Generate recommendation
      const recommendation = this.generateRecommendation(systemNode, embeddedNode);
      
      const result = {
        found: !!(systemNode || embeddedNode),
        systemNode,
        embeddedNode,
        recommendation
      };
      
      this.logger.info('✅ Detecção do Node.js concluída:', {
        systemNode: systemNode?.version || 'not found',
        embeddedNode: embeddedNode?.version || 'not available',
        recommendation
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ Erro na detecção do Node.js:', error);
      return {
        found: false,
        systemNode: null,
        embeddedNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check system Node.js installation
   * @returns {Promise<NodeVersionInfo|null>} System Node.js information
   */
  async checkSystemNode() {
    try {
      const nodePath = await this.findSystemNodeExecutable();
      if (!nodePath) {
        return null;
      }
      
      const version = await this.getNodeVersion(nodePath);
      if (!version) {
        return null;
      }
      
      const versionInfo = this.parseVersion(version);
      
      return {
        version,
        path: nodePath,
        isValid: versionInfo.major >= this.MIN_LTS_VERSION,
        isLTS: versionInfo.major >= this.MIN_LTS_VERSION, // Simplified LTS check
        ...versionInfo
      };
      
    } catch (error) {
      this.logger.warn('⚠️ Erro ao verificar Node.js do sistema:', error.message);
      return null;
    }
  }

  /**
   * Check embedded Node.js binaries
   * @returns {Promise<NodeVersionInfo|null>} Embedded Node.js information
   */
  async checkEmbeddedNode() {
    try {
      const platform = process.platform;
      const arch = process.arch;
      
      // Check if embedded binaries exist
      const nodePath = this.getEmbeddedNodePath();
      const fs = require('fs');
      
      if (!fs.existsSync(nodePath)) {
        this.logger.info(`📁 Node.js embarcado não encontrado em: ${nodePath}`);
        return null;
      }
      
      this.logger.info(`📁 Node.js embarcado encontrado em: ${nodePath}`);
      
      const version = await this.getNodeVersion(nodePath);
      
      if (!version) {
        this.logger.warn('⚠️ Não foi possível obter versão do Node.js embarcado');
        return null;
      }
      
      const versionInfo = this.parseVersion(version);
      
      this.logger.info(`✅ Node.js embarcado detectado: ${version} (${platform}-${arch})`);
      
      return {
        version,
        path: nodePath,
        isValid: true, // Embedded version is always valid
        isLTS: true, // Embedded version is LTS
        ...versionInfo
      };
      
    } catch (error) {
      this.logger.warn('⚠️ Erro ao verificar Node.js embarcado:', error.message);
      return null;
    }
  }

  /**
   * Find system Node.js executable
   * @returns {Promise<string|null>} Path to Node.js executable
   */
  async findSystemNodeExecutable() {
    const { execa } = require('execa');
    
    try {
      // Try 'which' or 'where' command first
      const command = process.platform === 'win32' ? 'where' : 'which';
      const { stdout } = await execa(command, ['node']);
      return stdout.split('\n')[0].trim();
    } catch {
      // Fallback to common paths
      const commonPaths = this.getCommonNodePaths();
      
      for (const nodePath of commonPaths) {
        if (fs.existsSync(nodePath)) {
          return nodePath;
        }
      }
      
      return null;
    }
  }

  /**
   * Get common Node.js installation paths
   * @returns {string[]} Array of common paths
   */
  getCommonNodePaths() {
    const platform = process.platform;
    const homeDir = require('os').homedir();
    
    if (platform === 'win32') {
      return [
        path.join('C:', 'Program Files', 'nodejs', 'node.exe'),
        path.join('C:', 'Program Files (x86)', 'nodejs', 'node.exe'),
        path.join(homeDir, 'AppData', 'Local', 'Programs', 'nodejs', 'node.exe'),
        path.join(homeDir, 'nvm', 'current', 'node.exe')
      ];
    } else {
      return [
        '/usr/local/bin/node',
        '/usr/bin/node',
        '/opt/homebrew/bin/node',
        path.join(homeDir, '.nvm', 'current', 'bin', 'node'),
        path.join(homeDir, '.local', 'bin', 'node'),
        path.join(homeDir, '.node', 'current', 'bin', 'node')
      ];
    }
  }

  /**
   * Get Node.js version from executable
   * @param {string} nodePath - Path to Node.js executable
   * @returns {Promise<string|null>} Version string
   */
  async getNodeVersion(nodePath) {
    return new Promise((resolve) => {
      const child = spawn(nodePath, ['--version'], { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          resolve(stdout.trim());
        } else {
          resolve(null);
        }
      });
      
      child.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Parse version string into components
   * @param {string} version - Version string (e.g., "v20.12.0")
   * @returns {Object} Parsed version information
   */
  parseVersion(version) {
    const cleanVersion = version.replace(/^v/, '');
    const parts = cleanVersion.split('.').map(Number);
    
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      full: cleanVersion
    };
  }

  /**
   * Generate recommendation based on available Node.js installations
   * @param {NodeVersionInfo|null} systemNode - System Node.js info
   * @param {NodeVersionInfo|null} embeddedNode - Embedded Node.js info
   * @returns {string} Recommendation
   */
  generateRecommendation(systemNode, embeddedNode) {
    // If system Node.js is valid and meets requirements
    if (systemNode && systemNode.isValid) {
      return 'use_system_choice';
    }
    
    // If system Node.js is invalid but embedded is available
    if (systemNode && !systemNode.isValid && embeddedNode) {
      return 'use_embedded_or_install';
    }
    
    // If only embedded is available
    if (embeddedNode && !systemNode) {
      return 'use_embedded';
    }
    
    // If neither is available
    if (!systemNode && !embeddedNode) {
      return 'install_required';
    }
    
    return 'unknown';
  }

  /**
   * Get embedded Node.js executable path
   * @returns {string} Path to embedded Node.js
   */
  getEmbeddedNodePath() {
    const platform = process.platform;
    const arch = process.arch;
    
    const binaryPath = path.join(
      this.resourcesPath, 
      platform, 
      arch, 
      'bin',
      platform === 'win32' ? 'node.exe' : 'node'
    );
    
    return binaryPath;
  }

  /**
   * Get embedded NPM executable path
   * @returns {string} Path to embedded NPM
   */
  getEmbeddedNpmPath() {
    const platform = process.platform;
    const arch = process.arch;
    
    const binaryPath = path.join(
      this.resourcesPath, 
      platform, 
      arch, 
      'bin',
      platform === 'win32' ? 'npm.cmd' : 'npm'
    );
    
    return binaryPath;
  }

  /**
   * Get embedded NPX executable path
   * @returns {string} Path to embedded NPX
   */
  getEmbeddedNpxPath() {
    const platform = process.platform;
    const arch = process.arch;
    
    const binaryPath = path.join(
      this.resourcesPath, 
      platform, 
      arch, 
      'bin',
      platform === 'win32' ? 'npx.cmd' : 'npx'
    );
    
    return binaryPath;
  }

  /**
   * Save user's Node.js preference to database
   * @param {string} preference - User preference ('system' or 'embedded')
   * @returns {Promise<void>}
   */
  async saveNodePreference(preference) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES ('node_preference', ?, CURRENT_TIMESTAMP)
      `, [preference]);
      
      this.logger.info(`✅ Preferência do Node.js salva: ${preference}`);
      
    } catch (error) {
      this.logger.error('❌ Erro ao salvar preferência do Node.js:', error);
      throw error;
    }
  }

  /**
   * Get user's Node.js preference from database
   * @returns {Promise<string|null>} User preference or null
   */
  async getNodePreference() {
    try {
      const result = await this.database.get(`
        SELECT value FROM settings WHERE key = 'node_preference'
      `);
      
      return result ? result.value : null;
      
    } catch (error) {
      this.logger.error('❌ Erro ao obter preferência do Node.js:', error);
      return null;
    }
  }

  /**
   * Get the appropriate Node.js executable based on user preference
   * @returns {Promise<string>} Path to Node.js executable
   */
  async getPreferredNodeExecutable() {
    const preference = await this.getNodePreference();
    const detection = await this.detectNodeInstallation();
    
    // If user has a preference and it's valid
    if (preference === 'system' && detection.systemNode && detection.systemNode.isValid) {
      return detection.systemNode.path;
    }
    
    if (preference === 'embedded' && detection.embeddedNode) {
      return detection.embeddedNode.path;
    }
    
    // Auto-select based on availability and validity
    if (detection.systemNode && detection.systemNode.isValid) {
      return detection.systemNode.path;
    }
    
    if (detection.embeddedNode) {
      return detection.embeddedNode.path;
    }
    
    throw new Error('Nenhuma instalação válida do Node.js encontrada');
  }

  /**
   * Get the appropriate NPM executable based on user preference
   * @returns {Promise<string>} Path to NPM executable
   */
  async getPreferredNpmExecutable() {
    const nodePath = await this.getPreferredNodeExecutable();
    const isEmbedded = nodePath.includes('resources');
    
    if (isEmbedded) {
      return this.getEmbeddedNpmPath();
    }
    
    // For system Node.js, try to find npm in the same directory
    const nodeDir = path.dirname(nodePath);
    const npmPath = path.join(nodeDir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    
    if (fs.existsSync(npmPath)) {
      return npmPath;
    }
    
    // Fallback to system npm
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
  }

  /**
   * Ensure embedded Node.js binaries are available
   * @returns {Promise<boolean>} Whether binaries are available
   */
  async ensureEmbeddedBinaries() {
    const platform = process.platform;
    const arch = process.arch;
    
    if (!this.downloader) {
      // Can't download binaries in packaged app without downloader
      return false;
    }
    
    if (this.downloader.hasBinaries(platform, arch)) {
      return true;
    }
    
    try {
      this.logger.info('📦 Baixando binários do Node.js embarcado...');
      await this.downloader.downloadForPlatform(platform, arch);
      return true;
    } catch (error) {
      this.logger.error('❌ Erro ao baixar binários do Node.js:', error);
      return false;
    }
  }
}

module.exports = { NodeDetectionService };