/**
 * @fileoverview IPC handlers for managed Node.js runtime detection
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');

/**
 * Register Node.js runtime IPC handlers
 * @param {Object} dependencies - Dependency container
 * @param {Object} dependencies.logger - Logger instance
 * @param {Object} dependencies.nodeDetectionService - Node detection service
 */
function registerNodeDetectionHandlers({ logger, nodeDetectionService }) {
  const nodeDetection = nodeDetectionService;

  ipcMain.handle('node:detect', async () => {
    try {
      logger.info('🔍 IPC: Verificando Node.js gerenciado...');
      return await nodeDetection.detectNodeInstallation();
    } catch (error) {
      logger.error('❌ IPC: Erro na detecção do Node.js:', error);
      return {
        runtime: nodeDetection.normalizeRuntimeInfo(),
        systemNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  });

  ipcMain.handle('node:install', async (event, options = {}) => {
    try {
      logger.info('⬇️ IPC: Iniciando download automático do Node.js...');
      const notifyProgress = (payload) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('node:install-progress', payload);
        }
      };

      const runtime = await nodeDetection.installManagedRuntime({
        force: options.force,
        onProgress: notifyProgress
      });

      return {
        success: true,
        runtime,
        recommendation: runtime.installed && runtime.isValid ? 'managed_ready' : 'install_required'
      };
    } catch (error) {
      logger.error('❌ IPC: Erro ao instalar Node.js gerenciado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('node:get-executable', async () => {
    try {
      logger.info('🎯 IPC: Obtendo executáveis do Node.js gerenciado...');
      const nodePath = await nodeDetection.getPreferredNodeExecutable();
      const npmPath = await nodeDetection.getPreferredNpmExecutable();
      const npxPath = await nodeDetection.getPreferredNpxExecutable();

      return {
        success: true,
        nodePath,
        npmPath,
        npxPath
      };
    } catch (error) {
      logger.error('❌ IPC: Erro ao obter executáveis do Node.js:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('node:get-installation-guide', async () => {
    try {
      const platform = process.platform;
      return { success: true, guide: getInstallationGuide(platform) };
    } catch (error) {
      logger.error('❌ IPC: Erro ao obter guia de instalação:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('node:redetect', async () => {
    try {
      logger.info('🔄 IPC: Redetectando runtime do Node.js...');
      return await nodeDetection.detectNodeInstallation();
    } catch (error) {
      logger.error('❌ IPC: Erro na redetecção do Node.js:', error);
      return {
        runtime: nodeDetection.normalizeRuntimeInfo(),
        systemNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  });
}

/**
 * Provide manual installation hints per platform (fallback)
 * @param {string} platform - Platform identifier
 * @returns {Object} Installation guide
 */
function getInstallationGuide(platform) {
  const guides = {
    win32: {
      title: 'Instalação manual Windows',
      steps: [
        'Baixe o instalador oficial em https://nodejs.org',
        'Selecione a versão LTS 20.x',
        'Execute o instalador e conclua o assistente',
        'Reinicie o Documental e execute a verificação novamente'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0-x64.msi'
    },
    darwin: {
      title: 'Instalação manual macOS',
      steps: [
        'Baixe o pacote .pkg em https://nodejs.org',
        'Escolha a versão LTS 20.x',
        'Abra o pacote e siga as instruções',
        'Reabra o Documental e clique em "Verificar novamente"'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0.pkg'
    },
    linux: {
      title: 'Instalação manual Linux',
      steps: [
        'Use o gerenciador de pacotes da sua distro ou baixe o tar.gz oficial',
        'Garanta que a versão seja 20.x LTS',
        'Atualize seu PATH ou utilize o runtime gerenciado do Documental'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0-linux-x64.tar.gz'
    }
  };

  return guides[platform] || guides.linux;
}

module.exports = { registerNodeDetectionHandlers };
