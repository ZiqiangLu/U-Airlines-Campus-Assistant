function shouldSkipRegisterGuard(name, data = {}) {
  if (name === 'login' || name === 'guide') return true;

  const action = data.action || '';
  if (name === 'post' && ['list', 'get'].includes(action) && !data.mine) return true;
  if (name === 'chat' && action === 'listLatest') return true;

  return isDevelopEnv();
}

function isDevelopEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const version = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion;
    return version === 'develop';
  } catch (error) {
    return false;
  }
}

function ensureRegistered(name, data = {}) {
  if (shouldSkipRegisterGuard(name, data)) return Promise.resolve();

  const app = getApp();
  const cachedUser = app.globalData && app.globalData.user;
  if (cachedUser && cachedUser.registered) return Promise.resolve();

  return wx.cloud.callFunction({ name: 'login', data: {} }).then((res) => {
    const result = res.result || {};
    if (result.ok === false) {
      throw new Error(result.message || '请先注册');
    }

    app.globalData.user = result.user;
    if (result.user && result.user.registered) return;

    const pages = getCurrentPages();
    const current = pages.length ? pages[pages.length - 1].route : '';
    if (current !== 'pages/register/index') {
      wx.navigateTo({ url: '/pages/register/index' });
    }
    throw new Error('请先完成注册');
  });
}

function call(name, data = {}) {
  return ensureRegistered(name, data).then(() => wx.cloud.callFunction({ name, data })).then((res) => {
    const result = res.result || {};
    if (result.ok === false) {
      throw new Error(result.message || '请求失败');
    }
    return result;
  });
}

function showError(error) {
  const message = error && error.message ? error.message : '操作失败，请稍后再试';
  wx.showToast({
    title: message,
    icon: 'none'
  });
}

module.exports = {
  call,
  showError
};
