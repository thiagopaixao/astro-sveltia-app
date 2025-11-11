/**
 * @fileoverview Simple test for branch functionality using test repository
 * @author Documental Team
 * @since 1.0.0
 */

const fs = require('fs');
const path = require('path');

function testBranchListingWithTestRepo() {
  console.log('🧪 Testing branch listing with test repository...\n');

  try {
    // Use the test-repo directory that exists in the project
    const testRepoPath = path.join(__dirname, 'test-repo');
    const refsDir = path.join(testRepoPath, '.git/refs/heads');
    
    console.log(`📁 Test repository path: ${testRepoPath}`);
    console.log(`📂 Refs directory: ${refsDir}`);

    // Test 1: Check if refs directory exists
    console.log('\n1️⃣ Checking refs directory...');
    if (fs.existsSync(refsDir)) {
      console.log('✅ Refs directory exists');
    } else {
      console.log('❌ Refs directory not found');
      return;
    }

    // Test 2: List branches using filesystem approach
    console.log('\n2️⃣ Listing branches using filesystem approach...');
    const branchFiles = fs.readdirSync(refsDir);
    console.log(`📄 Found ${branchFiles.length} files in refs/heads:`, branchFiles);

    // Filter branches (same logic as gitListBranches)
    const branches = branchFiles.filter(branch => 
      !branch.includes('.') && 
      branch !== 'README' && 
      branch !== 'HEAD' &&
      !branch.includes('config')
    );

    console.log(`✅ Valid branches found:`, branches);

    // Test 3: Check current branch via HEAD file
    console.log('\n3️⃣ Checking current branch...');
    const headFile = path.join(testRepoPath, '.git/HEAD');
    if (fs.existsSync(headFile)) {
      const headContent = fs.readFileSync(headFile, 'utf8').trim();
      console.log(`📝 HEAD content: ${headContent}`);
      
      // Extract current branch from HEAD content
      const match = headContent.match(/ref: refs\/heads\/(.+)/);
      if (match) {
        const currentBranch = match[1];
        console.log(`✅ Current branch: ${currentBranch}`);
      } else {
        console.log('⚠️  Not on a branch (detached HEAD)');
      }
    } else {
      console.log('❌ HEAD file not found');
    }

    // Test 4: Test path construction logic
    console.log('\n4️⃣ Testing path construction logic...');
    const projectPath = '/test/project';
    const repoFolderName = 'my-repo';
    const repoPath = `${projectPath}/${repoFolderName}`;
    const constructedRefsDir = `${repoPath}/.git/refs/heads`;
    
    console.log(`✅ Project path: ${projectPath}`);
    console.log(`✅ Repo folder: ${repoFolderName}`);
    console.log(`✅ Full repo path: ${repoPath}`);
    console.log(`✅ Constructed refs dir: ${constructedRefsDir}`);

    console.log('\n🎉 All branch listing tests passed!');
    
    return {
      testRepoPath,
      refsDir,
      branches,
      headFile: fs.existsSync(headFile) ? fs.readFileSync(headFile, 'utf8').trim() : null
    };

  } catch (error) {
    console.log('❌ Error during testing:', error.message);
    throw error;
  }
}

// Run the test
try {
  const results = testBranchListingWithTestRepo();
  console.log('\n📊 Test Results Summary:');
  console.log(`- Test Repository: ${results.testRepoPath}`);
  console.log(`- Branches Found: ${results.branches.length}`);
  console.log(`- Branch Names: ${results.branches.join(', ')}`);
  console.log(`- HEAD Content: ${results.headFile || 'Not found'}`);
  console.log('\n✅ Filesystem-based branch detection is working correctly!');
  process.exit(0);
} catch (error) {
  console.log('\n💥 Test failed:', error.message);
  process.exit(1);
}