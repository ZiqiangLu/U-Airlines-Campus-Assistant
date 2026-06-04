const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const CHANNELS = ['square', 'lost_found', 'market', 'partner'];
const BLOCKED_WORDS = ['约炮', '裸聊', '网赌', '代考', '办证', '加微信返利', '校园贷'];

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(message) {
  return { ok: false, message };
}

function text(value, max = 800) {
  return String(value || '').trim().slice(0, max);
}

function bool(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.publicMessage = message;
    throw error;
  }
}

function checkLocalWords(content) {
  const normalized = String(content || '').toLowerCase();
  const hit = BLOCKED_WORDS.find((word) => normalized.includes(word.toLowerCase()));
  assert(!hit, '内容包含敏感词，请修改后再提交');
}

function throwPublic(message) {
  const error = new Error(message);
  error.publicMessage = message;
  throw error;
}

async function checkTextSecurity(openid, content) {
  if (!content) return;
  checkLocalWords(content);

  let result;
  try {
    result = await cloud.openapi.security.msgSecCheck({
      openid,
      scene: 2,
      version: 2,
      content
    });
  } catch (error) {
    const code = error.errCode === undefined ? error.errcode : error.errCode;
    console.error('msgSecCheck failed:', code === undefined ? error.message : code);
    throwPublic('内容安全检测暂不可用，请稍后再试');
  }

  const errCode = result.errCode === undefined ? result.errcode : result.errCode;
  if (errCode !== undefined && errCode !== 0) {
    console.error('msgSecCheck rejected:', result);
    throwPublic('内容安全检测失败，请稍后再试');
  }

  const suggest = result && result.result && result.result.suggest;
  if (suggest !== 'pass') {
    console.warn('msgSecCheck not pass:', result);
    throwPublic('内容含有敏感词或违规信息，请修改后再提交');
  }
}

async function checkImages(openid, images) {
  if (!images || !images.length) return;

  const tempResult = await cloud.getTempFileURL({ fileList: images });
  const fileList = (tempResult.fileList || []).filter((item) => item.tempFileURL);
  assert(fileList.length === images.length, '图片安全检测准备失败，请稍后再试');

  try {
    await Promise.all(
      fileList.map((item) =>
        cloud.openapi.security.mediaCheckAsync({
          openid,
          scene: 2,
          version: 2,
          mediaType: 2,
          mediaUrl: item.tempFileURL
        })
      )
    );
  } catch (error) {
    console.error('mediaCheckAsync failed:', error.errCode || error.message);
    throwPublic('图片安全检测提交失败，请稍后再试');
  }
}

async function getUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  if (result.data.length) return result.data[0];

  const now = new Date();
  const user = {
    openid,
    role: 'user',
    status: 'active',
    gender: '',
    verificationStatus: 'none',
    school: '',
    college: '',
    studentNoSuffix: '',
    realNameHint: '',
    nickname: '',
    avatarUrl: '',
    postCount: 0,
    likeReceivedCount: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };
  const created = await db.collection('users').add({ data: user });
  return { _id: created._id, ...user };
}

function isAdmin(user) {
  return user && user.role === 'admin' && user.status !== 'banned';
}

async function requireUser(openid) {
  assert(openid, '未登录');
  const user = await getUser(openid);
  assert(user.status !== 'banned', '账号已被封禁');
  assert(user.registered, '请先完成注册');
  return user;
}

async function requireReadableUser(openid) {
  assert(openid, '未登录');
  const user = await getUser(openid);
  assert(user.status !== 'banned', '账号已被封禁');
  return user;
}

function canReadWithoutRegistration(action, event) {
  if (action === 'get') return true;
  return action === 'list' && !event.mine;
}

async function addAuditLog(data) {
  await db.collection('audit_logs').add({
    data: {
      ...data,
      createdAt: new Date()
    }
  });
}

