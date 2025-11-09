const { createProject } = require('../../domain/entities/project');

function createSqliteProjectRepository({ db } = {}) {
  if (!db || typeof db.run !== 'function') {
    throw new Error('A sqlite database instance is required');
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function callback(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  function mapRowToProject(row) {
    if (!row) {
      return null;
    }

    return createProject({
      id: row.id,
      name: row.projectName,
      projectPath: row.projectPath,
      githubUrl: row.githubUrl,
      repoFolderName: row.repoFolderName,
      createdAt: row.createdAt
    });
  }

  async function initialize() {
    await run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectName TEXT NOT NULL,
      githubUrl TEXT NOT NULL,
      projectPath TEXT NOT NULL,
      repoFolderName TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  async function save(project) {
    const result = await run(
      `INSERT INTO projects (projectName, githubUrl, projectPath, repoFolderName) VALUES (?, ?, ?, ?)` ,
      [project.name, project.githubUrl, project.projectPath, project.repoFolderName]
    );

    const row = await get(`SELECT * FROM projects WHERE id = ?`, [result.lastID]);
    return mapRowToProject(row);
  }

  async function update(project) {
    await run(
      `UPDATE projects SET projectName = ?, githubUrl = ?, projectPath = ?, repoFolderName = ? WHERE id = ?`,
      [project.name, project.githubUrl, project.projectPath, project.repoFolderName, project.id]
    );

    const row = await get(`SELECT * FROM projects WHERE id = ?`, [project.id]);
    return mapRowToProject(row);
  }

  async function remove(projectId) {
    await run(`DELETE FROM projects WHERE id = ?`, [projectId]);
  }

  async function findById(projectId) {
    const row = await get(`SELECT * FROM projects WHERE id = ?`, [projectId]);
    return mapRowToProject(row);
  }

  async function findRecent(limit = 3) {
    const rows = await all(
      `SELECT * FROM projects ORDER BY datetime(createdAt) DESC LIMIT ?`,
      [limit]
    );
    return rows.map(mapRowToProject);
  }

  async function findAll() {
    const rows = await all(`SELECT * FROM projects ORDER BY datetime(createdAt) DESC`);
    return rows.map(mapRowToProject);
  }

  async function findByProjectPath(projectPath) {
    const row = await get(`SELECT * FROM projects WHERE projectPath = ?`, [projectPath]);
    return mapRowToProject(row);
  }

  return {
    initialize,
    save,
    update,
    delete: remove,
    findById,
    findRecent,
    findAll,
    findByProjectPath
  };
}

module.exports = {
  createSqliteProjectRepository
};
