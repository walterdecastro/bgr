// ============================================================
//  PasteShare - usa a API pública jsonblob.com (sem cadastro)
//  Docs: https://jsonblob.com/api
// ============================================================

const API = 'https://jsonblob.com/api/jsonBlob';

// ----- utilidades -----
function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1 (confusos)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const t = new bootstrap.Toast(document.getElementById('toast'), { delay: 2500 });
  t.show();
}

async function copiarParaClipboard(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}

// ============================================================
//  CRIAR
// ============================================================
async function criar() {
  const texto = document.getElementById('textInput').value.trim();

  if (!texto) {
    showToast('⚠️ Cole algum texto antes de gerar o código.');
    return;
  }
  if (texto.length > 100000) {
    showToast('⚠️ Texto muito grande (máx. 100.000 caracteres).');
    return;
  }

  const btn = document.getElementById('btnCreate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';

  const codigo = gerarCodigo();

  // o jsonblob gera um ID próprio; nós guardamos o código dentro do JSON
  // para poder buscar depois. Também salvamos um timestamp.
  const payload = {
    codigo: codigo,
    texto: texto,
    criadoEm: new Date().toISOString()
  };

  try {
    const resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error('Falha na API');

    const location = resp.headers.get('Location'); // ex: https://jsonblob.com/api/jsonBlob/1234...
    const blobId = location.split('/').pop();

    // salvamos o mapa "codigo -> blobId" no localStorage só como referência local,
    // MAS para funcionar em OUTRO computador precisamos de outra estratégia:
    // usamos o PRÓPRIO código como parte da URL de consulta no jsonblob.
    //
    // Como jsonblob não permite buscar por conteúdo, usamos uma segunda camada:
    // salvamos um "índice" em outro blob, ou — mais simples e confiável —
    // usamos o código como o ID do blob (não é possível no jsonblob).
    //
    // Alternativa adotada: usamos o código como sufixo numa consulta
    // a um blob-índice global. Veja abaixo.

    // ⬇️ Estratégia final: usamos o serviço KVdb.io ou similar.
    // Como isso complica, vamos simplificar usando apenas o ID do blob
    // como "código" — mas ele é longo. Então usamos este approach:
    //
    // Utilizamos o próprio ID do blob como código visível ao usuário.
    // Como o ID é grande, mostramos apenas os últimos 8 caracteres e
    // pedimos ao usuário o ID completo. NÃO é ideal.
    //
    // ✅ SOLUÇÃO DEFINITIVA E SIMPLES:
    // Usamos o serviço "https://api.npoint.io" ou salvamos um blob-índice.
    // Vamos salvar um BLOB-ÍNDICE que contém { CODIGO: blobId }.
    // Mas jsonblob não permite editar facilmente sem race conditions...
    //
    // Então a escolha mais limpa: usar o **KVdb.io** com bucket anônimo.
    // Veja a versão final abaixo em "SOLUÇÃO FINAL".

    console.log('Blob criado:', blobId);
    // (código continua na SOLUÇÃO FINAL)
  } catch (err) {
    console.error(err);
    showToast('❌ Erro ao criar. Tente novamente.');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-magic"></i> Gerar código de compartilhamento';
  }
}

// ============================================================
//  SOLUÇÃO FINAL — usando KVdb.io (bucket público gratuito)
// ============================================================

// Bucket anônimo fixo (criado uma vez, público, somente para este app).
// Você pode criar o seu em https://kvdb.io/ e trocar aqui.
const BUCKET = 'https://kvdb.io/KcFs9YCuvxfeaAUabkXE2S'; // ← troque pelo seu bucket

async function criarFinal() {
  const texto = document.getElementById('textInput').value.trim();

  if (!texto) { showToast('⚠️ Cole algum texto antes de gerar o código.'); return; }
  if (texto.length > 100000) { showToast('⚠️ Texto muito grande (máx. 100.000 caracteres).'); return; }

  const btn = document.getElementById('btnCreate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';

  const codigo = gerarCodigo();

  try {
    const resp = await fetch(`${BUCKET}/${codigo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: texto
    });

    if (!resp.ok) throw new Error('Falha ao salvar');

    document.getElementById('generatedCode').textContent = codigo;
    document.getElementById('resultCreate').classList.remove('d-none');
    showToast('✅ Código gerado com sucesso!');
  } catch (err) {
    console.error(err);
    showToast('❌ Erro ao criar. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-magic"></i> Gerar código de compartilhamento';
  }
}

async function buscarFinal() {
  const codigo = document.getElementById('codeInput').value.trim().toUpperCase();

  if (codigo.length !== 6) { showToast('⚠️ O código deve ter 6 caracteres.'); return; }

  const btn = document.getElementById('btnFetch');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Buscando...';

  try {
    const resp = await fetch(`${BUCKET}/${codigo}`);
    if (!resp.ok) throw new Error('Código não encontrado');

    const texto = await resp.text();
    if (!texto) throw new Error('Vazio');

    document.getElementById('fetchedText').value = texto;
    document.getElementById('fetchResult').classList.remove('d-none');
    showToast('✅ Texto recuperado!');
  } catch (err) {
    console.error(err);
    showToast('❌ Código não encontrado ou expirado.');
    document.getElementById('fetchResult').classList.add('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search"></i> Buscar';
  }
}

// ============================================================
//  EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCreate').addEventListener('click', criarFinal);
  document.getElementById('btnFetch').addEventListener('click', buscarFinal);

  document.getElementById('btnCopyCode').addEventListener('click', async () => {
    const code = document.getElementById('generatedCode').textContent;
    await copiarParaClipboard(code);
    showToast('📋 Código copiado!');
  });

  document.getElementById('btnCopyText').addEventListener('click', async () => {
    const txt = document.getElementById('fetchedText').value;
    await copiarParaClipboard(txt);
    showToast('📋 Texto copiado!');
  });

  document.getElementById('btnNew').addEventListener('click', () => {
    document.getElementById('textInput').value = '';
    document.getElementById('resultCreate').classList.add('d-none');
  });

  // permite Enter no campo de código
  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarFinal();
  });

  // força maiúsculas
  document.getElementById('codeInput').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });
});