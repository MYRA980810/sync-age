let currentScreen = 0;
let selectedPos = null;
let authData = null;

const screens = ['screen-welcome', 'screen-login', 'screen-pos', 'screen-confirm', 'screen-done'];

function showScreen(index) {
  screens.forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.toggle('active', i === index);
  });

  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i <= index);
  });

  currentScreen = index;
}

document.getElementById('btn-start').addEventListener('click', () => {
  showScreen(1);
});

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const errorEl = document.getElementById('login-error');
  const btnLogin = document.getElementById('btn-login');

  errorEl.style.display = 'none';

  if (!email || !password) {
    errorEl.textContent = 'Ingresa tu correo y contraseña.';
    errorEl.style.display = 'block';
    return;
  }

  btnLogin.textContent = 'CONECTANDO...';
  btnLogin.disabled = true;

  try {
    const result = await window.livecomerceAgent.login(email, password);

    if (result.success) {
      authData = result;
      showScreen(2);
    } else {
      errorEl.textContent = result.error || 'Correo o contraseña incorrectos';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Error de conexión. Verifica tu internet.';
    errorEl.style.display = 'block';
  } finally {
    btnLogin.textContent = 'CONECTAR';
    btnLogin.disabled = false;
  }
});

document.querySelectorAll('.pos-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.pos-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    selectedPos = option.dataset.pos;

    setTimeout(() => {
      showScreen(3);
      startDetection(selectedPos);
    }, 300);
  });
});

async function startDetection(posType) {
  const icon = document.getElementById('confirm-icon');
  const title = document.getElementById('confirm-title');
  const text = document.getElementById('confirm-text');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const btnSync = document.getElementById('btn-sync');

  if (posType === 'aspel') {
    title.textContent = 'Buscando Aspel SAE...';
    text.textContent = 'Detectando tu sistema de punto de venta.';

    const result = await window.livecomerceAgent.detectPOS();

    if (result.found) {
      icon.textContent = '✅';
      title.textContent = 'Encontramos Aspel SAE en tu computadora';
      text.textContent = `Versión ${result.version} detectada. ¿Sincronizamos tu inventario?`;
      btnSync.style.display = 'block';

      btnSync.addEventListener('click', async () => {
        btnSync.style.display = 'none';
        title.textContent = 'Sincronizando inventario...';

        let progress = 0;
        const interval = setInterval(() => {
          progress = Math.min(progress + Math.random() * 15, 100);
          progressFill.style.width = `${progress}%`;
          progressText.textContent = `${Math.round(progress)}% completado...`;

          if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => showScreen(4), 500);
          }
        }, 200);
      });
    } else {
      icon.textContent = '⚠️';
      title.textContent = 'No encontramos Aspel SAE';
      text.textContent = 'Puedes importar tu inventario manualmente con un archivo CSV o Excel.';
      btnSync.textContent = 'IMPORTAR MANUALMENTE';
      btnSync.style.display = 'block';
    }
  } else if (posType === 'square') {
    icon.textContent = '◻️';
    title.textContent = 'Conectar con Square';
    text.textContent = 'Necesitamos tu API key de Square para sincronizar.';
    btnSync.textContent = 'CONECTAR SQUARE';
    btnSync.style.display = 'block';
  } else {
    icon.textContent = '📁';
    title.textContent = 'Importar desde archivo';
    text.textContent = 'Selecciona tu archivo CSV o Excel con el inventario.';
    btnSync.textContent = 'SELECCIONAR ARCHIVO';
    btnSync.style.display = 'block';

    btnSync.addEventListener('click', () => {
      setTimeout(() => showScreen(4), 1000);
    });
  }
}

document.getElementById('btn-done').addEventListener('click', () => {
  window.close();
});
