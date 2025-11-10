/**
 * @fileoverview IPC handlers for project management operations
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

/**
 * @typedef {Object} ProjectDetails
 * @property {string} projectName - Project name
 * @property {string} githubUrl - GitHub repository URL
 * @property {string} projectPath - Project path
 * @property {string} repoFolderName - Repository folder name
 */

/**
 * @typedef {Object} FolderInfo
 * @property {boolean} isEmpty - Whether folder is empty
 * @property {boolean} isGitRepo - Whether folder is a git repository
 * @property {string|null} remoteUrl - Git remote URL if applicable
 * @property {number} fileCount - Number of files in folder
 */

/**
 * @typedef {Object} ProjectExistsResult
 * @property {boolean} exists - Whether project exists
 * @property {string|null} projectId - Project ID if exists
 * @property {FolderInfo|null} folderInfo - Folder info if doesn't exist
 */

/**
 * Project Management IPC Handlers
 */
class ProjectHandlers {
  /**
   * Create an instance of ProjectHandlers
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.databaseManager - Database manager instance
   * @param {Object} dependencies.projectService - Project service instance
   */
  constructor({ logger, databaseManager, projectService }) {
    this.logger = logger;
    this.databaseManager = databaseManager;
    this.projectService = projectService;
  }

  /**
   * Get project details by ID
   * @param {number} projectId - Project ID
   * @returns {Promise<ProjectDetails>} Project details
   */
  async getProjectDetails(projectId) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT projectName, githubUrl, projectPath, repoFolderName FROM projects WHERE id = ?`,
          [projectId],
          (err, row) => {
            if (err) {
              this.logger.error('Error getting project details:', err.message);
              reject(err.message);
            } else if (row) {
              resolve(row);
            } else {
              reject('Project not found');
            }
          }
        );
      });
    } catch (error) {
      this.logger.error('Error in getProjectDetails:', error);
      throw error;
    }
  }

  /**
   * Get recent projects (last 3)
   * @returns {Promise<Array>} Recent projects list
   */
  async getRecentProjects() {
    try {
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT id, projectName, projectPath, repoFolderName FROM projects ORDER BY createdAt DESC LIMIT 3`,
          (err, rows) => {
            if (err) {
              this.logger.error('Error getting recent projects:', err.message);
              reject(err.message);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } catch (error) {
      this.logger.error('Error in getRecentProjects:', error);
      throw error;
    }
  }

