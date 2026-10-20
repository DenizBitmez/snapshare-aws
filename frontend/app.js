
const poolData = {
  UserPoolId: 'eu-central-1_KCWNYcwst',
  ClientId: '54do51ujicvh061g38les0ouhk',
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

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
      const accessToken = result.getAccessToken().getJwtToken();
      updateUIForAuth(email, accessToken);
      showStatus('Giriş başarılı!');
    },
    onFailure: (err) => {
      showStatus(err.message || JSON.stringify(err), true);
    },
  });
}

function updateUIForAuth(email, token) {
  document.getElementById('unauth-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'block';
  document.getElementById('user-display-email').textContent = email;
  document.getElementById('token-preview').textContent = token.substring(0, 80) + '... (JWT Aktif)';
}

function handleLogout() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
  document.getElementById('unauth-view').style.display = 'block';
  document.getElementById('auth-view').style.display = 'none';
  showStatus('Başarıyla çıkış yapıldı.');
}

window.onload = function () {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser != null) {
    cognitoUser.getSession((err, session) => {
      if (err) return;
      if (session.isValid()) {
        updateUIForAuth(cognitoUser.getUsername(), session.getAccessToken().getJwtToken());
      }
    });
  }
};
