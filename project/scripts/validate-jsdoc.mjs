#!/usr/bin/env node

/**
 * Script de Validação de JSDob
 * Verifica se todos os exports públicos têm JSDob completo
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';

/**
 * Padrões JSDob obrigatórios
 */
const JSDOC_PATTERNS = {
  function: /\/\*\*\s*\*[^*]*\*+(?:[^*][^*]*\*+)*\/\s*(?:function|const\s+\w+\s*=|async\s+function|export\s+(?:async\s+)?function|export\s+const\s+\w+\s*=)/,
  class: /\/\*\*\s*\*[^*]*\*+(?:[^*][^*]*\*+)*\/\s*class\s+\w+/,
  variable: /\/\*\*\s*\*[^*]*\*+(?:[^*][^*]*\*+)*\/\s*(?:export\s+)?(?:const|let|var)\s+\w+/,
  typedef: /\/\*\*\s*\*[^*]*\*+(?:[^*][^*]*\*+)*\/\s*\/\*\*\s*@typedef/
};

/**
 * Padrões de export
 */
const EXPORT_PATTERNS = {
  named: /export\s+(?:const|let|var|function|class)\s+(\w+)/,
  default: /export\s+default\s+(?:class|function|\w+)/,
  moduleExports: /module\.exports\s*=\s*(\{[^}]+\}|\w+)/,
  moduleExportsProperty: /module\.exports\.(\w+)\s*=/,
  exportsProperty: /exports\.(\w+)\s*=/
};

/**
 * Extrai exports de um arquivo
 * @param {string} content - Conteúdo do arquivo
 * @returns {Array} Array de exports encontrados
 */
