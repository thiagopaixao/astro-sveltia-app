/**
 * @fileoverview Download and setup Node.js binaries for cross-platform embedding
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const yauzl = require('yauzl');
const tar = require('tar');

/**
 * Node.js Binary Downloader
 * Downloads and extracts Node.js binaries for cross-platform embedding
 */
class NodeBinaryDownloader {
  constructor() {
    this.version = '20.12.0'; // Node.js 20 LTS
    this.resourcesPath = path.join(__dirname, '../resources');
  }

  /**
   * Download Node.js binaries for specific platform and architecture
   * @param {string} platform - Platform (win32, linux, darwin)
   * @param {string} arch - Architecture (x64, arm64)
   */
  async downloadForPlatform(platform, arch = 'x64') {
    console.log(`📥 Baixando Node.js ${this.version} para ${platform}-${arch}...`);
    
    const downloadInfo = this.getDownloadInfo(platform, arch);
    const downloadPath = path.join(this.resourcesPath, 'downloads');
    const extractPath = path.join(this.resourcesPath, platform, arch, 'bin');
    
    // Create directories
    fs.mkdirSync(downloadPath, { recursive: true });
    fs.mkdirSync(extractPath, { recursive: true });
    
    try {
      // 1. Download archive
      const archivePath = await this.downloadArchive(downloadInfo, downloadPath);
      
      // 2. Extract only necessary binaries
      await this.extractBinaries(archivePath, extractPath, platform);
      
      // 3. Clean up downloaded archive
      fs.unlinkSync(archivePath);
      
      console.log(`✅ Download e extração concluídos para ${platform}-${arch}`);
      
      // 4. Create version file for reference
      this.createVersionFile(platform, arch);
      
    } catch (error) {
      console.error(`❌ Erro ao baixar Node.js para ${platform}-${arch}:`, error.message);
      throw error;
    }
  }

  /**
   * Get download information for platform and architecture
   * @param {string} platform - Platform identifier
   * @param {string} arch - Architecture identifier
   * @returns {Object} Download information
   */
  getDownloadInfo(platform, arch) {
    const baseUrl = `https://nodejs.org/dist/v${this.version}`;
    
    const formats = {
      'win32': {
        'x64': `node-v${this.version}-win-x64.zip`,
        'arm64': `node-v${this.version}-win-arm64.zip`
      },
      'darwin': {
        'x64': `node-v${this.version}-darwin-x64.tar.gz`,
        'arm64': `node-v${this.version}-darwin-arm64.tar.gz`
      },
      'linux': {
        'x64': `node-v${this.version}-linux-x64.tar.xz`,
        'arm64': `node-v${this.version}-linux-arm64.tar.xz`
      }
    };

    const filename = formats[platform]?.[arch];
    if (!filename) {
      throw new Error(`Plataforma não suportada: ${platform}-${arch}`);
    }

    return {
      url: `${baseUrl}/${filename}`,
      filename,
      platform,
      arch
    };
  }

