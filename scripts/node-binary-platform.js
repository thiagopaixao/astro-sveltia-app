'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const decompressTarxz = require('decompress-tarxz');
const decompressUnzip = require('decompress-unzip');

const NODE_DIST_BASE_URL = 'https://nodejs.org/dist';
const DOWNLOAD_TIMEOUT = 30000;
const TEMP_PREFIX = 'node-binary-extract-';

/**
 * Normalize logger to guarantee info/warn/error methods.
 * @param {Console|Object} logger Logger-like object
 * @returns {{info: Function, warn: Function, error: Function}}
 */
function getLogger(logger) {
  const fallback = () => {};
  const target = logger || {};
  return {
    info: (...args) => (target.info || target.log || fallback)(...args),
    warn: (...args) => (target.warn || target.log || fallback)(...args),
    error: (...args) => (target.error || target.log || fallback)(...args)
  };
}

/**
 * Download file via HTTPS.
 * @param {string} url URL to download
 * @param {string} destination Destination file path
 * @param {ReturnType<typeof getLogger>} logger Logger instance
 * @returns {Promise<string>} Resolves with downloaded path
 */
function downloadFile(url, destination, logger) {
  logger.info(`⬇️  Baixando ${url}`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close(() => fs.unlink(destination, () => {}));
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => resolve(destination));
      });
    });

    request.on('error', (error) => {
      file.close(() => fs.unlink(destination, () => {}));
      reject(error);
    });

    request.setTimeout(DOWNLOAD_TIMEOUT, () => {
      request.destroy();
      file.close(() => fs.unlink(destination, () => {}));
      reject(new Error('Timeout ao baixar Node.js'));
    });
  });
}

/**
 * Extract archive using decompress plugins.
 * @param {string} archivePath Path to archive
 * @param {string} destination Destination directory
 * @param {Object} options Extraction options
 * @param {Array<Function>} options.plugins Plugins list
 * @param {number} [options.strip=0] Levels to strip
 * @param {ReturnType<typeof getLogger>} logger Logger instance
 * @returns {Promise<void>}
 */
async function extractArchive(archivePath, destination, { plugins, strip = 0 }, logger) {
  logger.info(`📦 Extraindo ${path.basename(archivePath)} para ${destination}`);
  await decompress(archivePath, destination, { plugins, strip });
}

/**
 * Copy directory recursively.
 * @param {string} src Source path
 * @param {string} dest Destination path
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Fix npm and npx binaries for Unix-like systems to point to the embedded npm.
 * @param {string} binPath Path to bin directory
 * @param {ReturnType<typeof getLogger>} logger Logger instance
 */
function fixUnixNpmBinaries(binPath, logger) {
  try {
    const binaries = ['npm', 'npx'];
    binaries.forEach((binary) => {
      const binaryPath = path.join(binPath, binary);
      if (!fs.existsSync(binaryPath)) {
        return;
      }

      let contents = fs.readFileSync(binaryPath, 'utf8');
      contents = contents.replace(
        "require('../lib/cli.js')",
        "require('../lib/node_modules/npm/lib/cli.js')"
      );
      fs.writeFileSync(binaryPath, contents);
      fs.chmodSync(binaryPath, 0o755);
    });
    logger.info('✅ Ajustados os caminhos dos binários npm e npx');
  } catch (error) {
    logger.warn(`⚠️ Não foi possível ajustar npm/npx: ${error.message}`);
  }
}

/**
 * Remove directory recursively.
 * @param {string} target Path to remove
 */
