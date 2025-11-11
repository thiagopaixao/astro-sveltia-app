/**
 * @fileoverview Integration test for branch functionality with real repository
 * @author Documental Team
 * @since 1.0.0
 */

const { GitHandlers } = require('./src/ipc/git.js');
const DatabaseManager = require('./src/main/database/database.js');

async function testBranchFunctionality() {
  console.log('🧪 Testing branch functionality with real repository...\n');

  try {
    // Initialize logger
    const logger = {
      info: (msg) => console.log(`ℹ️  ${msg}`),
      error: (msg) => console.log(`❌ ${msg}`),
      warn: (msg) => console.log(`⚠️  ${msg}`),
      debug: (msg) => console.log(`🐛 ${msg}`)
    };

    // Initialize GitHandlers
    const gitHandlers = new GitHandlers(logger);
    
    // Initialize database manager
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    // Get test repository from database (assuming there's a project with ID 1)
    const db = dbManager.getDatabase();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, projectPath, repoFolderName FROM projects WHERE id = 1',
        [],
        async (err, project) => {
          if (err) {
            console.log('❌ Database error:', err.message);
            return reject(err);
          }

          if (!project) {
            console.log('❌ No test project found in database');
            return reject(new Error('No test project found'));
          }

          console.log(`📁 Testing with project: ${project.projectPath}/${project.repoFolderName}`);

          try {
            // Test 1: Get project path
            console.log('\n1️⃣ Testing getProjectPath...');
            const projectPath = gitHandlers.getProjectPath(project.id);
            console.log(`✅ Project path: ${projectPath}`);

            // Test 2: List branches using filesystem approach
            console.log('\n2️⃣ Testing gitListBranches...');
            const branches = await gitHandlers.gitListBranches(null, { projectId: project.id });
            console.log(`✅ Found ${branches.length} branches:`, branches);

            // Test 3: Get current branch
            console.log('\n3️⃣ Testing gitGetCurrentBranch...');
            const currentBranch = await gitHandlers.gitGetCurrentBranch(null, { projectId: project.id });
            console.log(`✅ Current branch: ${currentBranch}`);

            // Test 4: Get repository info
            console.log('\n4️⃣ Testing gitGetRepositoryInfo...');
            const repoInfo = await gitHandlers.gitGetRepositoryInfo(null, { projectId: project.id });
            console.log(`✅ Repository info:`, repoInfo);

            console.log('\n🎉 All branch functionality tests passed!');
            resolve({
              projectPath,
              branches,
              currentBranch,
              repoInfo
            });

          } catch (error) {
            console.log('❌ Error during branch operations:', error.message);
            reject(error);
          }
        }
      );
    });

  } catch (error) {
    console.log('❌ Setup error:', error.message);
    throw error;
  }
}

// Run the test
testBranchFunctionality()
  .then((results) => {
    console.log('\n📊 Test Results Summary:');
    console.log(`- Project Path: ${results.projectPath}`);
    console.log(`- Branches Found: ${results.branches.length}`);
    console.log(`- Current Branch: ${results.currentBranch}`);
    console.log(`- Repository Status: ${results.repoInfo.status ? 'Clean' : 'Dirty'}`);
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Test failed:', error.message);
    process.exit(1);
  });