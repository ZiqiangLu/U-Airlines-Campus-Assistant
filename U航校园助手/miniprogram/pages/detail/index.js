const { call, showError } = require('../../utils/api');
const {
  squareTopics,
  lostCategories,
  marketCategories,
  helpCategories,
  channelNames
} = require('../../utils/constants');
const { normalizePost, relativeTime } = require('../../utils/format');

function findName(list, key, fallback) {
  const item = list.find((value) => value.key === key);
  return item ? item.name : fallback;
}

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    commentText: '',
    posterPath: '',
    loading: true,
    sending: false,
    creatingPoster: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.loadDetail();
  },

  loadDetail() {
    if (!this.data.id) return;
    this.setData({ loading: true });

    call('post', { action: 'get', id: this.data.id })
      .then((result) => {
        const post = result.post || {};
        const categorySources = {
          lost_found: lostCategories,
          market: marketCategories,
          partner: helpCategories,
          square: squareTopics
        };
        const categoryList = categorySources[post.channel] || squareTopics;
        this.setData({
          post: normalizePost({
            ...post,
            topicName: findName(squareTopics, post.topic, '校园'),
            categoryName: findName(categoryList, post.category || post.topic, channelNames[post.channel] || '校园')
          }),
          comments: (result.comments || []).map((comment) => ({
            ...comment,
            timeText: relativeTime(comment.createdAt)
          }))
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onCommentInput(event) {
    this.setData({ commentText: event.detail.value });
  },

  addComment() {
    const content = this.data.commentText.trim();
    if (content.length < 2) {
      wx.showToast({ title: '评论至少 2 个字', icon: 'none' });
      return;
    }

    this.setData({ sending: true });
    call('post', {
      action: 'comment',
      id: this.data.id,
      content
    })
      .then((result) => {
        this.setData({ commentText: '' });
        wx.showToast({
          title: result.status === 'visible' ? '已评论' : '评论待审核',
          icon: 'none'
        });
        this.loadDetail();
      })
      .catch(showError)
      .finally(() => {
        this.setData({ sending: false });
      });
  },

  likePost() {
    call('post', { action: 'like', id: this.data.id })
      .then((result) => {
        const post = this.data.post;
        this.setData({
          post: {
            ...post,
            liked: result.liked,
            likeCount: Math.max(0, (post.likeCount || 0) + (result.liked ? 1 : -1))
          }
        });
      })
      .catch(showError);
  },

  reportPost() {
    wx.showActionSheet({
      itemList: ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'],
      success: (res) => {
        const reasons = ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'];
        call('post', {
          action: 'report',
          id: this.data.id,
          reason: reasons[res.tapIndex]
        })
          .then(() => {
            wx.showToast({ title: '已举报', icon: 'success' });
          })
          .catch(showError);
      }
    });
  },

  reportComment(event) {
    const id = event.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'],
      success: (res) => {
        const reasons = ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'];
        call('post', {
          action: 'report',
          targetType: 'comment',
          id,
          reason: reasons[res.tapIndex]
        })
          .then(() => {
            wx.showToast({ title: '已举报', icon: 'success' });
          })
          .catch(showError);
      }
    });
  },

  markResolved() {
    call('post', { action: 'markResolved', id: this.data.id })
      .then(() => {
        wx.showToast({ title: '已标记', icon: 'success' });
        this.loadDetail();
      })
      .catch(showError);
  },

  createPoster() {
    if (!this.data.post || this.data.creatingPoster) return;
    this.setData({ creatingPoster: true });

    const post = this.data.post;
    const ctx = wx.createCanvasContext('posterCanvas', this);
    const width = 600;
    const height = 860;

    ctx.setFillStyle('#f6f7fb');
    ctx.fillRect(0, 0, width, height);
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(34, 34, width - 68, height - 68);

    ctx.setFillStyle('#1f7a5b');
    ctx.fillRect(34, 34, 10, height - 68);
    ctx.setFillStyle('#17202f');
    ctx.setFontSize(34);
    ctx.fillText(channelNames[post.channel] || '航校广场', 70, 96);

    ctx.setFillStyle('#697386');
    ctx.setFontSize(22);
    ctx.fillText(`${post.categoryName || post.topicName || '校园'} · ${post.fullTimeText || post.timeText}`, 70, 136);

    ctx.setFillStyle('#17202f');
    ctx.setFontSize(32);
    this.drawText(ctx, post.title || '校园信息', 70, 202, 460, 42, 2);

    if (post.price) {
      ctx.setFillStyle('#a04612');
      ctx.setFontSize(30);
      ctx.fillText(post.price, 70, 298);
    }

    ctx.setFillStyle('#30394a');
    ctx.setFontSize(26);
    this.drawText(ctx, post.content || '', 70, post.price ? 350 : 300, 460, 42, 8);

    ctx.setFillStyle('#edf0f4');
    ctx.fillRect(70, 710, 460, 1);
    ctx.setFillStyle('#697386');
    ctx.setFontSize(22);
    ctx.fillText('打开小程序查看失物招领、校园指南和信息详情', 70, 760);
    ctx.setFillStyle('#17202f');
    ctx.setFontSize(28);
    ctx.fillText('航校广场', 70, 810);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath(
        {
          canvasId: 'posterCanvas',
          width,
          height,
          destWidth: width * 2,
          destHeight: height * 2,
          success: (res) => {
            this.setData({ posterPath: res.tempFilePath });
            wx.previewImage({ urls: [res.tempFilePath] });
          },
          fail: showError,
          complete: () => {
            this.setData({ creatingPoster: false });
          }
        },
        this
      );
    });
  },

  drawText(ctx, content, x, y, maxWidth, lineHeight, maxLines) {
    const chars = String(content || '').split('');
    let line = '';
    let lineCount = 0;

    for (let i = 0; i < chars.length; i += 1) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        lineCount += 1;
        if (lineCount >= maxLines) {
          ctx.fillText(`${line.slice(0, Math.max(0, line.length - 1))}...`, x, y);
          return;
        }
        ctx.fillText(line, x, y);
        line = chars[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line && lineCount < maxLines) ctx.fillText(line, x, y);
  },

  onShareAppMessage() {
    const post = this.data.post || {};
    return {
      title: post.title || post.content || '航校广场',
      path: `/pages/detail/index?id=${this.data.id}`
    };
  }
});
