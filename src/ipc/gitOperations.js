/**
 * @fileoverview Git operations for project management
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const git = require('isomorphic-git');
const fs = require('fs');
const path = require('path');
const keytar = require('keytar');

// Dynamic import for ESM module - will be loaded when needed
let Octokit = null;
const { GITHUB_CONFIG } = require('../config/github-config.js');

/**
 * Git Operations Class
 */
class GitOperations {
  /**
   * Create an instance of GitOperations
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    this.logger = logger;
  }

  /**
   * Get GitHub token from keytar
   * @returns {Promise<string|null>} GitHub token or null
   */
  async getGitHubToken() {
    try {
      return await keytar.getPassword(GITHUB_CONFIG.SERVICE_NAME, 'github-token');
    } catch (error) {
      this.logger.error('Error getting GitHub token:', error);
      return null;
    }
  }

  /**
   * Get GitHub user information
   * @returns {Promise<Object|null>} User info or null
   */
  async getGitHubUserInfo() {
    try {
      const token = await this.getGitHubToken();
      if (!token) return null;

      const octokit = new Octokit({ auth: token });
      const { data: user } = await octokit.rest.users.getAuthenticated();
      
      return {
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        id: user.id
      };
    } catch (error) {
      this.logger.error('Error getting GitHub user info:', error);
      return null;
    }
  }

  /**
   * Set git user configuration
   * @param {string} dir - Repository directory
   * @param {string} name - User name
   * @param {string} email - User email
   * @returns {Promise<boolean>} Success status
   */
  async gitSetUserConfig(dir, name, email) {
    try {
      this.logger.info(`Setting git user config: ${name} <${email}>`);
      
      await git.setConfig({
        fs: require('fs'),
        dir,
        path: 'user.name',
        value: name
      });
      
      await git.setConfig({
        fs: require('fs'),
        dir,
        path: 'user.email',
        value: email
      });
      
      this.logger.info('Git user config set successfully');
      return true;
    } catch (error) {
      this.logger.error('Error setting git user config:', error);
      throw error;
    }
  }

  /**
   * Get GitHub authentication headers
   * @param {string} token - GitHub token
   * @returns {Promise<Object>} Authentication headers
   */
  async getGitHubAuth(token) {
    try {
      // Dynamic import for Octokit
      if (!Octokit) {
        const octokitModule = await import('@octokit/rest');
        Octokit = octokitModule.Octokit;
      }
      
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      
      return {
        'X-GitHub-OTP': '0',
        'Authorization': `token ${token}`,
        'User-Agent': data.login || 'documental-app'
      };
    } catch (error) {
      this.logger.warn('Could not get GitHub user info, using basic auth:', error.message);
      return {
        'X-GitHub-OTP': '0',
        'Authorization': `token ${token}`,
        'User-Agent': 'documental-app'
      };
    }
  }

  /**
   * Create a new branch
   * @param {string} dir - Repository directory
   * @param {string} branchName - Branch name
   * @param {Function} sendOutput - Output function
   * @returns {Promise<void>}
   */
  async gitCreateBranch(dir, branchName, sendOutput) {
    try {
      sendOutput(`🌿 Criando nova branch '${branchName}' em ${dir}...\n`);
      
      // Validate branch name
      if (!branchName || !/^[a-zA-Z0-9._-]+$/.test(branchName)) {
        throw new Error('Invalid branch name. Only alphanumeric characters, dots, hyphens and underscores are allowed.');
      }
      
      sendOutput(`🔍 Verificando se branch já existe...\n`);
      const existingBranches = await git.listBranches({ fs: require('fs'), dir });
      if (existingBranches.includes(branchName)) {
        const errorMsg = `❌ Branch '${branchName}' já existe.\n`;
        sendOutput(errorMsg);
        throw new Error(`Branch '${branchName}' already exists.`);
      }
      
      sendOutput(`📝 Criando branch '${branchName}'...\n`);
      // Create branch
      await git.branch({
        fs: require('fs'),
        dir,
        ref: branchName
      });
      sendOutput(`✅ Branch '${branchName}' criada com sucesso\n`);
      
      sendOutput(`🔄 Mudando para nova branch '${branchName}'...\n`);
      // Checkout new branch
      await git.checkout({
        fs: require('fs'),
        dir,
        ref: branchName
      });
      sendOutput(`✅ Branch '${branchName}' selecionada com sucesso\n`);
    } catch (error) {
      this.logger.error('Error creating branch:', error);
      throw error;
    }
  }

