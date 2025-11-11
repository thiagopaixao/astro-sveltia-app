#!/usr/bin/env node

/**
 * Test Frontend Branch Loading Simulation
 * Simulates the complete frontend environment to identify why branches aren't loading
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
    }
};

// Mock sessionStorage
const sessionStorage = {
    data: {},
    getItem: function(key) {
        console.log(`🔧 SessionStorage: getItem('${key}') =`, this.data[key] || null);
        return this.data[key] || null;
    },
    setItem: function(key, value) {
        console.log(`🔧 SessionStorage: setItem('${key}', '${value}')`);
        this.data[key] = value;
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

// Test different scenarios
async function runScenarios() {
    console.log('=== FRONTEND BRANCH LOADING TEST ===\n');
    
    // Scenario 1: No project ID set (common issue)
    console.log('🧪 SCENARIO 1: No project ID in sessionStorage');
    sessionStorage.data = {}; // Clear session storage
    let result = await simulateLoadBranches();
    console.log('Result:', result);
    console.log('');
    
    // Scenario 2: Project ID set (ideal case)
    console.log('🧪 SCENARIO 2: Project ID set in sessionStorage');
    sessionStorage.setItem('currentProjectId', 'test-project-123');
    result = await simulateLoadBranches();
    console.log('Result:', result);
    console.log('');
    
    // Scenario 3: electronAPI not available
    console.log('🧪 SCENARIO 3: electronAPI not available');
    sessionStorage.setItem('currentProjectId', 'test-project-123');
    const originalAPI = window.electronAPI;
    delete window.electronAPI;
    result = await simulateLoadBranches();
    console.log('Result:', result);
    window.electronAPI = originalAPI; // Restore
    console.log('');
    
    // Scenario 4: listBranches method missing
    console.log('🧪 SCENARIO 4: listBranches method missing');
    sessionStorage.setItem('currentProjectId', 'test-project-123');
    window.electronAPI = {};
    result = await simulateLoadBranches();
    console.log('Result:', result);
    console.log('');
    
    console.log('=== ANALYSIS ===');
    console.log('Based on the test results, the most likely issues are:');
    console.log('1. currentProjectId not set in sessionStorage when modal opens');
    console.log('2. window.electronAPI not available in renderer context');
    console.log('3. Timing issue - modal opens before project context is established');
    console.log('4. Navigation flow not properly setting project context');
}

// Run the test
runScenarios().catch(console.error);