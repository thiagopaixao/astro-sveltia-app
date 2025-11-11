/**
 * @fileoverview Teste direto do método gitListBranches
 * @author Documental Team
 * @since 1.0.0
 */

const { GitHandlers } = require('./src/ipc/git.js');

async function testGitListBranches() {
  console.log('🧪 Testando gitListBranches diretamente...\n');

  try {
    // Criar logger mock
    const logger = {
      info: (msg) => console.log(`ℹ️  ${msg}`),
      error: (msg) => console.log(`❌ ${msg}`),
      warn: (msg) => console.log(`⚠️  ${msg}`),
      debug: (msg) => console.log(`🐛 ${msg}`)
    };

    // Criar instância do GitHandlers com dependências corretas
    const gitHandlers = new GitHandlers({ 
      logger: logger,
      databaseManager: null // Não necessário para este teste
    });
    
    // Testar com um caminho de projeto simulado
    const testProjectPath = '/workspaces/astro-sveltia-app/test-repo';
    
    console.log(`📁 Testando com caminho: ${testProjectPath}`);
    console.log('🔧 Verificando se gitHandlers foi instanciado corretamente...');
    console.log('- gitHandlers:', typeof gitHandlers);
    console.log('- gitListBranches method:', typeof gitHandlers.gitListBranches);
    console.log('- logger disponível:', !!gitHandlers.logger);
    
    // Chamar o método gitListBranches diretamente
    const result = await gitHandlers.gitListBranches(testProjectPath);
    
    console.log('\n📊 Resultado bruto:');
    console.log('- Result object:', JSON.stringify(result, null, 2));
    console.log(`- result.current: ${result.current}`);
    console.log(`- result.currentBranch: ${result.currentBranch}`);
    console.log(`- Branches encontradas: ${result.branches.length}`);
    console.log(`- Lista de branches:`, result.branches.map(b => b.name));
    
    // Verificar se encontrou as branches esperadas
    const expectedBranches = ['master', 'preview', 'stage', 'test-feature-branch'];
    const foundBranches = result.branches.map(b => b.name);
    
    console.log('\n🔍 Verificação:');
    expectedBranches.forEach(branch => {
      if (foundBranches.includes(branch)) {
        console.log(`✅ Branch '${branch}' encontrada`);
      } else {
        console.log(`❌ Branch '${branch}' NÃO encontrada`);
      }
    });
    
    if (result.currentBranch) {
      console.log(`✅ Branch atual detectada: ${result.currentBranch}`);
    } else {
      console.log(`❌ Branch atual NÃO detectada`);
    }
    
    return result;
    
  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
    console.log('Stack:', error.stack);
    throw error;
  }
}

// Executar teste
testGitListBranches()
  .then((result) => {
    console.log('\n🎉 Teste concluído com sucesso!');
    console.log(`Total de branches: ${result.branches.length}`);
    console.log(`Branch atual: ${result.currentBranch}`);
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Teste falhou:', error.message);
    process.exit(1);
  });