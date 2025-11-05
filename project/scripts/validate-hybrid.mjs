#!/usr/bin/env node

/**
 * Script de Validação de Compatibilidade Híbrida
 * Verifica compatibilidade entre módulos CJS e ESM no projeto
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src';

/**
 * Padrões de importação/exportação
 */
const IMPORT_EXPORT_PATTERNS = {
  // ESM imports
  esmImport: /import\s+(?:(?:\*\s+as\s+\w+)|(?:\w+)|(?:\{[^}]+\}))\s+from\s+['"]([^'"]+)['"]/g,
  esmDynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // CJS requires
  cjsRequire: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  
  // ESM exports
  esmExport: /export\s+(?:(?:const|let|var|function|class)\s+\w+|(?:\{[^}]+\})|(?:default))/g,
  
  // CJS exports
  cjsModuleExports: /module\.exports\s*=/g,
  cjsExportsProperty: /exports\.\w+\s*=/g,
  
  // Conditional requires
  conditionalRequire: /if\s*\([^)]+\)\s*\{[^}]*require\s*\([^)]+\)/g
};

/**
 * Analisa um arquivo para detectar padrões de importação/exportação
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object} Resultado da análise
 */
function analyzeFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const ext = extname(filePath);
    const isESM = ext === '.mjs';
    const isCJS = ext === '.cjs' || ext === '.js';
    
    const result = {
      file: filePath,
      extension: ext,
      moduleType: isESM ? 'ESM' : isCJS ? 'CJS' : 'Unknown',
      imports: [],
      exports: [],
      issues: [],
      compatibility: 'OK'
    };
    
    // Detectar imports
    let match;
    
    // ESM imports
    IMPORT_EXPORT_PATTERNS.esmImport.lastIndex = 0;
    while ((match = IMPORT_EXPORT_PATTERNS.esmImport.exec(content)) !== null) {
      result.imports.push({
        type: 'ESM',
        source: match[1],
        line: getLineNumber(content, match.index),
        raw: match[0]
      });
    }
    
    // Dynamic imports
    IMPORT_EXPORT_PATTERNS.esmDynamicImport.lastIndex = 0;
    while ((match = IMPORT_EXPORT_PATTERNS.esmDynamicImport.exec(content)) !== null) {
      result.imports.push({
        type: 'Dynamic',
        source: match[1],
        line: getLineNumber(content, match.index),
        raw: match[0]
      });
    }
    
    // CJS requires
    IMPORT_EXPORT_PATTERNS.cjsRequire.lastIndex = 0;
    while ((match = IMPORT_EXPORT_PATTERNS.cjsRequire.exec(content)) !== null) {
      result.imports.push({
        type: 'CJS',
        source: match[1],
        line: getLineNumber(content, match.index),
        raw: match[0]
      });
    }
    
    // Detectar exports
    if (IMPORT_EXPORT_PATTERNS.esmExport.test(content)) {
      result.exports.push('ESM');
    }
    
    if (IMPORT_EXPORT_PATTERNS.cjsModuleExports.test(content)) {
      result.exports.push('CJS Module');
    }
    
    if (IMPORT_EXPORT_PATTERNS.cjsExportsProperty.test(content)) {
      result.exports.push('CJS Property');
    }
    
    // Verificar compatibilidade
    result.issues = checkCompatibility(result);
    if (result.issues.length > 0) {
      result.compatibility = 'ISSUES';
    }
    
    return result;
  } catch (error) {
    return {
      file: filePath,
      error: error.message,
      imports: [],
      exports: [],
      issues: [],
      compatibility: 'ERROR'
    };
  }
}

/**
 * Verifica problemas de compatibilidade
 * @param {Object} analysis - Resultado da análise do arquivo
 * @returns {Array} Array de issues encontrados
 */
function checkCompatibility(analysis) {
  const issues = [];
  
  // ESM files não devem usar require()
  if (analysis.moduleType === 'ESM') {
    const cjsImports = analysis.imports.filter(imp => imp.type === 'CJS');
    for (const imp of cjsImports) {
      issues.push({
        type: 'ESM_USING_CJS',
        severity: 'ERROR',
        line: imp.line,
        message: `Arquivo ESM usando require(): ${imp.raw}`,
        suggestion: 'Use import statement instead'
      });
    }
  }
  
  // CJS files não devem usar import (exceto dynamic import)
  if (analysis.moduleType === 'CJS') {
    const esmImports = analysis.imports.filter(imp => imp.type === 'ESM');
    for (const imp of esmImports) {
      issues.push({
        type: 'CJS_USING_ESM',
        severity: 'ERROR',
        line: imp.line,
        message: `Arquivo CJS usando import: ${imp.raw}`,
        suggestion: 'Use require() instead'
      });
    }
  }
  
  // Verificar extensões em imports
  for (const imp of analysis.imports) {
    if (imp.type !== 'Dynamic' && !imp.source.includes('.')) {
      // Import sem extensão - verificar se é módulo interno
      if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
        issues.push({
          type: 'MISSING_EXTENSION',
          severity: 'WARNING',
          line: imp.line,
          message: `Import sem extensão: ${imp.source}`,
          suggestion: 'Adicione extensão explícita (.js, .cjs, .mjs)'
        });
      }
    }
  }
  
  // Verificar混合 exports
  if (analysis.exports.includes('ESM') && analysis.exports.filter(e => e.includes('CJS')).length > 0) {
    issues.push({
      type: 'MIXED_EXPORTS',
      severity: 'ERROR',
      line: 1,
      message: 'Arquivo usando exports ESM e CJS simultaneamente',
      suggestion: 'Use apenas um sistema de exports por arquivo'
    });
  }
  
  return issues;
}