async function createPost(event, openid, user) {
  const now = new Date();
  const channel = text(event.channel, 24) || 'square';
  const title = text(event.title, 40);
  const content = text(event.content, 800);
  const location = text(event.location, 40);
  const contact = text(event.contact, 80);
  const price = text(event.price, 20);
  const images = Array.isArray(event.images) ? event.images.slice(0, 6) : [];

  assert(CHANNELS.includes(channel), '发布类型无效');
  assert(content.length >= 4, '内容至少 4 个字');
  if (channel !== 'square') assert(title.length >= 2, '请填写标题');

  await checkTextSecurity(openid, [title, content, location, contact, price].filter(Boolean).join('\n'));
  await checkImages(openid, images);

  const status = process.env.MANUAL_REVIEW_POSTS === 'true' ? 'pending' : 'visible';
  const data = {
    authorOpenid: openid,
    authorVerificationStatus: user.verificationStatus || 'none',
    userGender: user.gender || '',
    channel,
    topic: text(event.topic, 24) || 'treehole',
    type: text(event.type, 24) || '',
    category: text(event.category, 24) || '',
    title,
    content,
    location,
    contact,
    price,
    images,
    anonymous: bool(event.anonymous, true),
    status,
    resolved: false,
    pinned: false,
    featured: false,
    likeCount: 0,
    commentCount: 0,
    reportCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection('posts').add({ data });
  await db.collection('users').doc(user._id).update({
    data: {
      postCount: _.inc(1),
      updatedAt: now
    }
  });
  await addAuditLog({
    targetType: 'post',
    targetId: result._id,
    action: 'create',
    operatorOpenid: openid
  });

  return ok({ id: result._id, status });
}

async function listPosts(event, openid) {
  const limit = Math.min(Number(event.limit) || 20, 50);
  const skip = Math.max(Number(event.skip) || 0, 0);
  const where = {
    status: 'visible',
    channel: text(event.channel, 24) || 'square'
  };

  if (event.mine) {
    where.authorOpenid = openid;
    where.status = _.neq('deleted');
  }
  if (event.topic) where.topic = text(event.topic, 24);
  if (event.type) where.type = text(event.type, 24);
  if (event.category) where.category = text(event.category, 24);

  const result = await db
    .collection('posts')
    .where(where)
    .orderBy('pinned', 'desc')
    .orderBy('featured', 'desc')
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get();

  return ok({ posts: result.data });
}

async function getPost(event, openid, user) {
  const id = text(event.id, 80);
  assert(id, '缺少内容 ID');

  const post = await db.collection('posts').doc(id).get().then((res) => res.data);
  assert(post && post.status !== 'deleted', '内容不存在');

  const canView = post.status === 'visible' || post.authorOpenid === openid || isAdmin(user);
  assert(canView, '内容正在审核中');

  await db.collection('posts').doc(id).update({
    data: { viewCount: _.inc(1) }
  });

  const commentWhere = isAdmin(user)
    ? { postId: id, status: _.neq('deleted') }
    : { postId: id, status: 'visible' };
  const comments = await db
    .collection('comments')
    .where(commentWhere)
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();

  return ok({
    post: {
      ...post,
      isOwner: post.authorOpenid === openid,
      viewCount: (post.viewCount || 0) + 1
    },
    comments: comments.data
  });
}

async function likePost(event, openid) {
  const id = text(event.id, 80);
  assert(id, '缺少内容 ID');

  const likeId = `${id}_${openid}`;
  const likeRef = db.collection('likes').doc(likeId);
  const postRef = db.collection('posts').doc(id);
  const now = new Date();
  const existing = await likeRef.get().catch(() => null);

  if (existing && existing.data) {
    await likeRef.remove();
    await postRef.update({
      data: {
        likeCount: _.inc(-1),
        updatedAt: now
      }
    });
    return ok({ liked: false });
  }

  await likeRef.set({
    data: {
      postId: id,
      openid,
      createdAt: now
    }
  });
  await postRef.update({
    data: {
      likeCount: _.inc(1),
      updatedAt: now
    }
  });

  return ok({ liked: true });
}

async function addComment(event, openid) {
  const postId = text(event.id, 80);
  const content = text(event.content, 200);
  assert(postId, '缺少内容 ID');
  assert(content.length >= 2, '评论至少 2 个字');

  const post = await db.collection('posts').doc(postId).get().then((res) => res.data);
  assert(post && post.status === 'visible', '内容暂不可评论');

  await checkTextSecurity(openid, content);

  const now = new Date();
  const status = process.env.MANUAL_REVIEW_COMMENTS === 'true' ? 'pending' : 'visible';
  const result = await db.collection('comments').add({
    data: {
      postId,
      postAuthorOpenid: post.authorOpenid,
      authorOpenid: openid,
      content,
      anonymous: true,
      status,
      likeCount: 0,
      reportCount: 0,
      createdAt: now,
      updatedAt: now
    }
  });

  if (status === 'visible') {
    await db.collection('posts').doc(postId).update({
      data: {
        commentCount: _.inc(1),
        updatedAt: now
      }
    });
  }

  return ok({ id: result._id, status });
}

async function reportTarget(event, openid) {
  const targetType = text(event.targetType, 20) || 'post';
  const targetId = text(event.id, 80);
  const reason = text(event.reason, 80) || '其他违规';
  assert(['post', 'comment'].includes(targetType), '举报类型无效');
  assert(targetId, '缺少内容 ID');

  const reportId = `${targetType}_${targetId}_${openid}`;
  const reportRef = db.collection('reports').doc(reportId);
  const now = new Date();
  const existing = await reportRef.get().catch(() => null);

  let postId = targetId;
  if (targetType === 'comment') {
    const comment = await db.collection('comments').doc(targetId).get().then((res) => res.data);
    assert(comment && comment.status !== 'deleted', '评论不存在');
    postId = comment.postId;
  }

  await reportRef.set({
    data: {
      targetType,
      targetId,
      postId,
      reporterOpenid: openid,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    }
  });

  if (!existing || !existing.data) {
    const collection = targetType === 'post' ? 'posts' : 'comments';
    await db.collection(collection).doc(targetId).update({
      data: {
        reportCount: _.inc(1),
        updatedAt: now
      }
    });
  }

  return ok();
}

async function markResolved(event, openid, user) {
  const id = text(event.id, 80);
  assert(id, '缺少内容 ID');

  const post = await db.collection('posts').doc(id).get().then((res) => res.data);
  assert(post && post.channel === 'lost_found', '只能处理失物招领内容');
  assert(post.authorOpenid === openid || isAdmin(user), '只有发布者或管理员可操作');

  await db.collection('posts').doc(id).update({
    data: {
      resolved: true,
      updatedAt: new Date()
    }
  });

  return ok();
}

async function stats(openid) {
  const posts = await db.collection('posts').where({ authorOpenid: openid }).limit(1000).get();
  const comments = await db.collection('comments').where({ authorOpenid: openid }).limit(1000).get();
  const pending = posts.data.filter((post) => post.status === 'pending').length;
  const pendingComments = comments.data.filter((comment) => comment.status === 'pending').length;
  const likes = posts.data.reduce((sum, post) => sum + (post.likeCount || 0), 0);

  return ok({
    stats: {
      posts: posts.data.length,
      likes,
      pending,
      pendingComments
    }
  });
}

async function adminListPosts(event) {
  const status = text(event.status, 24) || 'pending';
  const limit = Math.min(Number(event.limit) || 50, 100);
  const where =
    status === 'reported'
      ? {
          reportCount: _.gt(0),
          status: _.neq('deleted')
        }
      : { status };

  const result = await db
    .collection('posts')
    .where(where)
    .orderBy(status === 'reported' ? 'reportCount' : 'createdAt', 'desc')
    .limit(limit)
    .get();

  return ok({ items: result.data, posts: result.data });
}

async function adminListComments(event) {
  const status = text(event.status, 24) || 'pending';
  const limit = Math.min(Number(event.limit) || 50, 100);
  const where =
    status === 'reported'
      ? {
          reportCount: _.gt(0),
          status: _.neq('deleted')
        }
      : { status };

  const result = await db
    .collection('comments')
    .where(where)
    .orderBy(status === 'reported' ? 'reportCount' : 'createdAt', 'desc')
    .limit(limit)
    .get();

  return ok({ items: result.data });
}

async function adminListUsers(event) {
  const filter = text(event.status, 24) || 'active';
  const limit = Math.min(Number(event.limit) || 50, 100);
  const where =
    filter === 'verification'
      ? { verificationStatus: 'pending' }
      : filter === 'all'
        ? {}
        : { status: filter };

  const result = await db
    .collection('users')
    .where(where)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  return ok({ items: result.data });
}

async function adminList(event, user) {
  assert(isAdmin(user), '仅管理员可访问');

  const target = text(event.target, 24) || 'posts';
  if (target === 'comments') return adminListComments(event);
  if (target === 'users' || target === 'verifications') return adminListUsers(event);
  return adminListPosts(event);
}

async function auditPost(event, openid) {
  const id = text(event.id, 80);
  const action = text(event.auditAction, 24);
  assert(id, '缺少内容 ID');

  const statusMap = {
    approve: 'visible',
    reject: 'rejected',
    delete: 'deleted',
    restore: 'visible'
  };
  const now = new Date();
  const patch = {
    reviewedAt: now,
    reviewerOpenid: openid,
    updatedAt: now
  };

  if (statusMap[action]) patch.status = statusMap[action];
  if (action === 'pin') patch.pinned = true;
  if (action === 'unpin') patch.pinned = false;
  if (action === 'feature') patch.featured = true;
  if (action === 'unfeature') patch.featured = false;

  assert(Object.keys(patch).length > 3, '审核动作无效');

  await db.collection('posts').doc(id).update({ data: patch });
  await addAuditLog({
    targetType: 'post',
    targetId: id,
    action,
    operatorOpenid: openid
  });

  return ok({ status: patch.status });
}

async function auditComment(event, openid) {
  const id = text(event.id, 80);
  const action = text(event.auditAction, 24);
  assert(id, '缺少评论 ID');

  const comment = await db.collection('comments').doc(id).get().then((res) => res.data);
  assert(comment, '评论不存在');

  const statusMap = {
    approve: 'visible',
    reject: 'rejected',
    delete: 'deleted',
    restore: 'visible'
  };
  const nextStatus = statusMap[action];
  assert(nextStatus, '审核动作无效');

  const now = new Date();
  await db.collection('comments').doc(id).update({
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewerOpenid: openid,
      updatedAt: now
    }
  });

  if (comment.postId && comment.status !== 'visible' && nextStatus === 'visible') {
    await db.collection('posts').doc(comment.postId).update({
      data: {
        commentCount: _.inc(1),
        updatedAt: now
      }
    });
  }
  if (comment.postId && comment.status === 'visible' && nextStatus !== 'visible') {
    await db.collection('posts').doc(comment.postId).update({
      data: {
        commentCount: _.inc(-1),
        updatedAt: now
      }
    });
  }

  await addAuditLog({
    targetType: 'comment',
    targetId: id,
    action,
    operatorOpenid: openid
  });

  return ok({ status: nextStatus });
}

