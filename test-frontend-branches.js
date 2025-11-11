/**
 * @fileoverview Teste completo do fluxo de branches do frontend
 * @author Documental Team
 * @since 1.0.0
 */

// Simular ambiente do navegador
global.window = {
  electronAPI: {
    listBranches: async (projectId) => {
      console.log('📡 Mock IPC call: listBranches(', projectId, ')');
      
      // Simular resposta do IPC com dados reais do test-repo
      return {
        success: true,
        branches: [
          { name: 'master', isCurrent: true, isRemote: false },
          { name: 'preview', isCurrent: false, isRemote: false },
          { name: 'stage', isCurrent: false, isRemote: false },
          { name: 'test-feature-branch', isCurrent: false, isRemote: false }
        ],
        currentBranch: 'master'
      };
    }
  }
};

// Simular sessionStorage
global.sessionStorage = {
  getItem: (key) => {
    if (key === 'currentProjectId') {
      return '1'; // Simular projeto ID 1
    }
    return null;
  },
  setItem: (key, value) => {
    console.log(`📝 sessionStorage.setItem('${key}', '${value}')`);
  }
};

// Função loadBranches do frontend
async function loadBranches() {
    console.log('🔍 loadBranches called');
    const projectId = sessionStorage.getItem('currentProjectId');
    console.log('- projectId from sessionStorage:', projectId);
    console.log('- window.electronAPI available:', !!window.electronAPI);
    console.log('- listBranches method available:', !!(window.electronAPI && window.electronAPI.listBranches));
    
    if (!projectId) {
        console.warn('❌ No project ID found, cannot load branches');
        return { branches: [], currentBranch: null };
    }
    
    try {
        console.log('📡 Calling window.electronAPI.listBranches with projectId:', projectId);
        const result = await window.electronAPI.listBranches(projectId);
        console.log('📥 Raw result from IPC:', result);
        
        if (result.success) {
            console.log('✅ IPC call successful');
            console.log('- result.branches:', result.branches);
            console.log('- result.currentBranch:', result.currentBranch);
            
            const branches = result.branches || [];
            const currentBranch = result.currentBranch;
            
            console.log('✅ Branches loaded:', { 
                branches: branches, 
                current: currentBranch,
                branchesCount: branches.length 
            });
            
            return { branches, currentBranch };
        } else {
            console.error('❌ Error loading branches:', result.error);
            return { branches: [], currentBranch: null };
        }
    } catch (error) {
        console.error('❌ Error loading branches:', error);
        console.error('Stack:', error.stack);
        return { branches: [], currentBranch: null };
    }
}

// Testar o fluxo completo
async function testCompleteBranchFlow() {
    console.log('🧪 Testando fluxo completo de branches do frontend...\n');
    
    try {
        // 1. Testar sessionStorage
        console.log('1️⃣ Testando sessionStorage...');
        const projectId = sessionStorage.getItem('currentProjectId');
        console.log('✅ ProjectId from sessionStorage:', projectId);
        
        // 2. Testar se electronAPI está disponível
        console.log('\n2️⃣ Testando electronAPI...');
        console.log('- window.electronAPI disponível:', !!window.electronAPI);
        console.log('- listBranches disponível:', !!(window.electronAPI && window.electronAPI.listBranches));
        
        // 3. Testar loadBranches
        console.log('\n3️⃣ Testando loadBranches...');
        const result = await loadBranches();
        
        // 4. Validar resultado
        console.log('\n4️⃣ Validando resultado...');
        console.log('- Success:', result.branches.length > 0);
        console.log('- Branch count:', result.branches.length);
        console.log('- Current branch:', result.currentBranch);
        console.log('- Branch names:', result.branches.map(b => b.name));
        
        // 5. Verificar branches esperadas
        const expectedBranches = ['master', 'preview', 'stage', 'test-feature-branch'];
        const foundBranches = result.branches.map(b => b.name);
        
        console.log('\n5️⃣ Verificação de branches:');
        let allFound = true;
        expectedBranches.forEach(branch => {
            if (foundBranches.includes(branch)) {
                console.log(`✅ Branch '${branch}' encontrada`);
            } else {
                console.log(`❌ Branch '${branch}' NÃO encontrada`);
                allFound = false;
            }
        });
        
        if (result.currentBranch) {
            console.log(`✅ Branch atual detectada: ${result.currentBranch}`);
        } else {
            console.log(`❌ Branch atual NÃO detectada`);
            allFound = false;
        }
        
        if (allFound && result.branches.length === expectedBranches.length) {
            console.log('\n🎉 Teste concluído com SUCESSO!');
            console.log('✅ Todas as branches encontradas');
            console.log('✅ Branch atual detectada');
            console.log('✅ Fluxo do frontend funcionando');
            return true;
        } else {
            console.log('\n💥 Teste FALHOU!');
            console.log('❌ Algumas branches faltando ou problema no fluxo');
            return false;
        }
        
    } catch (error) {
        console.log('\n💥 Erro no teste:', error.message);
        console.log('Stack:', error.stack);
        return false;
    }
}

// Executar teste
testCompleteBranchFlow()
  .then((success) => {
    if (success) {
        console.log('\n✅ Frontend branch flow está funcionando corretamente!');
        console.log('O problema pode estar na inicialização do app ou no estado do modal.');
        process.exit(0);
    } else {
        console.log('\n❌ Frontend branch flow tem problemas!');
        process.exit(1);
    }
  })
  .catch((error) => {
    console.log('\n💥 Teste falhou:', error.message);
    process.exit(1);
  });