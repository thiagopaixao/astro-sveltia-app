/**
 * @fileoverview Tests for database module
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('sqlite3', () => ({
  default: {
    Database: vi.fn()
  }
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn()
}));

vi.mock('../../src/main/logging/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}));

const mockSqlite3 = await import('sqlite3');
const mockFs = await import('fs');

// Import the module under test
const { DatabaseManager } = await import('../../src/main/database/database.js');

describe('DatabaseManager', () => {
  let databaseManager;
  let mockDb;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock database instance
    mockDb = {
      run: vi.fn(),
      all: vi.fn(),
      get: vi.fn(),
      close: vi.fn()
    };
    
    // Mock sqlite3.Database constructor
    mockSqlite3.default.Database = vi.fn((path, callback) => {
      // Simulate successful connection
      setTimeout(() => callback(null), 0);
      return mockDb;
    });
    
    // Create database manager instance
    databaseManager = new DatabaseManager({
      userDataPath: '/test/user/data',
      dbName: 'test.db'
    });
  });

  afterEach(async () => {
    if (databaseManager) {
      await databaseManager.close();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const manager = new DatabaseManager();
      expect(manager.config.dbName).toBe('documental.db');
      expect(manager.logger).toBeDefined();
    });

    it('should create instance with custom config', () => {
      const customConfig = {
        userDataPath: '/custom/path',
        dbName: 'custom.db'
      };
      const manager = new DatabaseManager(customConfig);
      expect(manager.config.userDataPath).toBe('/custom/path');
      expect(manager.config.dbName).toBe('custom.db');
    });
  });

  describe('initialize', () => {
    it('should initialize database connection and create tables', async () => {
      // Mock successful table creation
      mockDb.run.mockImplementation((sql, callback) => {
        callback(null);
      });

      await databaseManager.initialize();

      expect(mockSqlite3.default.Database).toHaveBeenCalledWith(
        '/test/user/data/test.db',
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledTimes(2); // projects and users tables
    });

    it('should handle database connection error', async () => {
      const error = new Error('Connection failed');
      mockSqlite3.default.Database = vi.fn((path, callback) => {
        setTimeout(() => callback(error), 0);
      });

      await expect(databaseManager.initialize()).rejects.toThrow('Connection failed');
    });

    it('should handle table creation error', async () => {
      const error = new Error('Table creation failed');
      mockDb.run.mockImplementation((sql, callback) => {
        callback(error);
      });

      await expect(databaseManager.initialize()).rejects.toThrow('Table creation failed');
    });
  });

  describe('getDatabase', () => {
    it('should throw error if database not initialized', () => {
      expect(() => databaseManager.getDatabase()).toThrow('Database not initialized');
    });

    it('should return database instance after initialization', async () => {
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      await databaseManager.initialize();
      
      expect(databaseManager.getDatabase()).toBe(mockDb);
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      await databaseManager.initialize();
    });

    it('should execute run query', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await databaseManager.run('INSERT INTO test VALUES (?)', ['test']);
      
      expect(result).toEqual({ id: 1, changes: 1 });
      expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO test VALUES (?)', ['test'], expect.any(Function));
    });

    it('should handle run query error', async () => {
      const error = new Error('Query failed');
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: null, changes: null }, error);
      });

      await expect(databaseManager.run('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('all', () => {
    beforeEach(async () => {
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      await databaseManager.initialize();
    });

    it('should execute all query', async () => {
      const expectedRows = [{ id: 1, name: 'test' }];
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, expectedRows);
      });

      const result = await databaseManager.all('SELECT * FROM test');
      
      expect(result).toEqual(expectedRows);
      expect(mockDb.all).toHaveBeenCalledWith('SELECT * FROM test', [], expect.any(Function));
    });

    it('should handle all query error', async () => {
      const error = new Error('Query failed');
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(error, null);
      });

      await expect(databaseManager.all('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      await databaseManager.initialize();
    });

    it('should execute get query', async () => {
      const expectedRow = { id: 1, name: 'test' };
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, expectedRow);
      });

      const result = await databaseManager.get('SELECT * FROM test WHERE id = ?', [1]);
      
      expect(result).toEqual(expectedRow);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?', [1], expect.any(Function));
    });

    it('should return null when no row found', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await databaseManager.get('SELECT * FROM test WHERE id = ?', [999]);
      
      expect(result).toBeNull();
    });

    it('should handle get query error', async () => {
      const error = new Error('Query failed');
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(error, null);
      });

      await expect(databaseManager.get('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      mockDb.close.mockImplementation((callback) => callback(null));
      
      await databaseManager.initialize();
      await databaseManager.close();

      expect(mockDb.close).toHaveBeenCalled();
      expect(databaseManager.db).toBeNull();
    });

    it('should handle close error', async () => {
      const error = new Error('Close failed');
      mockDb.run.mockImplementation((sql, callback) => callback(null));
      mockDb.close.mockImplementation((callback) => callback(error));
      
      await databaseManager.initialize();
      await expect(databaseManager.close()).rejects.toThrow('Close failed');
    });

    it('should handle close when database not initialized', async () => {
      await expect(databaseManager.close()).resolves.not.toThrow();
    });
  });
});