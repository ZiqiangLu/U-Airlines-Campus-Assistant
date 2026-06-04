const { call, showError } = require('../../utils/api');
const { guideGroups } = require('../../utils/constants');
const { formatTime } = require('../../utils/format');

const serviceTabs = [
  { key: 'courier', name: '快递站' },
  { key: 'print', name: '打印店' }
];

function groupNotices(items) {
  const map = {};
  (items || []).forEach((item) => {
    const title = item.category || item.sourceName || '官方来源';
    if (!map[title]) map[title] = [];
    map[title].push({
      ...item,
      meta: `${item.date || '公开信息'} · ${item.sourceName || '官方来源'}`
    });
  });

  return Object.keys(map).map((title) => ({
    title,
    items: map[title]
  }));
}

function normalizeServices(items) {
  return (items || []).map((item) => ({
    ...item,
    likeText: item.likeCount || 0
  }));
}

Page({
  data: {
    groups: [],
    noticeGroups: [],
    noticesUpdatedAtText: '',
    noticesSourceUrl: '',
    serviceTabs,
    serviceType: 'courier',
    serviceTypeName: '快递站',
    guideServices: {
      courier: [],
      print: []
    },
    currentServices: [],
    serviceForm: {
      title: '',
      location: '',
      desc: '',
      contact: ''
    },
    loading: false,
    submittingService: false
  },

  onLoad() {
    this.loadGuide();
  },

  onPullDownRefresh() {
    this.loadGuide().finally(() => wx.stopPullDownRefresh());
  },

  loadGuide() {
    this.setData({ loading: true });
    return call('guide', { action: 'list' })
      .then((result) => {
        const rawServices = result.guideServices || { courier: [], print: [] };
        const guideServices = {
          courier: normalizeServices(rawServices.courier),
          print: normalizeServices(rawServices.print)
        };
        this.setData({
          loading: false,
          groups: result.groups && result.groups.length ? result.groups : guideGroups,
          noticeGroups: groupNotices(result.notices || []),
          noticesSourceUrl: result.noticesSourceUrl || '',
          noticesUpdatedAtText: result.noticesUpdatedAt ? formatTime(result.noticesUpdatedAt) : '',
          guideServices
        });
        this.refreshCurrentServices();
      })
      .catch((error) => {
        const message = error && error.message ? error.message : '';
        this.setData({
          loading: false,
          groups: message.includes('注册') ? [] : guideGroups
        });
        showError(error);
      });
  },

  refreshCurrentServices() {
    const serviceType = this.data.serviceType;
    const currentTab = serviceTabs.find((item) => item.key === serviceType) || serviceTabs[0];
    const guideServices = this.data.guideServices || {};
    this.setData({
      serviceTypeName: currentTab.name,
      currentServices: guideServices[serviceType] || []
    });
  },

  switchServiceType(event) {
    const type = event.currentTarget.dataset.type;
    if (!type || type === this.data.serviceType) return;
    this.setData({ serviceType: type });
    this.refreshCurrentServices();
  },

  updateServiceForm(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({
      [`serviceForm.${field}`]: event.detail.value
    });
  },

  submitService() {
    if (this.data.submittingService) return;
    const form = this.data.serviceForm;
    this.setData({ submittingService: true });
    call('guide', {
      action: 'createService',
      type: this.data.serviceType,
      ...form
    })
      .then(() => {
        wx.showToast({ title: '已提交', icon: 'success' });
        this.setData({
          serviceForm: {
            title: '',
            location: '',
            desc: '',
            contact: ''
          }
        });
        return this.loadGuide();
      })
      .catch(showError)
      .finally(() => {
        this.setData({ submittingService: false });
      });
  },

  likeService(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    call('guide', {
      action: 'likeService',
      id
    })
      .then((result) => {
        const type = this.data.serviceType;
        const guideServices = this.data.guideServices;
        const next = (guideServices[type] || [])
          .map((item) => (item._id === id ? { ...item, likeCount: result.likeCount, likeText: result.likeCount || 0 } : item))
          .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        this.setData({
          [`guideServices.${type}`]: next,
          currentServices: next
        });
      })
      .catch(showError);
  },

  openLink(event) {
    const { url, title } = event.currentTarget.dataset;
    this.copyExternalUrl(url, title || '官方入口');
  },

  openNotice(event) {
    const { url, title } = event.currentTarget.dataset;
    this.copyExternalUrl(url, title || '官方通知');
  },

  copyExternalUrl(url, title) {
    if (!url) {
      wx.showToast({
        title: '后台补充链接后可用',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '复制官方链接',
      content: `即将复制“${title}”的官方链接。由于合规限制，小程序不直接打开外部网页，请复制后到浏览器查看。`,
      confirmText: '复制',
      cancelText: '取消',
      success: (modalResult) => {
        if (!modalResult.confirm) return;
        wx.setClipboardData({
          data: url,
          success: () => {
            wx.showToast({
              title: '链接已复制',
              icon: 'success'
            });
          }
        });
      }
    });
  }
});
