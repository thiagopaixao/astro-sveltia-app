# Fluxo de trabalho c/ git no Documental 2.0

## Instruções gerais

1. Clone repositório, instale dependências, de build e rode server no modo dev.
2. Trabalhe prioritáriamente na branch 'preview'.
3. Visualize, teste e aprove todas a mudanças. Quando tiver finalizado todas as alterações, publique na branch 'main' via rebase.
4. Opcionalmente, antes de amandar para 'preview', usuário pode salvar o trabalho no repositório em uma branch temporária, mas sempre deve ser feito merge/rebase para 'preview' antes de 'main'. Toda branch temporária tem o prefixo 'working_user_date_' onde 'user' é o nome do usuário e 'date' é a data de criação no formato 'yyyymmdd-hhmm' . Toda vez que for realizado merge/rebase da branch temporária na branch 'preview', a branch temporária deve ser apagada.

OBS: Procure mandar pra 'main' só implementações finalizadas e aprovadas, pois será o que o público visualizará prioritariamente.

## 1. Instalação e rodar o serviço
```
# Clone o repositório
git clone https://github.com/thiagopaixao/documentalxyz.git
cd documentalxyz

# Instale as dependências
npm install

# Rode os scripts de geração 
npm run build

# Inicie o servidor de desenvolvimento
npm run dev
```

## 2. Fluxo de trabalho principal (preview)

```
# Verifica em qual branch está no momento
git branch

# Muda para branch preview
git checkout preview

# Baixa atualizações do repositório
git pull

# Adiciona arquivo e commita mudanças
git add src/content/pages/*
git add public/uploads/*
git commit -m "Update by $USER."

# Envia mudanças para repositório na branch preview
git push origin preview
```

**Aguarde deploy no GitHub Actions e visualize as mudanças em:** [https://beta.documental.xyz/](https://beta.documental.xyz/)


## 3. Publicação em produção (main)

```
# Verifica em qual branch está no momento
git branch

# Muda para branch main
git checkout main

# Baixa atualizações do repositório
git pull

# Faz merge das alterações do preview no main
git rebase preview

# Envia mudanças para repositório na branch main
git push origin main
```

**Aguarde deploy no GitHub Actions e visualize as mudanças em:** [https://documental.xyz/](https://documental.xyz/)


