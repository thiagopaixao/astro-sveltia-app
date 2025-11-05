#!/usr/bin/env node

/**
 * Script de Validação de Extensões ES2022
 * Verifica se os arquivos usam as extensões corretas conforme a estratégia híbrida
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const TESTS_DIR = 'tests';

/**
 * Valida extensões de arquivos em um diretório
 * @param {string} dir - Diretório para validar
 * @param {Object} rules - Regras de validação
 * @returns {Array} Array de erros encontrados
 */
function validateExtensions(dir, rules) {
  const errors = [];
  
  function walkDir(currentDir) {
    try {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = extname(item);
          const fileName = item;
          
          // Validar regras específicas
          if (rules.testFiles && fileName.includes('.test.') && ext !== '.mjs') {
            errors.push(`❌ Teste deve usar .test.mjs: ${fullPath}`);
          }
          
          if (rules.esmFiles && ext === '.mjs' && !rules.allowedMjs.includes(fileName)) {
            // Verificar se usa features ES2022
            try {
              const content = readFileSync(fullPath, 'utf8');
              const hasES2022 = /await\s*\n|[\?\?\.]|\?\?|Object\.hasOwn|#\w+\s*=/.test(content);
              if (!hasES2022 && !fileName.includes('.types.')) {
                errors.push(`⚠️  Arquivo .mjs sem features ES2022: ${fullPath}`);
              }
            } catch (error) {
              errors.push(`❌ Erro ao ler arquivo ${fullPath}: ${error.message}`);
            }
          }
          
          if (rules.cjsFiles && ext === '.cjs' && !rules.allowedCjs.includes(fileName)) {
            // Verificar se realmente precisa ser CJS
            try {
              const content = readFileSync(fullPath, 'utf8');
              const hasRequire = /require\s*\(/.test(content);
              const hasModuleExports = /module\.exports/.test(content);
              if (!hasRequire && !hasModuleExports) {
                errors.push(`⚠️  Arquivo .cjs poderia ser .mjs: ${fullPath}`);
              }
            } catch (error) {
              errors.push(`❌ Erro ao ler arquivo ${fullPath}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`❌ Erro ao acessar diretório ${currentDir}: ${error.message}`);
    }
  }
  
  walkDir(dir);
  return errors;
}

/**
 * Valida estrutura de diretórios
 * @returns {Array} Array de erros encontrados
 */
function validateStructure() {
  const errors = [];
  
  // Verificar se diretórios principais existem
  const requiredDirs = [
    'src/core',
    'src/services',
    'src/utils',
    'src/config',
    'tests/unit',
    'tests/integration'
  ];
  
  for (const dir of requiredDirs) {
    try {
      statSync(dir);
    } catch {
      errors.push(`❌ Diretório obrigatório não encontrado: ${dir}`);
    }
  }
  
  return errors;
}

/**
 * Conta arquivos por extensão
 * @param {string} dir - Diretório para analisar
 * @returns {Object} Contagem por extensão
 */
function countExtensions(dir) {
  const counts = { '.js': 0, '.cjs': 0, '.mjs': 0, '.test.mjs': 0, other: 0 };
  
  function walkDir(currentDir) {
    try {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = extname(item);
          if (ext in counts) {
            counts[ext]++;
          } else {
            counts.other++;
          }
        }
      }
    } catch (error) {
      // Ignorar erros de acesso
    }
  }
  
  walkDir(dir);
  return counts;
}

function main() {
  console.log('🔍 Validando extensões de arquivos ES2022...\n');
  
  // Regras de validação
  const srcRules = {
    testFiles: false,
    esmFiles: true,
    cjsFiles: true,
    allowedMjs: [], // Todos os .mjs são permitidos em src
    allowedCjs: [] // Todos os .cjs são permitidos em src
  };
  
  const testsRules = {
    testFiles: true,
    esmFiles: true,
    cjsFiles: false,
    allowedMjs: [], // Todos os .test.mjs são permitidos
    allowedCjs: [] // Nenhum .cjs em testes
  };
  
  // Validar estrutura
  const structureErrors = validateStructure();
  
  // Validar extensões
  const srcErrors = validateExtensions(SRC_DIR, srcRules);
  const testsErrors = validateExtensions(TESTS_DIR, testsRules);
  
  // Contar extensões
  const srcCounts = countExtensions(SRC_DIR);
  const testsCounts = countExtensions(TESTS_DIR);
  
  // Exibir resultados
  console.log('📊 Estatísticas de Arquivos:');
  console.log(`src/:`);
  console.log(`  .js (legado): ${srcCounts['.js']}`);
  console.log(`  .cjs (novo CJS): ${srcCounts['.cjs']}`);
  console.log(`  .mjs (ESM): ${srcCounts['.mjs']}`);
  console.log(`tests/:`);
  console.log(`  .test.mjs: ${testsCounts['.test.mjs']}`);
  console.log(`  .mjs: ${testsCounts['.mjs']}`);
  console.log(`  .cjs: ${testsCounts['.cjs']}`);
  console.log(`  .js: ${testsCounts['.js']}`);
  
  // Exibir erros
  const allErrors = [...structureErrors, ...srcErrors, ...testsErrors];
  
  if (allErrors.length === 0) {
    console.log('\n✅ Todas as extensões estão corretas!');
    console.log('✅ Estrutura de diretórios válida!');
    process.exit(0);
  } else {
    console.log(`\n❌ Encontrados ${allErrors.length} problemas:`);
    allErrors.forEach(error => console.log(error));
    
    console.log('\n💡 Sugestões:');
    console.log('- Testes devem usar .test.mjs');
    console.log('- Código novo ESM deve usar .mjs');
    console.log('- Código CJS deve usar .cjs');
    console.log('- Legado mantido como .js');
    
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}