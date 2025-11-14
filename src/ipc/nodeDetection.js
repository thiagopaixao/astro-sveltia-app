/**
 * @fileoverview IPC handlers for Node.js detection and management
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');

/**
 * Register Node.js detection IPC handlers
 * @param {Object} dependencies - Dependency injection container
 * @param {Object} dependencies.logger - Logger instance
 * @param {Object} dependencies.nodeDetectionService - Node.js detection service
 */
function registerNodeDetectionHandlers({ logger, nodeDetectionService }) {
  const nodeDetection = nodeDetectionService;

  /**
   * Handle Node.js detection request
   */
  ipcMain.handle('node:detect', async () => {
    try {
      logger.info('🔍 IPC: Iniciando detecção do Node.js...');
      
      // Ensure embedded binaries are available
      await nodeDetection.ensureEmbeddedBinaries();
      
      // Perform detection
      const result = await nodeDetection.detectNodeInstallation();
      
      logger.info('✅ IPC: Detecção do Node.js concluída');
      return result;
      
    } catch (error) {
      logger.error('❌ IPC: Erro na detecção do Node.js:', error);
      return {
        found: false,
        systemNode: null,
        embeddedNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  });



  /**
   * Handle get embedded Node.js executable request
   */
  ipcMain.handle('node:get-executable', async () => {
    try {
      logger.info('🎯 IPC: Obtendo executável do Node.js embarcado...');
      
      const nodePath = await nodeDetection.getPreferredNodeExecutable();
      const npmPath = await nodeDetection.getPreferredNpmExecutable();
      
      logger.info(`✅ IPC: Node.js: ${nodePath}`);
      logger.info(`✅ IPC: NPM: ${npmPath}`);
      
      return { 
        success: true, 
        nodePath, 
        npmPath 
      };
      
    } catch (error) {
      logger.error('❌ IPC: Erro ao obter executável do Node.js:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  /**
   * Handle Node.js installation guide request
   */
  ipcMain.handle('node:get-installation-guide', async () => {
    try {
      const platform = process.platform;
      const guide = getInstallationGuide(platform);
      
      logger.info(`📖 IPC: Guia de instalação para ${platform}`);
      
      return { success: true, guide };
      
    } catch (error) {
      logger.error('❌ IPC: Erro ao obter guia de instalação:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Handle Node.js re-detection request
   */
  ipcMain.handle('node:redetect', async () => {
    try {
      logger.info('🔄 IPC: Redetectando instalação do Node.js...');
      
      // Clear any cached preferences (optional)
      // await nodeDetection.clearCache();
      
      // Perform fresh detection
      const result = await nodeDetection.detectNodeInstallation();
      
      logger.info('✅ IPC: Redetecção do Node.js concluída');
      return result;
      
    } catch (error) {
      logger.error('❌ IPC: Erro na redetecção do Node.js:', error);
      return {
        found: false,
        systemNode: null,
        embeddedNode: null,
        recommendation: 'error',
        error: error.message
      };
    }
  });
}

/**
 * Get installation guide for specific platform
 * @param {string} platform - Platform identifier
 * @returns {Object} Installation guide
 */
function getInstallationGuide(platform) {
  const guides = {
    win32: {
      title: 'Instalação do Node.js no Windows',
      steps: [
        'Visite https://nodejs.org',
        'Baixe o instalador LTS (Long Term Support)',
        'Execute o instalador e siga as instruções',
        'Reinicie o Documental após a instalação',
        'Clique em "Detectar Novamente" para verificar'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0-x64.msi',
      version: '20.12.0 LTS',
      notes: 'Certifique-se de marcar a opção "Add to PATH" durante a instalação'
    },
    darwin: {
      title: 'Instalação do Node.js no macOS',
      steps: [
        'Visite https://nodejs.org',
        'Baixe o instalador .pkg LTS (Long Term Support)',
        'Abra o arquivo .pkg e siga as instruções',
        'Reinicie o Documental após a instalação',
        'Clique em "Detectar Novamente" para verificar'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0.pkg',
      version: '20.12.0 LTS',
      notes: 'Alternativamente, você pode usar Homebrew: brew install node@20'
    },
    linux: {
      title: 'Instalação do Node.js no Linux',
      steps: [
        'Método 1: Usando NodeSource (recomendado)',
        'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
        'sudo apt-get install -y nodejs',
        'Ou Método 2: Usando gerenciador de pacotes',
        'Visite https://nodejs.org para outras distribuições'
      ],
      downloadUrl: 'https://nodejs.org/dist/v20.12.0/node-v20.12.0-linux-x64.tar.xz',
      version: '20.12.0 LTS',
      notes: 'Verifique a documentação oficial para sua distribuição específica'
    }
  };

  return guides[platform] || guides.linux;
}

module.exports = { registerNodeDetectionHandlers };