  /**
   * Get all projects
   * @returns {Promise<Array>} All projects list
   */
  async getAllProjects() {
    try {
      this.logger.info('Getting all projects from database...');
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT id, projectName, projectPath, repoFolderName, createdAt FROM projects ORDER BY createdAt DESC`,
          (err, rows) => {
            if (err) {
              this.logger.error('Error getting all projects:', err.message);
              reject(err.message);
            } else {
              this.logger.info(`Found ${rows.length} projects`);
              resolve(rows);
            }
          }
        );
      });
    } catch (error) {
      this.logger.error('Error in getAllProjects:', error);
      throw error;
    }
  }

  /**
   * Check if project exists for given folder path
   * @param {string} folderPath - Folder path to check
   * @returns {Promise<ProjectExistsResult>} Project existence result
   */
  async checkProjectExists(folderPath) {
    try {
      // Check if folder exists
      if (!fs.existsSync(folderPath)) {
        throw new Error('Pasta não encontrada');
      }

      // Check if this path matches any existing project
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all(`SELECT id, projectName, projectPath, repoFolderName FROM projects`, async (err, rows) => {
          if (err) {
            reject(err.message);
            return;
          }

          let matchingProject = null;
          for (const project of rows) {
            const fullProjectPath = path.join(project.projectPath, project.repoFolderName || '');
            if (fullProjectPath === folderPath) {
              matchingProject = project;
              break;
            }
          }

          if (matchingProject) {
            resolve({ exists: true, projectId: matchingProject.id });
          } else {
            // Get folder info
            try {
              const folderInfo = await this.getFolderInfo(folderPath);
              resolve({ exists: false, folderInfo });
            } catch (error) {
              reject(error.message);
            }
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in checkProjectExists:', error);
      throw error;
    }
  }

  /**
   * Get folder information
   * @param {string} folderPath - Folder path
   * @returns {Promise<FolderInfo>} Folder information
   */
  async getFolderInfo(folderPath) {
    try {
      if (!fs.existsSync(folderPath)) {
        throw new Error('Pasta não encontrada');
      }

      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('Caminho não é uma pasta');
      }

      const files = fs.readdirSync(folderPath);
      const isEmpty = files.length === 0;

      let isGitRepo = false;
      let remoteUrl = null;

      // Check if it's a git repository
      const gitPath = path.join(folderPath, '.git');
      if (fs.existsSync(gitPath)) {
        isGitRepo = true;
        try {
          // Get remote URL using isomorphic-git
          remoteUrl = await git.getConfig({
            fs,
            dir: folderPath,
            path: 'remote.origin.url'
          });
        } catch (error) {
          this.logger.debug('Could not get git remote URL:', error.message);
        }
      }

      return {
        isEmpty,
        isGitRepo,
        remoteUrl,
        fileCount: files.length
      };
    } catch (error) {
      throw new Error(`Erro ao analisar pasta: ${error.message}`);
    }
  }

  /**
   * Save project to database
   * @param {Object} projectData - Project data
   * @returns {Promise<number>} Project ID
   */
  async saveProject(projectData) {
    try {
      const { projectName, githubUrl, projectPath } = projectData;
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO projects (projectName, githubUrl, projectPath, repoFolderName) VALUES (?, ?, ?, ?)`,
          [projectName, githubUrl, projectPath, null], // repoFolderName is null initially
          function (err) {
            if (err) {
              this.logger.error('Error saving project:', err.message);
              reject(err.message);
            } else {
              this.logger.info(`Project inserted with rowid ${this.lastID}`);
              resolve(this.lastID);
            }
          }
        );
      });
    } catch (error) {
      this.logger.error('Error in saveProject:', error);
      throw error;
    }
  }

  /**
   * Remove project from database
   * @param {number} projectId - Project ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeProject(projectId) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        db.run(`DELETE FROM projects WHERE id = ?`, [projectId], function (err) {
          if (err) {
            this.logger.error('Error removing project:', err.message);
            reject(err.message);
          } else {
            this.logger.info(`Project ${projectId} removed successfully`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in removeProject:', error);
      throw error;
    }
  }

  /**
   * Register all project management IPC handlers
   */
  registerHandlers() {
    this.logger.info('📁 Registering project management IPC handlers');

    /**
     * Get project details
     */
    ipcMain.handle('get-project-details', async (event, projectId) => {
      try {
        return await this.getProjectDetails(projectId);
      } catch (error) {
        this.logger.error('Error in get-project-details handler:', error);
        throw error;
      }
    });

    /**
     * Get recent projects
     */
    ipcMain.handle('get-recent-projects', async () => {
      try {
        return await this.getRecentProjects();
      } catch (error) {
        this.logger.error('Error in get-recent-projects handler:', error);
        throw error;
      }
    });

    /**
     * Get all projects
     */
    ipcMain.handle('getAllProjects', async () => {
      try {
        return await this.getAllProjects();
      } catch (error) {
        this.logger.error('Error in getAllProjects handler:', error);
        throw error;
      }
    });

    /**
     * Check if project exists
     */
    ipcMain.handle('checkProjectExists', async (event, folderPath) => {
      try {
        return await this.checkProjectExists(folderPath);
      } catch (error) {
        this.logger.error('Error in checkProjectExists handler:', error);
        throw error;
      }
    });

    /**
     * Get folder information
     */
    ipcMain.handle('getFolderInfo', async (event, folderPath) => {
      try {
        return await this.getFolderInfo(folderPath);
      } catch (error) {
        this.logger.error('Error in getFolderInfo handler:', error);
        throw error;
      }
    });

    /**
     * Save project
     */
    ipcMain.handle('save-project', async (event, projectData) => {
      try {
        return await this.saveProject(projectData);
      } catch (error) {
        this.logger.error('Error in save-project handler:', error);
        throw error;
      }
    });

    /**
     * Remove project
     */
    ipcMain.handle('remove-project', async (event, projectId) => {
      try {
        return await this.removeProject(projectId);
      } catch (error) {
        this.logger.error('Error in remove-project handler:', error);
        throw error;
      }
    });

    this.logger.info('✅ Project management IPC handlers registered');
  }

  /**
   * Unregister all project management IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('📁 Unregistering project management IPC handlers');
    
    ipcMain.removeHandler('get-project-details');
    ipcMain.removeHandler('get-recent-projects');
    ipcMain.removeHandler('getAllProjects');
    ipcMain.removeHandler('checkProjectExists');
    ipcMain.removeHandler('getFolderInfo');
    ipcMain.removeHandler('save-project');
    ipcMain.removeHandler('remove-project');
    
    this.logger.info('✅ Project management IPC handlers unregistered');
  }
}

module.exports = { ProjectHandlers };