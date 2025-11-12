/**
 * @fileoverview Download and setup Node.js binaries for cross-platform embedding
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { createDownloadInfo, prepareNodeBinary } = require('./node-binary-platform');

/**
 * Node.js Binary Downloader
 * Downloads and extracts Node.js binaries for cross-platform embedding
 */
class NodeBinaryDownloader {
  constructor(logger = console) {
    this.version = '20.12.0'; // Node.js 20 LTS
    this.resourcesPath = path.join(__dirname, '../resources');
    this.logger = logger;
  }

  /**
   * Download Node.js binaries for specific platform and architecture
   * @param {string} platform - Platform (win32, linux, darwin)
   * @param {string} arch - Architecture (x64, arm64)
   */
  async downloadForPlatform(platform, arch = 'x64') {
    this.logger.info(`📥 Baixando Node.js ${this.version} para ${platform}-${arch}...`);

    const downloadInfo = createDownloadInfo(this.version, platform, arch);
    const downloadPath = path.join(this.resourcesPath, 'downloads');
    const extractPath = path.join(this.resourcesPath, platform, arch, 'bin');

    try {
      await prepareNodeBinary({
        downloadInfo,
        downloadDir: downloadPath,
        extractDir: extractPath,
        logger: this.logger
      });

      this.logger.info(`✅ Download e extração concluídos para ${platform}-${arch}`);

      // Create version file for reference
      this.createVersionFile(platform, arch);
    } catch (error) {
      this.logger.error(`❌ Erro ao baixar Node.js para ${platform}-${arch}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create version file for reference
   * @param {string} platform - Platform identifier
   * @param {string} arch - Architecture identifier
   */
  createVersionFile(platform, arch) {
    const versionInfo = {
      version: this.version,
      platform,
      arch,
      downloadDate: new Date().toISOString(),
      lts: true
    };

    const versionPath = path.join(this.resourcesPath, platform, arch, 'version.json');
    fs.mkdirSync(path.dirname(versionPath), { recursive: true });
    fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  }

  /**
   * Check if binaries are already downloaded for platform
   * @param {string} platform - Platform identifier
   * @param {string} arch - Architecture identifier
   * @returns {boolean} Whether binaries exist
   */
  hasBinaries(platform, arch) {
    const binPath = path.join(this.resourcesPath, platform, arch, 'bin');
    const versionPath = path.join(this.resourcesPath, platform, arch, 'version.json');

    if (!fs.existsSync(binPath) || !fs.existsSync(versionPath)) {
      return false;
    }

    try {
      const versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return versionInfo.version === this.version;
    } catch {
      return false;
    }
  }

  /**
   * Get embedded Node.js version information
   * @param {string} platform - Platform identifier
   * @param {string} arch - Architecture identifier
   * @returns {Object|null} Version information or null
   */
  getEmbeddedVersion(platform, arch) {
    const versionPath = path.join(this.resourcesPath, platform, arch, 'version.json');

    if (!fs.existsSync(versionPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    } catch {
      return null;
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const platform = process.argv[2];
  const arch = process.argv[3] || 'x64';

  if (!platform) {
    console.error('❌ Plataforma não especificada');
    console.log('Uso: node download-node-binaries.js <platform> [arch]');
    console.log('Exemplo: node download-node-binaries.js win32 x64');
    console.log('Plataformas suportadas: win32, linux, darwin');
    console.log('Arquiteturas suportadas: x64, arm64');
    process.exit(1);
  }

  const downloader = new NodeBinaryDownloader();
  downloader.downloadForPlatform(platform, arch).catch(error => {
    console.error('❌ Falha no download:', error.message);
    process.exit(1);
  });
}

module.exports = { NodeBinaryDownloader };
