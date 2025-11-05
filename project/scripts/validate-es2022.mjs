#!/usr/bin/env node

/**
 * Script de Validação de Features ES2022
 * Verifica se arquivos .mjs usam features ES2022 corretamente
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const TESTS_DIR = 'tests';

/**
 * Features ES2022 obrigatórias em arquivos .mjs
 */
const ES2022_FEATURES = {
  'top-level-await': /(?<!\s+)await\s+[^;]+/m,
  'optional-chaining': /\?\.+/,
  'nullish-coalescing': /\?\?/,
  'private-fields': /#\w+\s*=/,
  'object-hasown': /Object\.hasOwn\(/,
  'array-at': /\.at\(/,
  'logical-assignment': /\?\?=/,
  'numeric-separators': /\d_\d+/
};

/**
 * Valida features ES2022 em um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object} Resultado da validação
 */
function validateES2022Features(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const result = {
      file: filePath,
      features: {},
      hasES2022: false,
      issues: []
    };
    
    // Verificar cada feature ES2022
    for (const [feature, regex] of Object.entries(ES2022_FEATURES)) {
      const matches = content.match(regex);
      if (matches) {
        result.features[feature] = matches.length;
        result.hasES2022 = true;
      }
    }
    
    // Verificar se arquivo .mjs tem features ES2022 (exceto tipos)
    if (extname(filePath) === '.mjs' && !filePath.includes('.types.') && !result.hasES2022) {
      result.issues.push('Arquivo .mjs sem features ES2022 detectadas');
    }
    
    // Verificar uso de features legadas que poderiam ser modernizadas
    const legacyPatterns = [
      { pattern: /&& \w+ && \w+/, suggestion: 'Considere usar optional chaining (?.)' },
      { pattern: /\|\| \w+/, suggestion: 'Considere usar nullish coalescing (??)' },
      { pattern: /hasOwnProperty\(/, suggestion: 'Use Object.hasOwn() em vez de hasOwnProperty()' }
    ];
    
    for (const { pattern, suggestion } of legacyPatterns) {
      if (pattern.test(content)) {
        result.issues.push(`Padrão legado detectado: ${suggestion}`);
      }
    }
    
    return result;
  } catch (error) {
    return {
      file: filePath,
      error: error.message,
      features: {},
      hasES2022: false,
      issues: []
    };
  }
}

/**
 * Valida todos os arquivos .mjs em um diretório
 * @param {string} dir - Diretório para validar
 * @returns {Array} Array de resultados
 */
function validateDirectory(dir) {
  const results = [];
  
  function walkDir(currentDir) {
    try {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile() && extname(item) === '.mjs') {
          const result = validateES2022Features(fullPath);
          results.push(result);
        }
      }
    } catch (error) {
      // Ignorar erros de acesso
    }
  }
  
  walkDir(dir);
  return results;
}

/**
 * Gera relatório de features ES2022
 * @param {Array} results - Resultados da validação
 * @returns {Object} Estatísticas
 */
function generateReport(results) {
  const stats = {
    totalFiles: results.length,
    filesWithES2022: 0,
    filesWithoutES2022: 0,
    featureUsage: {},
    totalIssues: 0,
    errors: 0
  };
  
  // Inicializar contagem de features
  for (const feature of Object.keys(ES2022_FEATURES)) {
    stats.featureUsage[feature] = 0;
  }
  
  for (const result of results) {
    if (result.error) {
      stats.errors++;
      continue;
    }
    
    if (result.hasES2022) {
      stats.filesWithES2022++;
    } else {
      stats.filesWithoutES2022++;
    }
    
    stats.totalIssues += result.issues.length;
    
    // Contar uso de features
    for (const [feature, count] of Object.entries(result.features)) {
      stats.featureUsage[feature] += count;
    }
  }
  
  return stats;
}

function main() {
  console.log('🚀 Validando features ES2022...\n');
  
  // Validar diretórios
  const srcResults = validateDirectory(SRC_DIR);
  const testsResults = validateDirectory(TESTS_DIR);
  const allResults = [...srcResults, ...testsResults];
  
  // Gerar relatório
  const stats = generateReport(allResults);
  
  // Exibir estatísticas
  console.log('📊 Estatísticas ES2022:');
  console.log(`Total de arquivos .mjs: ${stats.totalFiles}`);
  console.log(`Arquivos com ES2022: ${stats.filesWithES2022}`);
  console.log(`Arquivos sem ES2022: ${stats.filesWithoutES2022}`);
  console.log(`Total de issues: ${stats.totalIssues}`);
  console.log(`Erros de leitura: ${stats.errors}`);
  
  console.log('\n📈 Uso de Features ES2022:');
  for (const [feature, count] of Object.entries(stats.featureUsage)) {
    if (count > 0) {
      console.log(`  ${feature}: ${count} ocorrências`);
    }
  }
  
  // Exibir arquivos sem ES2022
  const filesWithoutES2022 = allResults.filter(r => !r.hasES2022 && !r.error);
  if (filesWithoutES2022.length > 0) {
    console.log('\n⚠️  Arquivos .mjs sem features ES2022:');
    filesWithoutES2022.forEach(result => {
      console.log(`  ${result.file}`);
    });
  }
  
  // Exibir issues
  const filesWithIssues = allResults.filter(r => r.issues.length > 0);
  if (filesWithIssues.length > 0) {
    console.log('\n💡 Sugestões de Modernização:');
    filesWithIssues.forEach(result => {
      console.log(`\n📄 ${result.file}:`);
      result.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    });
  }
  
  // Exibir erros
  const errors = allResults.filter(r => r.error);
  if (errors.length > 0) {
    console.log('\n❌ Erros:');
    errors.forEach(result => {
      console.log(`  ${result.file}: ${result.error}`);
    });
  }
  
  // Verificar se validação passou
  const hasErrors = stats.errors > 0;
  const hasTooManyFilesWithoutES2022 = stats.filesWithoutES2022 > stats.totalFiles * 0.3; // Mais de 30% sem ES2022
  
  if (hasErrors) {
    console.log('\n❌ Validação falhou devido a erros de leitura!');
    process.exit(1);
  } else if (hasTooManyFilesWithoutES2022) {
    console.log('\n⚠️  Muitos arquivos .mjs sem features ES2022!');
    console.log('💡 Considere adicionar features ES2022 ou usar .cjs para compatibilidade.');
    process.exit(1);
  } else {
    console.log('\n✅ Validação ES2022 concluída com sucesso!');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}