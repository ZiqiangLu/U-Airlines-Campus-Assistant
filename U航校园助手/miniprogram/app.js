App({
  globalData: {
    envId: 'cloud1-d1g1017agb2a55992',
    user: null
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '初始化失败',
        content: '请使用支持云开发的微信开发者工具基础库。'
      });
      return;
    }

    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
  }
});
