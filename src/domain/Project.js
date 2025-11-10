/**
 * @fileoverview Project domain entity
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

/**
 * @typedef {Object} ProjectConfig
 * @property {string} name - Project name
 * @property {string} path - Project file path
 * @property {string} [repoFolderName] - Repository folder name
 * @property {string} [repoUrl] - Git repository URL
 * @property {number} [id] - Database ID
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * Project domain entity representing a development project
 */
class Project {
  /**
   * Create a new Project instance
   * @param {ProjectConfig} config - Project configuration
   */
  constructor(config = {}) {
    this.id = config.id || null;
    this.name = config.name || '';
    this.path = config.path || '';
    this.repoFolderName = config.repoFolderName || null;
    this.repoUrl = config.repoUrl || null;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.updatedAt = config.updatedAt ? new Date(config.updatedAt) : new Date();
  }

  /**
   * Validate project data
   * @returns {boolean} True if project is valid
   */
  isValid() {
    return (
      this.name.trim().length > 0 &&
      this.path.trim().length > 0 &&
      this.path.startsWith('/') // Basic path validation
    );
  }

  /**
   * Update project data
   * @param {Partial<ProjectConfig>} updates - Fields to update
   * @returns {Project} Updated project instance
   */
  update(updates = {}) {
    const updatedData = { ...this.toJSON(), ...updates, updatedAt: new Date() };
    return new Project(updatedData);
  }

  /**
   * Check if project has a Git repository
   * @returns {boolean} True if project has repository info
   */
  hasRepository() {
    return !!(this.repoFolderName && this.repoUrl);
  }

  /**
   * Get project display name
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.name || 'Untitled Project';
  }

  /**
   * Get project folder name from path
   * @returns {string} Folder name
   */
  getFolderName() {
    if (!this.path) return '';
    const parts = this.path.split('/');
    return parts[parts.length - 1] || '';
  }

  /**
   * Check if project path exists (basic check)
   * @returns {boolean} True if path seems valid
   */
  hasValidPath() {
    return this.path.trim().length > 0 && this.path !== '/' && this.path !== '.';
  }

  /**
   * Convert project to JSON object
   * @returns {ProjectConfig} Project data
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      repoFolderName: this.repoFolderName,
      repoUrl: this.repoUrl,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Create Project from database row
   * @param {Object} row - Database row data
   * @returns {Project} Project instance
   */
  static fromDatabaseRow(row) {
    return new Project({
      id: row.id,
      name: row.projectName,
      path: row.projectPath,
      repoFolderName: row.repoFolderName,
      repoUrl: row.repoUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  /**
   * Create Project from plain object
   * @param {ProjectConfig} data - Plain object data
   * @returns {Project} Project instance
   */
  static fromJSON(data) {
    return new Project(data);
  }

  /**
   * Validate project configuration
   * @param {ProjectConfig} config - Configuration to validate
   * @returns {Object} Validation result
   */
  static validate(config) {
    const errors = [];
    const warnings = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!config.path || config.path.trim().length === 0) {
      errors.push('Project path is required');
    }

    if (config.path && !config.path.startsWith('/')) {
      warnings.push('Project path should be absolute');
    }

    if (config.name && config.name.length > 255) {
      warnings.push('Project name is very long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get project type based on repository
   * @returns {string} Project type
   */
  getType() {
    if (!this.repoUrl) return 'local';
    
    if (this.repoUrl.includes('github.com')) return 'github';
    if (this.repoUrl.includes('gitlab.com')) return 'gitlab';
    if (this.repoUrl.includes('bitbucket.org')) return 'bitbucket';
    
    return 'git';
  }

  /**
   * Get repository name from URL
   * @returns {string|null} Repository name
   */
  getRepositoryName() {
    if (!this.repoUrl) return null;
    
    const match = this.repoUrl.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  }

  /**
   * Get repository owner from URL
   * @returns {string|null} Repository owner
   */
  getRepositoryOwner() {
    if (!this.repoUrl) return null;
    
    const match = this.repoUrl.match(/\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  }
}

module.exports = {
  Project
};