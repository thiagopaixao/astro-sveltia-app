/**
 * @fileoverview Teste completo do IPC handler para branches
 * @author Documental Team
 * @since 1.0.0
 */

const { GitHandlers } = require('./src/ipc/git.js');

async function testIPCHandler() {
  console.log('🧪 Testando IPC handler para branches...\n');

  try {
    // Criar logger mock
    const logger = {
      info: (msg) => console.log(`ℹ️  ${msg}`),
      error: (msg) => console.log(`❌ ${msg}`),
      warn: (msg) => console.log(`⚠️  ${msg}`),
      debug: (msg) => console.log(`🐛 ${msg}`)
    };

    // Mock database manager que retorna o test-repo
    const mockDatabaseManager = {
      getDatabase: () => Promise.resolve({
        get: (query, params, callback) => {
          // Simular retorno do banco de dados com projeto test-repo
          callback(null, {
            id: 1,
            projectPath: '/workspaces/astro-sveltia-app',
            repoFolderName: 'test-repo'
          });
        }
      })
    };

    // Criar instância do GitHandlers com dependências corretas
    const gitHandlers = new GitHandlers({ 
      logger: logger,
      databaseManager: mockDatabaseManager
    });

    console.log('🔧 Instância criada com sucesso');
    console.log('- getProjectPath method:', typeof gitHandlers.getProjectPath);
    console.log('- gitListBranches method:', typeof gitHandlers.gitListBranches);

    // Testar getProjectPath primeiro
    console.log('\n1️⃣ Testando getProjectPath...');
    const projectPath = await gitHandlers.getProjectPath(1);
    console.log(`✅ Project path: ${projectPath}`);

    // Testar gitListBranches com o path retornado
    console.log('\n2️⃣ Testando gitListBranches...');
    const branchResult = await gitHandlers.gitListBranches(projectPath);
    console.log(`✅ Branches: ${branchResult.branches.length}, Current: ${branchResult.current}`);

    // Simular o IPC handler
    console.log('\n3️⃣ Simulando IPC handler...');
    const mockEvent = {}; // Mock event object
    const ipcResult = await (async (event, projectId) => {
      try {
        const projectPath = await gitHandlers.getProjectPath(projectId);
        const result = await gitHandlers.gitListBranches(projectPath);
        return { success: true, branches: result.branches, currentBranch: result.current };
      } catch (error) {
        logger.error('Error in git:list-branches handler:', error);
        return { success: false, error: error.message };
      }
    })(mockEvent, 1);

    console.log('\n📊 Resultado do IPC:');
    console.log('- Success:', ipcResult.success);
    console.log('- Branches:', ipcResult.branches?.length || 0);
    console.log('- CurrentBranch:', ipcResult.currentBranch);
    
    if (ipcResult.success) {
      console.log('- Branch names:', ipcResult.branches.map(b => b.name));
      console.log('- Current branch marked:', ipcResult.branches.find(b => b.isCurrent)?.name || 'None');
    }

    return ipcResult;

  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
    console.log('Stack:', error.stack);
    throw error;
  }
}

// Executar teste
testIPCHandler()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Teste IPC concluído com sucesso!');
      console.log(`✅ Branches encontradas: ${result.branches.length}`);
      console.log(`✅ Branch atual: ${result.currentBranch}`);
      process.exit(0);
    } else {
      console.log('\n💥 Teste IPC falhou:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log('\n💥 Teste falhou:', error.message);
    process.exit(1);
  });