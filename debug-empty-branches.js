#!/usr/bin/env node

/**
 * Debug Empty Branch List Issue
 * Tests the complete flow to identify why branches are not showing
 */

// Import the actual git handlers
const { GitHandlers } = require('./src/ipc/git.js');

async function testBackendDirectly() {
    console.log('=== TESTING BACKEND DIRECTLY ===');
    
    try {
        // Create git handlers instance
        const gitHandlers = new GitHandlers();
        
        // Mock database manager
        gitHandlers.dbManager = {
            getProjectPath: async (projectId) => {
                console.log('📂 Mock: Getting project path for projectId:', projectId);
                // Return the test-repo path
                return '/workspaces/astro-sveltia-app/test-repo';
            }
        };
        
        // Mock logger
        gitHandlers.logger = {
            info: (msg, ...args) => console.log('ℹ️', msg, ...args),
            warn: (msg, ...args) => console.log('⚠️', msg, ...args),
            error: (msg, ...args) => console.log('❌', msg, ...args)
        };
        
        console.log('🔧 Testing gitListBranches directly...');
        
        // Test with a mock project ID
        const testProjectId = 'test-project-123';
        const result = await gitHandlers.gitListBranches('/workspaces/astro-sveltia-app/test-repo');
        
        console.log('📥 Direct gitListBranches result:', JSON.stringify(result, null, 2));
        
        if (result && result.branches && result.branches.length > 0) {
            console.log('✅ Backend working correctly - found', result.branches.length, 'branches');
            result.branches.forEach((branch, i) => {
                console.log(`  ${i + 1}. ${branch.name} (current: ${branch.isCurrent})`);
            });
            return true;
        } else {
            console.log('❌ Backend returned empty or invalid result');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error testing backend directly:', error);
        return false;
    }
}

async function testIPCHandler() {
    console.log('\n=== TESTING IPC HANDLER ===');
    
    try {
        // Create git handlers instance
        const gitHandlers = new GitHandlers();
        
        // Mock database manager
        gitHandlers.dbManager = {
            getProjectPath: async (projectId) => {
                console.log('📂 IPC Mock: Getting project path for projectId:', projectId);
                return '/workspaces/astro-sveltia-app/test-repo';
            }
        };
        
        // Mock logger
        gitHandlers.logger = {
            info: (msg, ...args) => console.log('ℹ️', msg, ...args),
            warn: (msg, ...args) => console.log('⚠️', msg, ...args),
            error: (msg, ...args) => console.log('❌', msg, ...args)
        };
        
        // Mock IPC event
        const mockEvent = {
            sender: {
                id: 1
            }
        };
        
        console.log('🔧 Testing git:list-branches IPC handler...');
        
        // Test the actual IPC handler
        const result = await gitHandlers.handlers['git:list-branches'](mockEvent, 'test-project-123');
        
        console.log('📥 IPC handler result:', JSON.stringify(result, null, 2));
        
        if (result && result.success && result.branches && result.branches.length > 0) {
            console.log('✅ IPC handler working correctly - found', result.branches.length, 'branches');
            result.branches.forEach((branch, i) => {
                console.log(`  ${i + 1}. ${branch.name} (current: ${branch.isCurrent})`);
            });
            return true;
        } else {
            console.log('❌ IPC handler returned empty or invalid result');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error testing IPC handler:', error);
        return false;
    }
}

async function testPreloadExposure() {
    console.log('\n=== TESTING PRELOAD EXPOSURE ===');
    
    try {
        // Check if preload.js properly exposes listBranches
        const fs = require('fs');
        const preloadContent = fs.readFileSync('./preload.js', 'utf8');
        
        console.log('🔍 Checking if listBranches is exposed in preload.js...');
        
        if (preloadContent.includes('listBranches')) {
            console.log('✅ listBranches found in preload.js');
            
            // Check the exact exposure pattern
            if (preloadContent.includes('listBranches:')) {
                console.log('✅ listBranches is properly exposed');
                return true;
            } else {
                console.log('⚠️ listBranches found but may not be properly exposed');
                return false;
            }
        } else {
            console.log('❌ listBranches not found in preload.js');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error checking preload.js:', error);
        return false;
    }
}

async function runAllTests() {
    console.log('🧪 DEBUGGING EMPTY BRANCH LIST ISSUE');
    console.log('==========================================\n');
    
    const backendWorks = await testBackendDirectly();
    const ipcWorks = await testIPCHandler();
    const preloadWorks = await testPreloadExposure();
    
    console.log('\n=== ANALYSIS ===');
    console.log('Backend gitListBranches():', backendWorks ? '✅ WORKING' : '❌ BROKEN');
    console.log('IPC handler:', ipcWorks ? '✅ WORKING' : '❌ BROKEN');
    console.log('Preload exposure:', preloadWorks ? '✅ WORKING' : '❌ BROKEN');
    
    if (backendWorks && ipcWorks && preloadWorks) {
        console.log('\n🎯 All backend components working - issue likely in frontend');
        console.log('Possible frontend issues:');
        console.log('- sessionStorage missing currentProjectId');
        console.log('- Alpine.js reactivity not updating template');
        console.log('- Modal opening before project context is set');
    } else {
        console.log('\n🔧 Backend component needs fixing');
    }
}

// Run all tests
runAllTests().catch(console.error);