  /**
   * Checkout to a specific branch
   * @param {string} dir - Repository directory
   * @param {string} branchName - Branch name
   * @param {Function} sendOutput - Output function
   * @returns {Promise<void>}
   */
  async gitCheckoutBranch(dir, branchName, sendOutput) {
    try {
      sendOutput(`🔄 Mudando para branch '${branchName}' em ${dir}...\n`);
      
      // Check if branch exists
      sendOutput(`🔍 Verificando se branch existe...\n`);
      const branches = await git.listBranches({ fs: require('fs'), dir });
      const localBranch = branches.find(b => b === branchName);
      const remoteBranch = branches.find(b => b === `origin/${branchName}`);
      
      if (!localBranch && !remoteBranch) {
        const errorMsg = `❌ Branch '${branchName}' não encontrada.\n`;
        sendOutput(errorMsg);
        throw new Error(`Branch '${branchName}' not found.`);
      }
      
      // If only remote branch exists, create local tracking branch
      if (!localBranch && remoteBranch) {
        sendOutput(`📥 Criando branch local '${branchName}' para rastrear branch remota\n`);
        await git.branch({
          fs: require('fs'),
          dir,
          ref: branchName,
          checkout: true
        });
        sendOutput(`✅ Branch local '${branchName}' criada e selecionada\n`);
      } else {
        // Checkout existing local branch
        sendOutput(`📂 Selecionando branch local existente '${branchName}'\n`);
        await git.checkout({
          fs: require('fs'),
          dir,
          ref: branchName
        });
        sendOutput(`✅ Branch '${branchName}' selecionada com sucesso\n`);
      }
    } catch (error) {
      this.logger.error('Error checking out branch:', error);
      throw error;
    }
  }

