function createIsomorphicGitAdapter({ git, http, fs, getGitHubToken, sendCommandOutput } = {}) {
  if (!git) {
    throw new Error('git implementation is required');
  }

  if (!fs) {
    throw new Error('fs implementation is required');
  }

  const output = typeof sendCommandOutput === 'function' ? sendCommandOutput : () => {};

  async function clone(url, dir, options = {}) {
    try {
      const token = getGitHubToken ? await getGitHubToken() : null;
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;

      await git.clone({
        fs,
        http,
        dir,
        url,
        auth,
        ...options
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  async function checkout(dir, branch) {
    await git.checkout({
      fs,
      dir,
      ref: branch
    });
    return true;
  }

  async function getRemoteUrl(dir) {
    try {
      const url = await git.getConfig({
        fs,
        dir,
        path: 'remote.origin.url'
      });
      return url;
    } catch (error) {
      return null;
    }
  }

  async function setUserConfig(dir, name, email) {
    await git.setConfig({
      fs,
      dir,
      path: 'user.name',
      value: name
    });

    await git.setConfig({
      fs,
      dir,
      path: 'user.email',
      value: email
    });

    return true;
  }

  async function listBranches(dir) {
    try {
      output(`📋 Listando branches em ${dir}...\n`);
      const branches = await git.listBranches({ fs, dir });
      output(`🔍 Encontradas ${branches.length} branches no repositório\n`);

      const currentBranch = await git.currentBranch({ fs, dir });
      output(`📍 Branch atual: ${currentBranch}\n`);

      const localBranches = branches.filter(branch => !branch.includes('origin/'));
      const remoteBranches = branches.filter(branch => branch.includes('origin/'))
        .map(branch => branch.replace('origin/', ''));

      const uniqueBranches = [...new Set([...localBranches, ...remoteBranches])];

      output(`📂 Branches locais: ${localBranches.length}\n`);
      output(`🌐 Branches remotas: ${remoteBranches.length}\n`);
      output(`✅ Total de ${uniqueBranches.length} branches únicas\n`);

      return {
        branches: uniqueBranches,
        currentBranch,
        localBranches,
        remoteBranches
      };
    } catch (error) {
      output(`❌ Erro ao listar branches: ${error.message}\n`);
      throw error;
    }
  }

  async function createBranch(dir, branchName) {
    try {
      output(`🌿 Criando nova branch '${branchName}' em ${dir}...\n`);

      if (!branchName || !/^[a-zA-Z0-9._-]+$/.test(branchName)) {
        throw new Error('Invalid branch name. Only alphanumeric characters, dots, hyphens and underscores are allowed.');
      }

      output(`🔍 Verificando se branch já existe...\n`);
      const existingBranches = await git.listBranches({ fs, dir });
      if (existingBranches.includes(branchName)) {
        output(`❌ Branch '${branchName}' já existe.\n`);
        throw new Error(`Branch '${branchName}' already exists.`);
      }

      output(`📝 Criando branch '${branchName}'...\n`);
      await git.branch({
        fs,
        dir,
        ref: branchName
      });

      output(`🔄 Mudando para nova branch '${branchName}'...\n`);
      await git.checkout({
        fs,
        dir,
        ref: branchName
      });

      output(`✅ Branch '${branchName}' criada e selecionada com sucesso\n`);
      return true;
    } catch (error) {
      output(`❌ Erro ao criar branch '${branchName}': ${error.message}\n`);
      throw error;
    }
  }

  async function checkoutBranch(dir, branchName) {
    try {
      output(`🔄 Mudando para branch '${branchName}' em ${dir}...\n`);

      const branches = await git.listBranches({ fs, dir });
      const localBranch = branches.find(b => b === branchName);
      const remoteBranch = branches.find(b => b === `origin/${branchName}`);

      if (!localBranch && !remoteBranch) {
        output(`❌ Branch '${branchName}' não encontrada.\n`);
        throw new Error(`Branch '${branchName}' not found.`);
      }

      if (!localBranch && remoteBranch) {
        output(`📥 Criando branch local '${branchName}' para rastrear branch remota\n`);
        await git.branch({
          fs,
          dir,
          ref: branchName,
          checkout: true
        });
      } else {
        output(`📂 Selecionando branch local existente '${branchName}'\n`);
        await git.checkout({
          fs,
          dir,
          ref: branchName
        });
      }

      output(`✅ Branch '${branchName}' selecionada com sucesso\n`);
      return true;
    } catch (error) {
      output(`❌ Erro ao selecionar branch '${branchName}': ${error.message}\n`);
      throw error;
    }
  }

  async function getCurrentBranch(dir) {
    return git.currentBranch({ fs, dir });
  }

  async function ensurePreviewBranch(dir) {
    try {
      output(`🔍 Garantindo que a branch 'preview' exista em ${dir}...\n`);

      const branches = await git.listBranches({ fs, dir });
      const hasLocalPreview = branches.includes('preview');
      const hasRemotePreview = branches.includes('origin/preview');

      output(`📂 Branch 'preview' local: ${hasLocalPreview ? '✅' : '❌'}\n`);
      output(`🌐 Branch 'preview' remota: ${hasRemotePreview ? '✅' : '❌'}\n`);

      if (hasLocalPreview || hasRemotePreview) {
        output(`📂 Branch 'preview' encontrada (${hasLocalPreview ? 'local' : 'remota'}), selecionando...\n`);
        await checkoutBranch(dir, 'preview');
        output(`✅ Branch 'preview' selecionada com sucesso\n`);
        return { created: false, checkedOut: true, source: hasLocalPreview ? 'local' : 'remote' };
      }

      let baseBranch = 'main';
      try {
        output(`🔍 Tentando selecionar branch 'main' como base...\n`);
        await checkoutBranch(dir, 'main');
      } catch (mainError) {
        output(`⚠️ Branch 'main' não encontrada: ${mainError.message}\n`);
        try {
          output(`🔍 Tentando selecionar branch 'master' como base...\n`);
          await checkoutBranch(dir, 'master');
          baseBranch = 'master';
        } catch (masterError) {
          output(`❌ Branch 'master' também não encontrada: ${masterError.message}\n`);
          throw new Error('Nem branch "main" nem "master" encontrada para criar a branch "preview"');
        }
      }

      try {
        const status = await git.status({ fs, dir });
        if (status.files && status.files.length > 0) {
          output(`⚠️ Existem arquivos não commitados no diretório de trabalho\n`);
          output(`📋 Arquivos modificados: ${status.files.map(f => f.path).join(', ')}\n`);
        } else {
          output(`✅ Diretório de trabalho limpo, seguro para criar branch\n`);
        }
      } catch (statusError) {
        output(`⚠️ Não foi possível verificar status do diretório: ${statusError.message}\n`);
      }

      output(`🌿 Criando branch 'preview' a partir de '${baseBranch}'...\n`);
      await createBranch(dir, 'preview');

      try {
        const remoteUrl = await getRemoteUrl(dir);
        if (remoteUrl) {
          output(`🌐 Repositório remoto encontrado: ${remoteUrl}\n`);
          output(`🚀 Tentando publicar branch 'preview' para o repositório remoto...\n`);

          const token = getGitHubToken ? await getGitHubToken() : null;
          if (token) {
            const auth = { username: token, password: 'x-oauth-basic' };
            await git.push({
              fs,
              http,
              dir,
              url: remoteUrl,
              ref: 'preview:preview',
              auth,
              force: false
            });
            output(`✅ Branch 'preview' publicada com sucesso para o repositório remoto\n`);
          } else {
            output(`⚠️ Autenticação GitHub não configurada\n`);
          }
        } else {
          output(`ℹ️ Nenhum repositório remoto configurado\n`);
        }
      } catch (pushError) {
        output(`⚠️ Não foi possível publicar branch 'preview' para o repositório remoto: ${pushError.message}\n`);
      }

      return { created: true, checkedOut: true, baseBranch };
    } catch (error) {
      output(`❌ Erro ao garantir branch 'preview': ${error.message}\n`);
      throw error;
    }
  }

  async function getRepositoryInfo(dir) {
    try {
      let remoteUrl = '';
      try {
        remoteUrl = await git.getConfig({
          fs,
          dir,
          path: 'remote.origin.url'
        });
      } catch (error) {
        // ignore missing remote
      }

      const currentBranch = await git.currentBranch({ fs, dir });
      const branches = await git.listBranches({ fs, dir });

      return {
        remoteUrl,
        currentBranch,
        branches
      };
    } catch (error) {
      output(`❌ Error getting repository info: ${error.message}\n`);
      throw error;
    }
  }

  async function pullFromPreview(dir) {
    try {
      output(`🔄 Buscando atualizações da branch preview em ${dir}...\n`);

      const currentBranch = await git.currentBranch({ fs, dir });
      output(`📍 Branch atual: ${currentBranch}\n`);

      const token = getGitHubToken ? await getGitHubToken() : null;
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;

      output(`📥 Buscando dados da branch remota 'preview'...\n`);
      await git.fetch({
        fs,
        http,
        dir,
        url: await getRemoteUrl(dir),
        ref: 'preview',
        auth,
        singleBranch: false
      });

      output(`🔀 Mesclando origin/preview na branch ${currentBranch}...\n`);
      await git.merge({
        fs,
        dir,
        theirs: 'origin/preview',
        ours: currentBranch,
        message: `Merge preview into ${currentBranch}`
      });

      output(`✅ Branch 'preview' mesclada com sucesso em ${currentBranch}\n`);
      return {
        success: true,
        message: `Atualizações da branch 'preview' foram mescladas na branch '${currentBranch}' com sucesso.`
      };
    } catch (error) {
      output(`❌ Erro ao buscar atualizações: ${error.message}\n`);
      throw error;
    }
  }

  async function pushToBranch(dir, targetBranch) {
    try {
      output(`🚀 Publicando de ${dir} para branch ${targetBranch}...\n`);

      const currentBranch = await git.currentBranch({ fs, dir });
      output(`📍 Branch atual: ${currentBranch}\n`);

      const token = getGitHubToken ? await getGitHubToken() : null;
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;

      const remoteUrl = await getRemoteUrl(dir);
      if (!remoteUrl) {
        output(`❌ URL remota não encontrada.\n`);
        throw new Error('Remote URL not found. Please ensure the repository has a remote origin.');
      }

      await git.push({
        fs,
        http,
        dir,
        url: remoteUrl,
        ref: `${currentBranch}:${targetBranch}`,
        auth,
        force: false
      });

      output(`✅ Branch ${currentBranch} publicada com sucesso para ${targetBranch}\n`);
      return {
        success: true,
        message: `Branch '${currentBranch}' foi publicada com sucesso para '${targetBranch}'.`
      };
    } catch (error) {
      output(`❌ Erro ao publicar branch: ${error.message}\n`);
      throw error;
    }
  }

  async function listRemoteBranches(dir) {
    try {
      output(`📋 Listando branches remotas em ${dir}...\n`);

      const token = getGitHubToken ? await getGitHubToken() : null;
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;

      const remoteUrl = await getRemoteUrl(dir);
      if (!remoteUrl) {
        output(`❌ URL remota não encontrada.\n`);
        throw new Error('Remote URL not found. Please ensure the repository has a remote origin.');
      }

      const result = await git.listBranches({
        fs,
        dir,
        remote: 'origin'
      });

      output(`✅ Encontradas ${result.length} branches remotas\n`);
      return result;
    } catch (error) {
      output(`❌ Erro ao listar branches remotas: ${error.message}\n`);
      throw error;
    }
  }

  return {
    clone,
    checkout,
    getRemoteUrl,
    setUserConfig,
    listBranches,
    createBranch,
    checkoutBranch,
    getCurrentBranch,
    ensurePreviewBranch,
    getRepositoryInfo,
    pullFromPreview,
    pushToBranch,
    listRemoteBranches
  };
}

module.exports = {
  createIsomorphicGitAdapter
};