/**
 * Obtém número da linha de um índice no conteúdo
 * @param {string} content - Conteúdo do arquivo
 * @param {number} index - Índice do caractere
 * @returns {number} Número da linha
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Valida todos os arquivos em um diretório
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
        } else if (stat.isFile() && ['.js', '.cjs', '.mjs'].includes(extname(item))) {
          const result = analyzeFile(fullPath);
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
 * Gera relatório de compatibilidade
 * @param {Array} results - Resultados da validação
 */
function generateReport(results) {
  console.log('🔀 Relatório de Compatibilidade Híbrida CJS/ESM\n');
  
  // Estatísticas
  const stats = {
    totalFiles: results.length,
    esmFiles: 0,
    cjsFiles: 0,
    filesWithIssues: 0,
    totalIssues: 0,
    errors: 0,
    warnings: 0
  };
  
  const issuesByType = {};
  const filesWithIssues = [];
  
  for (const result of results) {
    if (result.error) {
      stats.errors++;
      continue;
    }
    
    if (result.moduleType === 'ESM') stats.esmFiles++;
    if (result.moduleType === 'CJS') stats.cjsFiles++;
    
    if (result.issues.length > 0) {
      stats.filesWithIssues++;
      stats.totalIssues += result.issues.length;
      filesWithIssues.push(result);
      
      for (const issue of result.issues) {
        const issueType = issue.type;
        if (!issuesByType[issueType]) issuesByType[issueType] = [];
        issuesByType[issueType].push(issue);
        
        if (issue.severity === 'ERROR') stats.errors++;
        if (issue.severity === 'WARNING') stats.warnings++;
      }
    }
  }
  
  // Exibir estatísticas
  console.log('📊 Estatísticas:');
  console.log(`Total de arquivos: ${stats.totalFiles}`);
  console.log(`Arquivos ESM (.mjs): ${stats.esmFiles}`);
  console.log(`Arquivos CJS (.js/.cjs): ${stats.cjsFiles}`);
  console.log(`Arquivos com issues: ${stats.filesWithIssues}`);
  console.log(`Total de issues: ${stats.totalIssues}`);
  console.log(`Erros: ${stats.errors}`);
  console.log(`Warnings: ${stats.warnings}`);
  
  // Exibir issues por tipo
  if (Object.keys(issuesByType).length > 0) {
    console.log('\n🔍 Issues por Tipo:');
    for (const [type, issues] of Object.entries(issuesByType)) {
      console.log(`\n${type}: ${issues.length} ocorrências`);
      for (const issue of issues.slice(0, 5)) { // Limitar a 5 exemplos
        const relativePath = relative(process.cwd(), issue.file || filesWithIssues.find(f => f.issues.includes(issue))?.file || '');
        console.log(`  ${relativePath}:${issue.line} - ${issue.message}`);
      }
      if (issues.length > 5) {
        console.log(`  ... e mais ${issues.length - 5} ocorrências`);
      }
    }
  }
  
  // Exibir arquivos com problemas
  if (filesWithIssues.length > 0) {
    console.log('\n📁 Arquivos com Issues:');
    for (const result of filesWithIssues) {
      const relativePath = relative(process.cwd(), result.file);
      console.log(`\n${relativePath} (${result.moduleType}):`);
      for (const issue of result.issues) {
        const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
        console.log(`  ${icon} Linha ${issue.line}: ${issue.message}`);
        if (issue.suggestion) {
          console.log(`    💡 ${issue.suggestion}`);
        }
      }
    }
  }
  
  // Verificar se validação passou
  const hasErrors = stats.errors > 0;
  const hasWarnings = stats.warnings > 0;
  
  if (hasErrors) {
    console.log('\n❌ Validação falhou! Existem erros de compatibilidade.');
    console.log('💡 Corrija os erros antes de continuar.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Validação concluída com warnings.');
    console.log('💡 Considere corrigir os warnings para melhor compatibilidade.');
    process.exit(0);
  } else {
    console.log('\n✅ Validação de compatibilidade concluída com sucesso!');
    console.log('🎉 Todos os arquivos são compatíveis com o sistema híbrido!');
    process.exit(0);
  }
}

function main() {
  console.log('🔀 Validando compatibilidade híbrida CJS/ESM...\n');
  
  // Validar diretório src
  const results = validateDirectory(SRC_DIR);
  
  // Gerar relatório
  generateReport(results);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}