async function audit(event, openid, user) {
  assert(isAdmin(user), '仅管理员可操作');

  const targetType = text(event.targetType, 20) || 'post';
  if (targetType === 'comment') return auditComment(event, openid);
  return auditPost(event, openid);
}

async function setUserStatus(event, openid, user) {
  assert(isAdmin(user), '仅管理员可操作');

  const userId = text(event.userId, 80);
  const status = text(event.status, 20);
  const banReason = text(event.banReason, 120);
  assert(userId, '缺少用户 ID');
  assert(['active', 'banned'].includes(status), '用户状态无效');

  const now = new Date();
  await db.collection('users').doc(userId).update({
    data: {
      status,
      banReason,
      bannedAt: status === 'banned' ? now : null,
      bannedByOpenid: status === 'banned' ? openid : '',
      updatedAt: now
    }
  });

  await addAuditLog({
    targetType: 'user',
    targetId: userId,
    action: status,
    operatorOpenid: openid
  });

  return ok({ status });
}

async function auditVerification(event, openid, user) {
  assert(isAdmin(user), '仅管理员可操作');

  const userId = text(event.userId, 80);
  const action = text(event.auditAction, 24);
  const statusMap = {
    approve: 'verified',
    reject: 'rejected',
    reset: 'none'
  };
  const nextStatus = statusMap[action];
  assert(userId, '缺少用户 ID');
  assert(nextStatus, '认证审核动作无效');

  const now = new Date();
  await db.collection('users').doc(userId).update({
    data: {
      verificationStatus: nextStatus,
      verificationReviewedAt: now,
      verificationReviewerOpenid: openid,
      updatedAt: now
    }
  });

  await addAuditLog({
    targetType: 'verification',
    targetId: userId,
    action,
    operatorOpenid: openid
  });

  return ok({ status: nextStatus });
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const action = text(event.action, 32);
    const user = canReadWithoutRegistration(action, event)
      ? await requireReadableUser(openid)
      : await requireUser(openid);

    switch (action) {
      case 'create':
        return createPost(event, openid, user);
      case 'list':
        return listPosts(event, openid);
      case 'get':
        return getPost(event, openid, user);
      case 'like':
        return likePost(event, openid);
      case 'comment':
        return addComment(event, openid);
      case 'report':
        return reportTarget(event, openid);
      case 'markResolved':
        return markResolved(event, openid, user);
      case 'stats':
        return stats(openid);
      case 'adminList':
        return adminList(event, user);
      case 'audit':
        return audit(event, openid, user);
      case 'setUserStatus':
        return setUserStatus(event, openid, user);
      case 'auditVerification':
        return auditVerification(event, openid, user);
      default:
        return fail('未知操作');
    }
  } catch (error) {
    console.error(error);
    return fail(error.publicMessage || error.message || '服务异常');
  }
};
