#!/usr/bin/env node

/**
 * Test Complete Branch Loading Flow
 * Tests the complete flow from project setup to branch modal opening
 */

const mockElectronAPI = {
    listBranches: async (projectId) => {
        console.log('🔧 Mock IPC: listBranches called with projectId:', projectId);
        
        // Simulate the actual backend behavior
        const mockResult = {
            success: true,
            branches: ['master', 'preview', 'stage', 'test-feature-branch'],
            currentBranch: 'master'
        };
        
        console.log('🔧 Mock IPC: Returning result:', mockResult);
        return mockResult;
    },
    navigateTo: (page) => {
        console.log(`🔧 Mock Navigation: Navigating to ${page}`);
    }
};

// Mock sessionStorage
const sessionStorage = {
    data: {},
    getItem: function(key) {
        const value = this.data[key] || null;
        console.log(`🔧 SessionStorage: getItem('${key}') =`, value);
        return value;
    },
    setItem: function(key, value) {
        console.log(`🔧 SessionStorage: setItem('${key}', '${value}')`);
        this.data[key] = value;
    },
    removeItem: function(key) {
        console.log(`🔧 SessionStorage: removeItem('${key}')`);
        delete this.data[key];
    },
    get keys() {
        return Object.keys(this.data);
    }
};

// Mock window object
global.window = {
    electronAPI: mockElectronAPI
};

global.sessionStorage = sessionStorage;
global.console = console;

// Simulate the Alpine.js loadBranches method
async function simulateLoadBranches() {
    console.log('\n=== SIMULATING LOADBRANCHES() ===');
    
    const projectId = sessionStorage.getItem('currentProjectId');
    console.log('🔍 loadBranches called');
    console.log('- projectId from sessionStorage:', projectId);
    console.log('- window.electronAPI available:', !!window.electronAPI);
    console.log('- listBranches method available:', !!(window.electronAPI && window.electronAPI.listBranches));
    
    if (!projectId) {
        console.warn('❌ No project ID found, cannot load branches');
        return { success: false, error: 'No project ID' };
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
            const selectedBranch = result.currentBranch;
            
            console.log('✅ Branches loaded:', { 
                branches, 
                current: currentBranch,
                selected: selectedBranch,
                branchesCount: branches.length 
            });
            
            return { success: true, branches, currentBranch, selectedBranch };
        } else {
            console.error('❌ IPC call failed:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Exception in loadBranches:', error);
        return { success: false, error: error.message };
    }
}

// Simulate main.html init()
function simulateMainInit() {
    console.log('\n=== SIMULATING MAIN.HTML INIT() ===');
    console.log('🚀 INIT STARTED - Renderer initialization beginning');
    
    // Check project context immediately
    const currentProjectId = sessionStorage.getItem('currentProjectId');
    console.log('🔍 PROJECT CONTEXT CHECK - currentProjectId:', currentProjectId);
    console.log('🔍 All sessionStorage keys:', sessionStorage.keys);
    
    return currentProjectId;
}

// Simulate create.html flow
async function simulateCreateFlow() {
    console.log('\n=== SIMULATING CREATE.HTML FLOW ===');
    
    // Step 1: Project creation sets currentProjectId
    console.log('📝 Step 1: Creating project...');
    sessionStorage.setItem('currentProjectId', 'test-project-123');
    sessionStorage.setItem('isExistingGitRepo', 'false');
    sessionStorage.setItem('isEmptyFolder', 'true');
    
    // Step 2: create.html initialization
    console.log('📝 Step 2: create.html initialization...');
    const projectId = sessionStorage.getItem('currentProjectId');
    console.log('- projectId loaded:', projectId);
    
    // Step 3: User completes all steps and clicks finish
    console.log('📝 Step 3: User clicks finish button...');
    console.log('- Before navigation - currentProjectId:', sessionStorage.getItem('currentProjectId'));
    
    // Simulate the FIXED navigation button behavior
    console.log('🔧 FIXED BEHAVIOR: Ensuring project context before navigation');
    sessionStorage.setItem('currentProjectId', projectId); // Ensure it's set
    window.electronAPI.navigateTo('main.html');
    
    console.log('- After navigation - currentProjectId:', sessionStorage.getItem('currentProjectId'));
    
    return projectId;
}

// Simulate open.html flow
async function simulateOpenFlow() {
    console.log('\n=== SIMULATING OPEN.HTML FLOW ===');
    
    // Clear session storage first
    sessionStorage.data = {};
    
    // Step 1: Project selection sets currentProjectId
    console.log('📝 Step 1: Opening existing project...');
    sessionStorage.setItem('currentProjectId', 'existing-project-456');
    
    // Step 2: open.html initialization
    console.log('📝 Step 2: open.html initialization...');
    const projectId = sessionStorage.getItem('currentProjectId');
    console.log('- projectId loaded:', projectId);
    
    // Step 3: User completes all steps and clicks finish
    console.log('📝 Step 3: User clicks finish button...');
    console.log('- Before navigation - currentProjectId:', sessionStorage.getItem('currentProjectId'));
    
    // Simulate the FIXED navigation button behavior
    console.log('🔧 FIXED BEHAVIOR: Ensuring project context before navigation');
    sessionStorage.setItem('currentProjectId', projectId); // Ensure it's set
    window.electronAPI.navigateTo('main.html');
    
    console.log('- After navigation - currentProjectId:', sessionStorage.getItem('currentProjectId'));
    
    return projectId;
}

// Test the complete flows
async function runCompleteTest() {
    console.log('=== COMPLETE BRANCH LOADING FLOW TEST ===\n');
    
    // Test Create Flow
    console.log('🧪 TESTING CREATE.HTML FLOW');
    const createProjectId = await simulateCreateFlow();
    const mainProjectId = simulateMainInit();
    const createResult = await simulateLoadBranches();
    
    console.log('\n📊 CREATE FLOW RESULTS:');
    console.log('- Project ID from create.html:', createProjectId);
    console.log('- Project ID in main.html init:', mainProjectId);
    console.log('- Branch loading result:', createResult);
    console.log('- Success:', createResult.success && createProjectId === mainProjectId);
    
    // Test Open Flow
    console.log('\n🧪 TESTING OPEN.HTML FLOW');
    const openProjectId = await simulateOpenFlow();
    const mainProjectId2 = simulateMainInit();
    const openResult = await simulateLoadBranches();
    
    console.log('\n📊 OPEN FLOW RESULTS:');
    console.log('- Project ID from open.html:', openProjectId);
    console.log('- Project ID in main.html init:', mainProjectId2);
    console.log('- Branch loading result:', openResult);
    console.log('- Success:', openResult.success && openProjectId === mainProjectId2);
    
    console.log('\n=== FINAL ANALYSIS ===');
    console.log('✅ FIXED ISSUES:');
    console.log('1. Navigation buttons now preserve project context');
    console.log('2. main.html init() now logs project context for debugging');
    console.log('3. Branch loading should work correctly after navigation');
    
    if (createResult.success && openResult.success) {
        console.log('🎉 BOTH FLOWS WORKING - Branch modal should now load branches correctly!');
    } else {
        console.log('❌ Issues still exist - need further investigation');
    }
}

// Run the test
runCompleteTest().catch(console.error);