  /**
   * Download archive from Node.js official servers
   * @param {Object} downloadInfo - Download information
   * @param {string} downloadPath - Download directory path
   * @returns {Promise<string>} Path to downloaded archive
   */
  async downloadArchive(downloadInfo, downloadPath) {
    const archivePath = path.join(downloadPath, downloadInfo.filename);
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(archivePath);
      
      const request = https.get(downloadInfo.url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(archivePath);
        });
      });
      
      request.on('error', (error) => {
        fs.unlink(archivePath, () => {});
        reject(error);
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        fs.unlink(archivePath, () => {});
        reject(new Error('Timeout ao baixar Node.js'));
      });
    });
  }

  /**
   * Extract only necessary binaries from archive
   * @param {string} archivePath - Path to archive file
   * @param {string} extractPath - Target extraction path
   * @param {string} platform - Platform identifier
   */
  async extractBinaries(archivePath, extractPath, platform) {
    const tempDir = path.join(extractPath, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    
    try {
      // Extract archive using cross-platform APIs
      if (archivePath.endsWith('.zip')) {
        await this.extractZip(archivePath, tempDir);
      } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tar.xz')) {
        await this.extractTar(archivePath, tempDir);
      }
      
      // Copy necessary files and directories
      if (platform === 'win32') {
        // Windows binaries
        const filesToCopy = ['node.exe', 'npm.cmd', 'npx.cmd'];
        filesToCopy.forEach(file => {
          // Try root first
          let src = path.join(tempDir, file);
          let dst = path.join(extractPath, file);
          
          // If not in root, try subdirectory
          if (!fs.existsSync(src)) {
            const subDirName = fs.readdirSync(tempDir).find(name => name.includes('node-v') && name.includes('win'));
            if (subDirName) {
              src = path.join(tempDir, subDirName, file);
            }
          }
          
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
          }
        });
        
        // Find the extracted Node.js directory
        const nodeDirName = fs.readdirSync(tempDir).find(name => name.includes('node-v') && name.includes('win'));
        const nodeDirPath = nodeDirName ? path.join(tempDir, nodeDirName) : tempDir;
        
        // Copy node_modules directory (required for npm to work)
        const nodeModulesSrc = path.join(nodeDirPath, 'node_modules');
        const nodeModulesDst = path.join(path.dirname(extractPath), 'node_modules');
        if (fs.existsSync(nodeModulesSrc)) {
          this.copyDirectory(nodeModulesSrc, nodeModulesDst);
        }
        
        // Copy lib directory (required for npm to work) - NOW INCLUDED FOR WINDOWS TOO
        const libSrc = path.join(nodeDirPath, 'lib');
        const libDst = path.join(path.dirname(extractPath), 'lib');
        if (fs.existsSync(libSrc)) {
          this.copyDirectory(libSrc, libDst);
        }
        
        // Fix npm and npx binary paths for Windows
        this.fixNpmBinaryPaths(extractPath, platform);
      } else {
        // Unix binaries - copy both binaries and lib directory
        const filesToCopy = ['bin/node', 'bin/npm', 'bin/npx'];
        filesToCopy.forEach(file => {
          const src = path.join(tempDir, file);
          const dst = path.join(extractPath, path.basename(file));
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            fs.chmodSync(dst, '755'); // Make executable
          }
        });
        
        // Copy lib directory (required for npm to work)
        const libSrc = path.join(tempDir, 'lib');
        const libDst = path.join(path.dirname(extractPath), 'lib');
        if (fs.existsSync(libSrc)) {
          this.copyDirectory(libSrc, libDst);
        }
        
        // Fix npm and npx binary paths to point to correct cli.js location
        this.fixNpmBinaryPaths(extractPath, platform);
      }
      
    } finally {
      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
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
   * Copy directory recursively
   * @param {string} src - Source directory path
   * @param {string} dst - Destination directory path
   */
  copyDirectory(src, dst) {
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(dst, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  /**
   * Extract ZIP file using yauzl (cross-platform)
   * @param {string} zipPath - Path to ZIP file
   * @param {string} extractPath - Target extraction path
   * @returns {Promise<void>}
   */
  extractZip(zipPath, extractPath) {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                reject(err);
                return;
              }

              // Ensure directory exists
              const outputPath = path.join(extractPath, entry.fileName);
              fs.mkdirSync(path.dirname(outputPath), { recursive: true });

              const writeStream = fs.createWriteStream(outputPath);
              readStream.pipe(writeStream);

              writeStream.on('close', () => {
                zipfile.readEntry();
              });

              writeStream.on('error', reject);
              readStream.on('error', reject);
            });
          }
        });

        zipfile.on('end', () => {
          resolve();
        });

        zipfile.on('error', reject);
      });
    });
  }

  /**
   * Extract TAR file using tar (cross-platform)
   * @param {string} tarPath - Path to TAR file
   * @param {string} extractPath - Target extraction path
   * @returns {Promise<void>}
   */
  async extractTar(tarPath, extractPath) {
    try {
      await tar.x({
        file: tarPath,
        cwd: extractPath,
        strip: 1
      });
    } catch (error) {
      // Fallback for .xz files on Windows - use 7z if available
      if (tarPath.endsWith('.tar.xz') && process.platform === 'win32') {
        console.log('🔧 Usando fallback para .xz no Windows...');
        const { execSync } = require('child_process');
        try {
          execSync(`7z x "${tarPath}" -so | tar x -C "${extractPath}" --strip-components=1`, { 
            stdio: 'inherit',
            shell: true 
          });
        } catch (fallbackError) {
          // If 7z is not available, try using tar with different flags
          try {
            execSync(`tar -xf "${tarPath}" -C "${extractPath}" --strip-components=1`, { 
              stdio: 'inherit' 
            });
          } catch (tarError) {
            throw new Error(`Não foi possível extrair ${tarPath}: ${fallbackError.message}`);
          }
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Fix npm and npx binary paths to point to correct cli.js location
   * @param {string} binPath - Path to bin directory
   * @param {string} platform - Platform identifier
   */
  fixNpmBinaryPaths(binPath, platform) {
    try {
      if (platform === 'win32') {
        // Fix Windows .cmd files
        const npmCmdPath = path.join(binPath, 'npm.cmd');
        const npxCmdPath = path.join(binPath, 'npx.cmd');
        
        if (fs.existsSync(npmCmdPath)) {
          let npmContent = fs.readFileSync(npmCmdPath, 'utf8');
          // Update path to point to correct location in our embedded structure
          npmContent = npmContent.replace(
            'SET "NPM_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npm-cli.js"',
            'SET "NPM_CLI_JS=%~dp0\\..\\node_modules\\npm\\bin\\npm-cli.js"'
          );
          // Disable global prefix lookup to avoid path issues
          npmContent = npmContent.replace(
            'FOR /F "delims=" %%F IN (\'CALL "%NODE_EXE%" "%NPM_CLI_JS%" prefix -g\') DO (',
            'REM FOR /F "delims=" %%F IN (\'CALL "%NODE_EXE%" "%NPM_CLI_JS%" prefix -g\') DO ('
          );
          npmContent = npmContent.replace(
            '  SET "NPM_PREFIX_NPM_CLI_JS=%%F\\node_modules\\npm\\bin\\npm-cli.js"',
            '  REM SET "NPM_PREFIX_NPM_CLI_JS=%%F\\node_modules\\npm\\bin\\npm-cli.js"'
          );
          npmContent = npmContent.replace(
            'IF EXIST "%NPM_PREFIX_NPM_CLI_JS%" (',
            'REM IF EXIST "%NPM_PREFIX_NPM_CLI_JS%" ('
          );
          npmContent = npmContent.replace(
            '  SET "NPM_CLI_JS=%NPM_PREFIX_NPM_CLI_JS%"',
            '  REM SET "NPM_CLI_JS=%NPM_PREFIX_NPM_CLI_JS%"'
          );
          fs.writeFileSync(npmCmdPath, npmContent);
        }
        
        if (fs.existsSync(npxCmdPath)) {
          let npxContent = fs.readFileSync(npxCmdPath, 'utf8');
          // Update path to point to correct location in our embedded structure
          npxContent = npxContent.replace(
            'SET "NPX_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npx-cli.js"',
            'SET "NPX_CLI_JS=%~dp0\\..\\node_modules\\npm\\bin\\npx-cli.js"'
          );
          // Disable global prefix lookup to avoid path issues
          npxContent = npxContent.replace(
            'FOR /F "delims=" %%F IN (\'CALL "%NODE_EXE%" "%NPM_CLI_JS%" prefix -g\') DO (',
            'REM FOR /F "delims=" %%F IN (\'CALL "%NODE_EXE%" "%NPM_CLI_JS%" prefix -g\') DO ('
          );
          npxContent = npxContent.replace(
            '  SET "NPM_PREFIX_NPX_CLI_JS=%%F\\node_modules\\npm\\bin\\npx-cli.js"',
            '  REM SET "NPM_PREFIX_NPX_CLI_JS=%%F\\node_modules\\npm\\bin\\npx-cli.js"'
          );
          npxContent = npxContent.replace(
            'IF EXIST "%NPM_PREFIX_NPX_CLI_JS%" (',
            'REM IF EXIST "%NPM_PREFIX_NPX_CLI_JS%" ('
          );
          npxContent = npxContent.replace(
            '  SET "NPX_CLI_JS=%NPM_PREFIX_NPX_CLI_JS%"',
            '  REM SET "NPX_CLI_JS=%NPM_PREFIX_NPX_CLI_JS%"'
          );
          fs.writeFileSync(npxCmdPath, npxContent);
        }
      } else {
        // Fix Unix binary files
        const npmPath = path.join(binPath, 'npm');
        const npxPath = path.join(binPath, 'npx');
        
        if (fs.existsSync(npmPath)) {
          let npmContent = fs.readFileSync(npmPath, 'utf8');
          npmContent = npmContent.replace(
            "require('../lib/cli.js')",
            "require('../lib/node_modules/npm/lib/cli.js')"
          );
          fs.writeFileSync(npmPath, npmContent);
          fs.chmodSync(npmPath, '755');
        }

        if (fs.existsSync(npxPath)) {
          let npxContent = fs.readFileSync(npxPath, 'utf8');
          npxContent = npxContent.replace(
            "require('../lib/cli.js')",
            "require('../lib/node_modules/npm/lib/cli.js')"
          );
          fs.writeFileSync(npxPath, npxContent);
          fs.chmodSync(npxPath, '755');
        }
      }

      console.log('✅ Fixed npm and npx binary paths');
    } catch (error) {
      console.warn('⚠️ Warning: Could not fix npm binary paths:', error.message);
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