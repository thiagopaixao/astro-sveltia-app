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
const { PlatformService } = require('./platform/PlatformService.js');

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
    this.platformService = new PlatformService({ logger });
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
   * Detect Node.js installation and provide recommendations
   * @returns {Promise<NodeDetectionResult>} Detection result
   */
  async detectNodeInstallation() {
    this.logger.info('🔍 Detectando instalação do Node.js embarcado...');
    this.logger.info(`📁 Resources path: ${this.resourcesPath}`);
    this.logger.info(`📦 App packaged: ${app.isPackaged}`);
    this.logger.info(`🖥️ Platform: ${process.platform}-${process.arch}`);
    
    try {
      // 1. Ensure embedded binaries are available
      await this.ensureEmbeddedBinaries();
      
      // 2. Check embedded Node.js only
      const embeddedNode = await this.checkEmbeddedNode();
      
      // 3. Generate recommendation based on embedded availability
      const recommendation = this.generateRecommendation(embeddedNode);
      
      const result = {
        found: !!embeddedNode,
        systemNode: null, // Always null - we don't use system Node anymore
        embeddedNode,
        recommendation
      };
      
      this.logger.info('✅ Detecção do Node.js concluída:', {
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
   * Generate recommendation based on embedded Node.js availability
   * @param {NodeVersionInfo|null} embeddedNode - Embedded Node.js info
   * @returns {string} Recommendation
   */
  generateRecommendation(embeddedNode) {
    // If embedded is available
    if (embeddedNode) {
      return 'use_embedded';
    }
    
    // If embedded is not available
    return 'install_required';
  }

  /**
   * Get embedded Node.js executable path
   * @returns {string} Path to embedded Node.js
   */
  getEmbeddedNodePath() {
    const platform = this.platformService.adapter.getPlatform();
    const arch = this.platformService.adapter.getArchitecture();
    
    const nodeExecutable = platform === 'win32' ? 'node.exe' : 'node';
    
    const binaryPath = path.join(
      this.resourcesPath, 
      platform, 
      arch, 
      'bin',
      nodeExecutable
    );
    
    return binaryPath;
  }

  /**
   * Get embedded NPM executable path
   * @returns {string} Path to embedded NPM
   */
  getEmbeddedNpmPath() {
    const platform = this.platformService.adapter.getPlatform();
    const arch = this.platformService.adapter.getArchitecture();
    
    const npmExecutable = platform === 'win32' ? 'npm.cmd' : 'npm';
    
    const binaryPath = path.join(
      this.resourcesPath, 
      platform, 
      arch, 
      'bin',
      npmExecutable
    );
    
    return binaryPath;
  }





  /**
   * Get the Node.js executable (always embedded)
   * @returns {Promise<string>} Path to Node.js executable
   */
  async getPreferredNodeExecutable() {
    const detection = await this.detectNodeInstallation();
    
    if (detection.embeddedNode) {
      return detection.embeddedNode.path;
    }
    
    throw new Error('Node.js embarcado não encontrado');
  }

  /**
   * Get the NPM executable (always embedded)
   * @returns {Promise<string>} Path to NPM executable
   */
  async getPreferredNpmExecutable() {
    return await this.getEmbeddedNpmPath();
  }

  /**
   * Ensure embedded Node.js binaries are available
   * @returns {Promise<boolean>} Whether binaries are available
   */
  async ensureEmbeddedBinaries() {
    const platform = this.platformService.adapter.getPlatform();
    const arch = this.platformService.adapter.getArchitecture();
    
    if (!this.downloader) {
      // In packaged app, binaries should already be included
      const nodePath = this.getEmbeddedNodePath();
      return fs.existsSync(nodePath);
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