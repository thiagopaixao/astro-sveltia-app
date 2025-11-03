# Garantia de Branch Preview

## Descrição da Implementação

Foi implementada uma nova funcionalidade para garantir que a branch `preview` exista nos projetos, criando-a automaticamente quando necessário.

## Comportamento

### Fluxo de Verificação

1. **Verificação Local**: Verifica se a branch `preview` existe localmente
2. **Verificação Remota**: Se não existir localmente, verifica se existe no repositório remoto
3. **Criação Automática**: Se não existir em nenhum lugar, cria a branch a partir de `main` (ou `master` como fallback)

### Detalhes da Implementação

#### Nova Função: `gitEnsurePreviewBranch(dir)`

- **Localização**: `main.js` (linha ~863)
- **Parâmetro**: `dir` - caminho do repositório
- **Retorno**: Objeto com informações sobre a operação

#### Fluxo de Criação

1. **Seleção da Branch Base**:
   - Tenta selecionar `main` primeiro
   - Se `main` não existir, tenta `master`
   - Se nenhuma existir, retorna erro

2. **Verificação de Workspace**:
   - Verifica se há arquivos não commitados
   - Informa ao usuário sobre o estado do workspace

3. **Criação da Branch**:
   - Cria branch `preview` localmente
   - Automaticamente seleciona a nova branch

4. **Push Opcional**:
   - Se houver repositório remoto configurado
   - Se houver autenticação GitHub configurada
   - Tenta fazer push da branch para o remoto
   - Em caso de falha, informa que a branch foi criada localmente

## Pontos de Integração

### Telas Afetadas

1. **`renderer/create.html`**:
   - Etapa 2: "Verificando e garantindo branch preview..."
   - Usa `gitEnsurePreviewBranch()` em vez de `gitCheckout()`

2. **`renderer/open.html`**:
   - Etapa 2: "Verificando e garantindo branch preview..."
   - Usa `gitEnsurePreviewBranch()` em vez de `gitCheckout()`

### Funções Modificadas

1. **`start-project-creation`** (main.js):
   - Substitui `gitCheckout(repoDirPath, 'preview')` por `gitEnsurePreviewBranch(repoDirPath)`

2. **`open-project-only-preview-and-server`** (main.js):
   - Substitui `gitCheckout(repoDirPath, 'preview')` por `gitEnsurePreviewBranch(repoDirPath)`

## Logs e Feedback ao Usuário

### Mensagens Informativas

- `🔍 Verificando branch 'preview' em {dir}...`
- `📂 Branch 'preview' local: ✅/❌`
- `🌐 Branch 'preview' remota: ✅/❌`
- `📋 Branches locais encontradas: {lista}`
- `📋 Branches remotas encontradas: {lista}`

### Mensagens de Criação

- `🌿 Criando branch 'preview' a partir de 'main'...`
- `✅ Branch 'preview' criada a partir de '{baseBranch}' com sucesso`
- `🚀 Tentando publicar branch 'preview' para o repositório remoto...`

### Mensagens de Erro e Sugestões

- `❌ Branch 'preview' não encontrada localmente ou remotamente`
- `⚠️ Não foi possível publicar branch 'preview' para o repositório remoto`
- `💡 A branch 'preview' foi criada localmente e pode ser publicada manualmente depois`

## Tratamento de Erros

### Casos Tratados

1. **Branch Base Ausente**: Nem `main` nem `master` encontrada
2. **Autenticação GitHub**: Token não configurado
3. **Conexão**: Problemas de rede
4. **Workspace Sujo**: Arquivos não commitados
5. **Push Falhou**: Permissões ou configuração de remote

### Sugestões Automáticas

- Configurar autenticação GitHub
- Verificar conexão com internet
- Verificar estrutura do repositório
- Comandos manuais para publicação

## Testes Recomendados

### Cenários para Testar

1. **Repositório com `preview` existente**:
   - Local apenas
   - Remota apenas
   - Ambas

2. **Repositório sem `preview`**:
   - Com branch `main`
   - Com branch `master`
   - Sem nenhuma das duas

3. **Configurações de Remote**:
   - Com remote configurado e autenticação
   - Com remote mas sem autenticação
   - Sem remote

4. **Estado do Workspace**:
   - Limpo (sem modificações)
   - Com arquivos não commitados

## Comandos Úteis

### Verificação Manual
```bash
git branch -a  # Listar todas as branches
git checkout preview  # Selecionar branch preview
```

### Criação Manual
```bash
git checkout main  # ou master
git checkout -b preview  # Criar e selecionar preview
git push -u origin preview  # Publicar (opcional)
```

## Considerações

- A operação é segura e não afeta branches existentes
- O push para remote é opcional e falhas não impedem o fluxo
- Usuários são informados sobre todas as etapas
- Sugestões úteis são fornecidas em caso de erros