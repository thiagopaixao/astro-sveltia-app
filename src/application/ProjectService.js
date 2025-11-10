/**
 * @fileoverview Project service for application layer
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { getLogger } = require('../main/logging/logger.js');
const { Project } = require('../domain/Project.js');

/**
 * @typedef {Object} ProjectServiceConfig
 * @property {Object} database - Database instance
 * @property {Object} logger - Logger instance
 */

/**
 * Project service handling project operations
 */
class ProjectService {
  /**
   * Create a new ProjectService instance
   * @param {ProjectServiceConfig} config - Service configuration
   */
  constructor(config = {}) {
    this.database = config.database;
    this.logger = config.logger || getLogger('ProjectService');
  }

  /**
   * Get all projects
   * @returns {Promise<Project[]>} Array of projects
   */
  async getAllProjects() {
    try {
      this.logger.info('📂 Fetching all projects from database');
      const rows = await this.database.all('SELECT * FROM projects ORDER BY updatedAt DESC');
      const projects = rows.map(row => Project.fromDatabaseRow(row));
      this.logger.info(`✅ Found ${projects.length} projects`);
      return projects;
    } catch (error) {
      this.logger.error('❌ Failed to fetch projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  /**
   * Get project by ID
   * @param {number} id - Project ID
   * @returns {Promise<Project|null>} Project or null if not found
   */
  async getProjectById(id) {
    try {
      this.logger.info(`🔍 Fetching project with ID: ${id}`);
      const row = await this.database.get('SELECT * FROM projects WHERE id = ?', [id]);
      
      if (!row) {
        this.logger.warn(`⚠️ Project with ID ${id} not found`);
        return null;
      }
      
      const project = Project.fromDatabaseRow(row);
      this.logger.info(`✅ Found project: ${project.getDisplayName()}`);
      return project;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch project ${id}:`, error);
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
  }

  /**
   * Create a new project
   * @param {ProjectConfig} projectData - Project data
   * @returns {Promise<Project>} Created project
   */
  async createProject(projectData) {
    try {
      const project = new Project(projectData);
      
      // Validate project
      if (!project.isValid()) {
        const validation = Project.validate(projectData);
        throw new Error(`Invalid project data: ${validation.errors.join(', ')}`);
      }
      
      this.logger.info(`➕ Creating new project: ${project.getDisplayName()}`);
      
      const result = await this.database.run(
        `INSERT INTO projects (projectName, projectPath, repoFolderName, repoUrl) 
         VALUES (?, ?, ?, ?)`,
        [project.name, project.path, project.repoFolderName, project.repoUrl]
      );
      
      const createdProject = project.update({ id: result.id });
      this.logger.info(`✅ Project created with ID: ${result.id}`);
      
      return createdProject;
    } catch (error) {
      this.logger.error('❌ Failed to create project:', error);
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * Update an existing project
   * @param {number} id - Project ID
   * @param {Partial<ProjectConfig>} updates - Fields to update
   * @returns {Promise<Project|null>} Updated project or null if not found
   */
  async updateProject(id, updates) {
    try {
      this.logger.info(`📝 Updating project with ID: ${id}`);
      
      const existingProject = await this.getProjectById(id);
      if (!existingProject) {
        return null;
      }
      
      const updatedProject = existingProject.update(updates);
      
      // Validate updated project
      if (!updatedProject.isValid()) {
        const validation = Project.validate(updatedProject.toJSON());
        throw new Error(`Invalid project data: ${validation.errors.join(', ')}`);
      }
      
      await this.database.run(
        `UPDATE projects 
         SET projectName = ?, projectPath = ?, repoFolderName = ?, repoUrl = ?, updatedAt = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [updatedProject.name, updatedProject.path, updatedProject.repoFolderName, updatedProject.repoUrl, id]
      );
      
      this.logger.info(`✅ Project ${id} updated successfully`);
      return updatedProject;
    } catch (error) {
      this.logger.error(`❌ Failed to update project ${id}:`, error);
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  /**
   * Delete a project
   * @param {number} id - Project ID
   * @returns {Promise<boolean>} True if project was deleted
   */
  async deleteProject(id) {
    try {
      this.logger.info(`🗑️ Deleting project with ID: ${id}`);
      
      const project = await this.getProjectById(id);
      if (!project) {
        return false;
      }
      
      const result = await this.database.run('DELETE FROM projects WHERE id = ?', [id]);
      
      if (result.changes > 0) {
        this.logger.info(`✅ Project ${project.getDisplayName()} deleted successfully`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`❌ Failed to delete project ${id}:`, error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Search projects by name or path
   * @param {string} query - Search query
   * @returns {Promise<Project[]>} Matching projects
   */
  async searchProjects(query) {
    try {
      this.logger.info(`🔍 Searching projects with query: ${query}`);
      
      const searchPattern = `%${query}%`;
      const rows = await this.database.all(
        `SELECT * FROM projects 
         WHERE projectName LIKE ? OR projectPath LIKE ? 
         ORDER BY updatedAt DESC`,
        [searchPattern, searchPattern]
      );
      
      const projects = rows.map(row => Project.fromDatabaseRow(row));
      this.logger.info(`✅ Found ${projects.length} matching projects`);
      
      return projects;
    } catch (error) {
      this.logger.error(`❌ Failed to search projects:`, error);
      throw new Error(`Failed to search projects: ${error.message}`);
    }
  }

  /**
   * Get projects by type (local, github, gitlab, etc.)
   * @param {string} type - Project type
   * @returns {Promise<Project[]>} Projects of specified type
   */
  async getProjectsByType(type) {
    try {
      this.logger.info(`📂 Fetching projects of type: ${type}`);
      
      let whereClause = '1=1';
      if (type === 'github') {
        whereClause = 'repoUrl LIKE "%github.com%"';
      } else if (type === 'gitlab') {
        whereClause = 'repoUrl LIKE "%gitlab.com%"';
      } else if (type === 'bitbucket') {
        whereClause = 'repoUrl LIKE "%bitbucket.org%"';
      } else if (type === 'local') {
        whereClause = 'repoUrl IS NULL OR repoUrl = ""';
      }
      
      const rows = await this.database.all(
        `SELECT * FROM projects WHERE ${whereClause} ORDER BY updatedAt DESC`
      );
      
      const projects = rows.map(row => Project.fromDatabaseRow(row));
      this.logger.info(`✅ Found ${projects.length} ${type} projects`);
      
      return projects;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch ${type} projects:`, error);
      throw new Error(`Failed to fetch ${type} projects: ${error.message}`);
    }
  }

  /**
   * Get recent projects (limited number)
   * @param {number} limit - Maximum number of projects
   * @returns {Promise<Project[]>} Recent projects
   */
  async getRecentProjects(limit = 5) {
    try {
      this.logger.info(`📂 Fetching ${limit} recent projects`);
      
      const rows = await this.database.all(
        'SELECT * FROM projects ORDER BY updatedAt DESC LIMIT ?',
        [limit]
      );
      
      const projects = rows.map(row => Project.fromDatabaseRow(row));
      this.logger.info(`✅ Found ${projects.length} recent projects`);
      
      return projects;
    } catch (error) {
      this.logger.error('❌ Failed to fetch recent projects:', error);
      throw new Error(`Failed to fetch recent projects: ${error.message}`);
    }
  }

  /**
   * Check if project path already exists
   * @param {string} path - Project path
   * @returns {Promise<boolean>} True if path exists
   */
  async pathExists(path) {
    try {
      const row = await this.database.get(
        'SELECT id FROM projects WHERE projectPath = ?',
        [path]
      );
      return !!row;
    } catch (error) {
      this.logger.error('❌ Failed to check path existence:', error);
      return false;
    }
  }
}

module.exports = {
  ProjectService
};