function removeDirectory(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

const platformAdapters = {
  win32: {
    buildFilename: (version, arch) => `node-v${version}-win-${arch}.zip`,
    plugins: () => [decompressUnzip()],
    strip: 1,
    install(tempDir, extractDir, logger) {
      const filesToCopy = ['node.exe', 'npm.cmd', 'npx.cmd'];
      filesToCopy.forEach((file) => {
        const src = path.join(tempDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(extractDir, file));
        }
      });

      const nodeModulesSrc = path.join(tempDir, 'node_modules');
      const nodeModulesDest = path.join(path.dirname(extractDir), 'node_modules');
      copyDirectory(nodeModulesSrc, nodeModulesDest);
      logger.info('✅ Binários do Windows preparados');
    }
  },
  darwin: {
    buildFilename: (version, arch) => `node-v${version}-darwin-${arch}.tar.gz`,
    plugins: () => [decompressTargz()],
    strip: 1,
    install(tempDir, extractDir, logger) {
      const binaries = ['bin/node', 'bin/npm', 'bin/npx'];
      binaries.forEach((binary) => {
        const src = path.join(tempDir, binary);
        if (!fs.existsSync(src)) {
          return;
        }
        const dest = path.join(extractDir, path.basename(binary));
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o755);
      });

      const libSrc = path.join(tempDir, 'lib');
      const libDest = path.join(path.dirname(extractDir), 'lib');
      copyDirectory(libSrc, libDest);
      fixUnixNpmBinaries(extractDir, logger);
      logger.info('✅ Binários do macOS preparados');
    }
  },
  linux: {
    buildFilename: (version, arch) => `node-v${version}-linux-${arch}.tar.xz`,
    plugins: () => [decompressTarxz()],
    strip: 1,
    install(tempDir, extractDir, logger) {
      const binaries = ['bin/node', 'bin/npm', 'bin/npx'];
      binaries.forEach((binary) => {
        const src = path.join(tempDir, binary);
        if (!fs.existsSync(src)) {
          return;
        }
        const dest = path.join(extractDir, path.basename(binary));
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o755);
      });

      const libSrc = path.join(tempDir, 'lib');
      const libDest = path.join(path.dirname(extractDir), 'lib');
      copyDirectory(libSrc, libDest);
      fixUnixNpmBinaries(extractDir, logger);
      logger.info('✅ Binários do Linux preparados');
    }
  }
};

/**
 * Retrieve adapter for platform.
 * @param {string} platform Platform identifier
 * @returns {Object}
 */
function getPlatformAdapter(platform) {
  const adapter = platformAdapters[platform];
  if (!adapter) {
    throw new Error(`Plataforma não suportada: ${platform}`);
  }
  return adapter;
}

/**
 * Create download information for platform.
 * @param {string} version Node.js version
 * @param {string} platform Platform identifier
 * @param {string} arch Architecture identifier
 * @returns {Object}
 */
function createDownloadInfo(version, platform, arch) {
  const adapter = getPlatformAdapter(platform);
  const filename = adapter.buildFilename(version, arch);
  return {
    version,
    platform,
    arch,
    filename,
    url: `${NODE_DIST_BASE_URL}/v${version}/${filename}`,
    adapter
  };
}

/**
 * Download and prepare Node.js binary for platform.
 * @param {Object} params Parameters
 * @param {Object} params.downloadInfo Download information
 * @param {string} params.downloadDir Directory to store downloads
 * @param {string} params.extractDir Final extraction directory
 * @param {Console|Object} [params.logger=console] Logger
 * @returns {Promise<void>}
 */
async function prepareNodeBinary({ downloadInfo, downloadDir, extractDir, logger = console }) {
  const log = getLogger(logger);
  const archivePath = path.join(downloadDir, downloadInfo.filename);
  const tmpDir = path.join(os.tmpdir(), TEMP_PREFIX + crypto.randomUUID());

  fs.mkdirSync(downloadDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await downloadFile(downloadInfo.url, archivePath, log);
    await extractArchive(archivePath, tmpDir, {
      plugins: downloadInfo.adapter.plugins(),
      strip: downloadInfo.adapter.strip || 0
    }, log);
    await downloadInfo.adapter.install(tmpDir, extractDir, log);
  } finally {
    removeDirectory(tmpDir);
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
  }
}

module.exports = {
  createDownloadInfo,
  prepareNodeBinary,
  getPlatformAdapter,
  platformAdapters
};
