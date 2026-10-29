const poolData = {
  UserPoolId: 'eu-central-1_KCWNYcwst',
  ClientId: '54do51ujicvh061g38les0ouhk',
};

const API_BASE_URL = 'https://47kdkr6syc.execute-api.eu-central-1.amazonaws.com';

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
let currentIdToken = null;
let selectedFile = null;

function showStatus(message, isError = false) {
  const box = document.getElementById('status-box');
  box.textContent = message;
  box.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
  box.style.display = 'block';
}

function switchTab(tab) {
  ['login', 'signup', 'confirm'].forEach((t) => {
    document.getElementById(`form-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`tab-${t}`).className = 'tab-btn ' + (t === tab ? 'active' : '');
  });
  document.getElementById('status-box').style.display = 'none';
}

function handleSignUp(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
  ];

  showStatus('Kayıt oluşturuluyor...');
  userPool.signUp(email, password, attributeList, null, (err, result) => {
    if (err) {
      showStatus(err.message || JSON.stringify(err), true);
      return;
    }
    showStatus('Kayıt başarılı! Lütfen e-postana gelen 6 haneli doğrulama kodunu gir.');
    document.getElementById('confirm-email').value = email;
    switchTab('confirm');
  });
}

function handleConfirm(e) {
  e.preventDefault();
  const email = document.getElementById('confirm-email').value;
  const code = document.getElementById('confirm-code').value;

  const userData = { Username: email, Pool: userPool };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  showStatus('Kod doğrulanıyor...');
  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) {
      showStatus(err.message || JSON.stringify(err), true);
      return;
    }
    showStatus('Hesabın doğrulandı! Şimdi giriş yapabilirsin.');
    document.getElementById('login-email').value = email;
    switchTab('login');
  });
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const userData = { Username: email, Pool: userPool };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  showStatus('Giriş yapılıyor...');
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) => {
      currentIdToken = result.getIdToken().getJwtToken();
      updateUIForAuth(email);
      showStatus('Giriş başarılı! Şimdi bir fotoğraf seçip yükleyebilirsin.');
    },
    onFailure: (err) => {
      showStatus(err.message || JSON.stringify(err), true);
    },
  });
}

function updateUIForAuth(email) {
  document.getElementById('unauth-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'block';
  document.getElementById('user-display-email').textContent = email;
}

function handleLogout() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
  currentIdToken = null;
  selectedFile = null;
  document.getElementById('unauth-view').style.display = 'block';
  document.getElementById('auth-view').style.display = 'none';
  showStatus('Başarıyla çıkış yapıldı.');
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedFile = file;
  document.getElementById('file-info').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  const reader = new FileReader();
  reader.onload = (event) => {
    const preview = document.getElementById('preview');
    preview.src = event.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  document.getElementById('upload-btn').disabled = false;
}

async function uploadPhoto() {
  if (!selectedFile || !currentIdToken) {
    showStatus('Lütfen bir dosya seçin ve oturumunuzun açık olduğundan emin olun.', true);
    return;
  }

  const uploadBtn = document.getElementById('upload-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  uploadBtn.disabled = true;
  progressContainer.style.display = 'block';
  progressBar.style.width = '10%';
  showStatus('1/2: API Gateway üzerinden S3 Presigned URL alınıyor...');

  try {
    const presignRes = await fetch(`${API_BASE_URL}/photos/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentIdToken,
      },
      body: JSON.stringify({
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'image/jpeg',
      }),
    });

    if (!presignRes.ok) {
      const errData = await presignRes.json().catch(() => ({}));
      throw new Error(errData.message || `API Hatası: ${presignRes.status}`);
    }

    const { uploadUrl, photoId } = await presignRes.json();
    progressBar.style.width = '40%';
    showStatus('2/2: Fotoğraf doğrudan S3 Uploads Bucket\'ına yükleniyor (Direct to S3)...');

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', selectedFile.type || 'image/jpeg');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round(40 + (e.loaded / e.total) * 55);
        progressBar.style.width = percent + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        progressBar.style.width = '100%';
        showStatus(`Başarılı! Fotoğraf S3'e ve DynamoDB'ye kaydedildi! (Photo ID: ${photoId})`);
        uploadBtn.disabled = false;
      } else {
        showStatus(`S3 Yükleme Hatası (HTTP ${xhr.status})`, true);
        uploadBtn.disabled = false;
      }
    };

    xhr.onerror = () => {
      showStatus('S3 Yükleme sırasında ağ hatası oluştu (CORS kontrol ediniz).', true);
      uploadBtn.disabled = false;
    };

    xhr.send(selectedFile);
  } catch (err) {
    showStatus(err.message, true);
    uploadBtn.disabled = false;
    progressContainer.style.display = 'none';
  }
}

window.onload = function () {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser != null) {
    cognitoUser.getSession((err, session) => {
      if (err) return;
      if (session.isValid()) {
        currentIdToken = session.getIdToken().getJwtToken();
        updateUIForAuth(cognitoUser.getUsername());
      }
    });
  }
};
