/**
 * @fileoverview User domain entity for GitHub authentication
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

/**
 * @typedef {Object} UserConfig
 * @property {string} githubId - GitHub user ID
 * @property {string} login - GitHub username
 * @property {string} [name] - Display name
 * @property {string} [email] - Email address
 * @property {string} [avatarUrl] - Profile picture URL
 * @property {number} [id] - Database ID
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * User domain entity representing a GitHub user
 */
class User {
  /**
   * Create a new User instance
   * @param {UserConfig} config - User configuration
   */
  constructor(config = {}) {
    this.id = config.id || null;
    this.githubId = config.githubId || '';
    this.login = config.login || '';
    this.name = config.name || null;
    this.email = config.email || null;
    this.avatarUrl = config.avatarUrl || null;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.updatedAt = config.updatedAt ? new Date(config.updatedAt) : new Date();
  }

  /**
   * Validate user data
   * @returns {boolean} True if user is valid
   */
  isValid() {
    return (
      this.githubId.trim().length > 0 &&
      this.login.trim().length > 0
    );
  }

  /**
   * Update user data
   * @param {Partial<UserConfig>} updates - Fields to update
   * @returns {User} Updated user instance
   */
  update(updates = {}) {
    const updatedData = { ...this.toJSON(), ...updates, updatedAt: new Date() };
    return new User(updatedData);
  }

  /**
   * Get user display name
   * @returns {string} Display name (name or login)
   */
  getDisplayName() {
    return this.name || this.login || 'Unknown User';
  }

  /**
   * Check if user has complete profile
   * @returns {boolean} True if profile is complete
   */
  hasCompleteProfile() {
    return !!(this.name && this.email && this.avatarUrl);
  }

  /**
   * Check if user has avatar
   * @returns {boolean} True if avatar URL is present
   */
  hasAvatar() {
    return !!(this.avatarUrl && this.avatarUrl.trim().length > 0);
  }

  /**
   * Get avatar URL with fallback
   * @param {string} [fallbackUrl] - Fallback URL
   * @returns {string} Avatar URL or fallback
   */
  getAvatarUrl(fallbackUrl = '') {
    return this.hasAvatar() ? this.avatarUrl : fallbackUrl;
  }

  /**
   * Convert user to JSON object
   * @returns {UserConfig} User data
   */
  toJSON() {
    return {
      id: this.id,
      githubId: this.githubId,
      login: this.login,
      name: this.name,
      email: this.email,
      avatarUrl: this.avatarUrl,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Create User from database row
   * @param {Object} row - Database row data
   * @returns {User} User instance
   */
  static fromDatabaseRow(row) {
    return new User({
      id: row.id,
      githubId: row.githubId,
      login: row.login,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  /**
   * Create User from GitHub API response
   * @param {Object} githubData - GitHub API user data
   * @returns {User} User instance
   */
  static fromGitHubAPI(githubData) {
    return new User({
      githubId: githubData.id.toString(),
      login: githubData.login,
      name: githubData.name || null,
      email: githubData.email || null,
      avatarUrl: githubData.avatar_url || null
    });
  }

  /**
   * Create User from plain object
   * @param {UserConfig} data - Plain object data
   * @returns {User} User instance
   */
  static fromJSON(data) {
    return new User(data);
  }

  /**
   * Validate user configuration
   * @param {UserConfig} config - Configuration to validate
   * @returns {Object} Validation result
   */
  static validate(config) {
    const errors = [];
    const warnings = [];

    if (!config.githubId || config.githubId.trim().length === 0) {
      errors.push('GitHub ID is required');
    }

    if (!config.login || config.login.trim().length === 0) {
      errors.push('GitHub login is required');
    }

    if (config.login && !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(config.login)) {
      errors.push('Invalid GitHub login format');
    }

    if (config.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
      warnings.push('Email format appears invalid');
    }

    if (config.avatarUrl && !config.avatarUrl.startsWith('http')) {
      warnings.push('Avatar URL should start with http/https');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get GitHub profile URL
   * @returns {string} GitHub profile URL
   */
  getGitHubUrl() {
    return `https://github.com/${this.login}`;
  }

  /**
   * Check if user is the same as another user
   * @param {User} other - Other user to compare
   * @returns {boolean} True if users are the same
   */
  equals(other) {
    if (!other || !(other instanceof User)) {
      return false;
    }
    return this.githubId === other.githubId;
  }

  /**
   * Get user initials for avatar fallback
   * @returns {string} User initials
   */
  getInitials() {
    const name = this.getDisplayName();
    const parts = name.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    
    return parts
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }
}

module.exports = {
  User
};