function extractExports(content) {
  const exports = [];
  
  // Export ESM named
  const namedMatches = content.matchAll(EXPORT_PATTERNS.named);
  for (const match of namedMatches) {
    exports.push({ name: match[1], type: 'named', line: getLineNumber(content, match.index) });
  }
  
  // Export ESM default
  const defaultMatch = content.match(EXPORT_PATTERNS.default);
  if (defaultMatch) {
    exports.push({ name: 'default', type: 'default', line: getLineNumber(content, defaultMatch.index) });
  }
  
  // Module exports CJS
  const moduleExportsMatch = content.match(EXPORT_PATTERNS.moduleExports);
  if (moduleExportsMatch) {
    if (moduleExportsMatch[1].startsWith('{')) {
      // Multiple exports: module.exports = { a, b, c }
      const innerContent = moduleExportsMatch[1];
      const namedExports = innerContent.match(/(\w+)/g);
      for (const name of namedExports) {
        exports.push({ name, type: 'module-exports', line: getLineNumber(content, moduleExportsMatch.index) });
      }
    } else {
      // Single export: module.exports = MyClass
      exports.push({ name: moduleExportsMatch[1], type: 'module-exports', line: getLineNumber(content, moduleExportsMatch.index) });
    }
  }
  
  // Module exports property
  const modulePropMatches = content.matchAll(EXPORT_PATTERNS.moduleExportsProperty);
  for (const match of modulePropMatches) {
    exports.push({ name: match[1], type: 'module-exports-property', line: getLineNumber(content, match.index) });
  }
  
  // Exports property
  const exportsPropMatches = content.matchAll(EXPORT_PATTERNS.exportsProperty);
  for (const match of exportsPropMatches) {
    exports.push({ name: match[1], type: 'exports-property', line: getLineNumber(content, match.index) });
  }
  
  return exports;
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
 * Verifica se um export tem JSDob
 * @param {string} content - Conteúdo do arquivo
 * @param {Object} exportInfo - Informações do export
 * @returns {Object} Resultado da verificação
 */
function checkJSDoc(content, exportInfo) {
  const lines = content.split('\n');
  const exportLine = exportInfo.line - 1; // 0-based
  
  // Procurar JSDob antes do export
  let jsDocStart = -1;
  let jsDocEnd = -1;
  
  for (let i = exportLine - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    if (line.startsWith('*/')) {
      jsDocEnd = i;
      continue;
    }
    
    if (line.startsWith('/**')) {
      jsDocStart = i;
      break;
    }
    
    // Se encontrar linha não vazia que não é comentário, parar
    if (line && !line.startsWith('*') && !line.startsWith('//')) {
      break;
    }
  }
  
  const hasJSDoc = jsDocStart !== -1 && jsDocEnd !== -1;
  let jsDocContent = '';
  
  if (hasJSDoc) {
    jsDocContent = lines.slice(jsDocStart, jsDocEnd + 1).join('\n');
  }
  
  return {
    hasJSDoc,
    jsDocContent,
    jsDocLines: hasJSDoc ? jsDocEnd - jsDocStart + 1 : 0
  };
}

/**
 * Valida JSDob em um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object} Resultado da validação
 */
function validateJSDoc(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const exports = extractExports(content);
    const result = {
      file: filePath,
      totalExports: exports.length,
      exportsWithJSDoc: 0,
      exportsWithoutJSDoc: [],
      issues: []
    };
    
    for (const exportInfo of exports) {
      const jsDocCheck = checkJSDoc(content, exportInfo);
      
      if (jsDocCheck.hasJSDoc) {
        result.exportsWithJSDoc++;
        
        // Verificar qualidade do JSDob
        if (!jsDocCheck.jsDocContent.includes('@param') && exportInfo.type !== 'module-exports') {
          result.issues.push({
            export: exportInfo.name,
            line: exportInfo.line,
            issue: 'JSDob sem @param para funções com parâmetros'
          });
        }
        
        if (!jsDocCheck.jsDocContent.includes('@returns') && 
            (exportInfo.type.includes('function') || content.includes('async'))) {
          result.issues.push({
            export: exportInfo.name,
            line: exportInfo.line,
            issue: 'JSDob sem @returns para funções'
          });
        }
        
        if (!jsDocCheck.jsDocContent.includes('@typedef') && 
            jsDocCheck.jsDocContent.includes('@type')) {
          result.issues.push({
            export: exportInfo.name,
            line: exportInfo.line,
            issue: '@type usado sem @typedef'
          });
        }
      } else {
        result.exportsWithoutJSDoc.push({
          name: exportInfo.name,
          type: exportInfo.type,
          line: exportInfo.line
        });
      }
    }
    
    return result;
  } catch (error) {
    return {
      file: filePath,
      error: error.message,
      totalExports: 0,
      exportsWithJSDoc: 0,
      exportsWithoutJSDoc: [],
      issues: []
    };
  }
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
          const result = validateJSDoc(fullPath);
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

function main() {
  console.log('📝 Validando JSDob em exports públicos...\n');
  
  // Validar diretório src
  const results = validateDirectory(SRC_DIR);
  
  // Estatísticas
  const stats = {
    totalFiles: results.length,
    totalExports: 0,
    exportsWithJSDoc: 0,
    exportsWithoutJSDoc: 0,
    totalIssues: 0,
    errors: 0
  };
  

  const allExportsWithoutJSDoc = [];
  const allIssues = [];
  
  for (const result of results) {
    if (result.error) {
      stats.errors++;
      continue;
    }
    
    stats.totalExports += result.totalExports;
    stats.exportsWithJSDoc += result.exportsWithJSDoc;
    stats.exportsWithoutJSDoc += result.exportsWithoutJSDoc.length;
    stats.totalIssues += result.issues.length;
    
    allExportsWithoutJSDoc.push(...result.exportsWithoutJSDoc);
    allIssues.push(...result.issues);
  }
  
  // Exibir estatísticas
  console.log('📊 Estatísticas JSDob:');
  console.log(`Total de arquivos: ${stats.totalFiles}`);
  console.log(`Total de exports: ${stats.totalExports}`);
  console.log(`Exports com JSDob: ${stats.exportsWithJSDoc}`);
  console.log(`Exports sem JSDob: ${stats.exportsWithoutJSDoc}`);
  console.log(`Issues de qualidade: ${stats.totalIssues}`);
  console.log(`Erros de leitura: ${stats.errors}`);
  
  const coverage = stats.totalExports > 0 ? (stats.exportsWithJSDoc / stats.totalExports * 100).toFixed(1) : 0;
  console.log(`Coverage: ${coverage}%`);
  
  // Exibir exports sem JSDob
  if (allExportsWithoutJSDoc.length > 0) {
    console.log('\n❌ Exports sem JSDob:');
    allExportsWithoutJSDoc.forEach(exp => {
      console.log(`  ${exp.name} (${exp.type}) - linha ${exp.line}`);
    });
  }
  
  // Exibir issues de qualidade
  if (allIssues.length > 0) {
    console.log('\n💡 Issues de Qualidade JSDob:');
    allIssues.forEach(issue => {
      console.log(`  ${issue.export} (linha ${issue.line}): ${issue.issue}`);
    });
  }
  
  // Verificar se validação passou
  const hasErrors = stats.errors > 0;
  const hasExportsWithoutJSDoc = stats.exportsWithoutJSDoc > 0;
  const hasLowCoverage = coverage < 80;
  
  if (hasErrors) {
    console.log('\n❌ Validação falhou devido a erros de leitura!');
    process.exit(1);
  } else if (hasExportsWithoutJSDob) {
    console.log('\n❌ Validação falhou! Existem exports sem JSDob.');
    console.log('💡 Adicione JSDob completo em todos os exports públicos.');
    process.exit(1);
  } else if (hasLowCoverage) {
    console.log('\n⚠️  Coverage de JSDob abaixo de 80%!');
    console.log('💡 Melhore a documentação dos exports.');
    process.exit(1);
  } else {
    console.log('\n✅ Validação JSDob concluída com sucesso!');
    console.log('🎉 Todos os exports públicos têm JSDob completo!');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}