  /**
   * Ensure preview branch exists and checkout it
   * @param {string} dir - Repository directory
   * @param {Function} sendOutput - Output function
   * @returns {Promise<Object>} Result object
   */
  async gitEnsurePreviewBranch(dir, sendOutput) {
    try {
      sendOutput(`🔍 Verificando branch 'preview' em ${dir}...\n`);
      
      // List all branches (local and remote)
      const branches = await git.listBranches({ fs: require('fs'), dir });
      const localBranches = branches.filter(branch => !branch.includes('origin/'));
      const remoteBranches = branches.filter(branch => branch.includes('origin/'))
        .map(branch => branch.replace('origin/', ''));
      
      sendOutput(`📋 Branches locais encontradas: ${localBranches.join(', ') || 'nenhuma'}\n`);
      sendOutput(`📋 Branches remotas encontradas: ${remoteBranches.join(', ') || 'nenhuma'}\n`);
      
      const hasLocalPreview = localBranches.includes('preview');
      const hasRemotePreview = remoteBranches.includes('preview');
      
      sendOutput(`📂 Branch 'preview' local: ${hasLocalPreview ? '✅' : '❌'}\n`);
      sendOutput(`🌐 Branch 'preview' remota: ${hasRemotePreview ? '✅' : '❌'}\n`);
      
      if (hasLocalPreview || hasRemotePreview) {
        // Branch exists, checkout it
        sendOutput(`📂 Branch 'preview' encontrada (${hasLocalPreview ? 'local' : 'remota'}), selecionando...\n`);
        await this.gitCheckoutBranch(dir, 'preview', sendOutput);
        sendOutput(`✅ Branch 'preview' selecionada com sucesso\n`);
        return { created: false, checkedOut: true, source: hasLocalPreview ? 'local' : 'remote' };
      }
      
      // Branch doesn't exist locally or remotely, create it from main
      sendOutput(`❌ Branch 'preview' não encontrada localmente ou remotamente\n`);
      sendOutput(`🌿 Criando branch 'preview' a partir de 'main'...\n`);
      
      // First, try to checkout main (or master as fallback)
      let baseBranch = 'main';
      try {
        sendOutput(`🔍 Tentando selecionar branch 'main' como base...\n`);
        await this.gitCheckoutBranch(dir, 'main', sendOutput);
        sendOutput(`✅ Branch 'main' selecionada como base\n`);
      } catch (mainError) {
        sendOutput(`⚠️ Branch 'main' não encontrada: ${mainError.message}\n`);
        try {
          sendOutput(`🔍 Tentando selecionar branch 'master' como base...\n`);
          await this.gitCheckoutBranch(dir, 'master', sendOutput);
          baseBranch = 'master';
          sendOutput(`✅ Branch 'master' selecionada como base (main não encontrada)\n`);
        } catch (masterError) {
          sendOutput(`❌ Branch 'master' também não encontrada: ${masterError.message}\n`);
          throw new Error('Nem branch "main" nem "master" encontrada para criar a branch "preview"');
        }
      }
      
      // Check if working directory is clean before creating branch
      try {
        const status = await git.status({ fs: require('fs'), dir });
        if (status.files && status.files.length > 0) {
          sendOutput(`⚠️ Existem arquivos não commitados no diretório de trabalho\n`);
          sendOutput(`📋 Arquivos modificados: ${status.files.map(f => f.path).join(', ')}\n`);
          sendOutput(`💡 Criando branch 'preview' mesmo com arquivos pendentes\n`);
        } else {
          sendOutput(`✅ Diretório de trabalho limpo, seguro para criar branch\n`);
        }
      } catch (statusError) {
        sendOutput(`⚠️ Não foi possível verificar status do diretório: ${statusError.message}\n`);
      }
      
      // Create preview branch
      sendOutput(`🌿 Criando branch 'preview' a partir de '${baseBranch}'...\n`);
      await this.gitCreateBranch(dir, 'preview', sendOutput);
      sendOutput(`✅ Branch 'preview' criada a partir de '${baseBranch}' com sucesso\n`);
      
      // Optionally push to remote if remote exists and user has authentication
      try {
        const remoteUrl = await this.gitGetRemoteUrl(dir);
        if (remoteUrl) {
          sendOutput(`🌐 Repositório remoto encontrado: ${remoteUrl}\n`);
          sendOutput(`🚀 Tentando publicar branch 'preview' para o repositório remoto...\n`);
          
          const token = await this.getGitHubToken();
          if (token) {
            sendOutput(`🔐 Autenticação GitHub configurada\n`);
            const auth = { username: token, password: 'x-oauth-basic' };
            
            await git.push({
              fs: require('fs'),
              http,
              dir,
              url: remoteUrl,
              ref: 'preview:preview',
              auth,
              force: false
            });
            sendOutput(`✅ Branch 'preview' publicada com sucesso para o repositório remoto\n`);
          } else {
            sendOutput(`⚠️ Autenticação GitHub não configurada\n`);
            sendOutput(`💡 Configure a autenticação GitHub para publicar automaticamente\n`);
          }
        } else {
          sendOutput(`ℹ️ Nenhum repositório remoto configurado\n`);
        }
      } catch (pushError) {
        sendOutput(`⚠️ Não foi possível publicar branch 'preview' para o repositório remoto: ${pushError.message}\n`);
        sendOutput(`💡 A branch 'preview' foi criada localmente e pode ser publicada manualmente depois\n`);
        sendOutput(`💡 Comando para publicar manualmente: git push -u origin preview\n`);
      }
      
      return { created: true, checkedOut: true, baseBranch };
    } catch (error) {
      const errorMsg = `❌ Erro ao garantir branch 'preview': ${error.message}\n`;
      sendOutput(errorMsg);
      this.logger.error('Error ensuring preview branch:', error);
      
      // Provide helpful suggestions based on error type
      if (error.message.includes('main') || error.message.includes('master')) {
        sendOutput(`💡 Sugestão: Verifique se o repositório possui uma branch principal (main ou master)\n`);
      } else if (error.message.includes('authentication') || error.message.includes('auth')) {
        sendOutput(`💡 Sugestão: Configure a autenticação GitHub nas configurações do aplicativo\n`);
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        sendOutput(`💡 Sugestão: Verifique sua conexão com a internet\n`);
      }
      
      throw error;
    }
  }

  /**
   * Get remote URL from repository
   * @param {string} dir - Repository directory
   * @returns {Promise<string|null>} Remote URL or null
   */
  async gitGetRemoteUrl(dir) {
    try {
      return await git.getConfig({
        fs: require('fs'),
        dir,
        path: 'remote.origin.url'
      });
    } catch (error) {
      this.logger.debug('Could not get git remote URL:', error.message);
      return null;
    }
  }
}

module.exports = { GitOperations };