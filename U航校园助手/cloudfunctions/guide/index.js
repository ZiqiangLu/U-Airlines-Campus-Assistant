const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const SERVICE_TYPES = ['courier', 'print'];
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

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.publicMessage = message;
    throw error;
  }
}

function throwPublic(message) {
  const error = new Error(message);
  error.publicMessage = message;
  throw error;
}

function checkLocalWords(content) {
  const normalized = String(content || '').toLowerCase();
  const hit = BLOCKED_WORDS.find((word) => normalized.includes(word.toLowerCase()));
  assert(!hit, '内容包含敏感词，请修改后再提交');
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

async function getCurrentUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function assertActiveUser(openid) {
  assert(openid, '未登录');
  const user = await getCurrentUser(openid);
  assert(!user || user.status !== 'banned', '账号已被封禁');
  return user;
}

async function isAdmin(openid) {
  const user = await getCurrentUser(openid);
  return !!(user && user.role === 'admin' && user.status !== 'banned');
}

async function getConfigDoc(id) {
  return db.collection('system_config').doc(id).get().catch(() => null);
}

async function listServices(type, limit = 20) {
  const where = { status: 'visible' };
  if (type) where.type = type;

  const result = await db
    .collection('guide_services')
    .where(where)
    .orderBy('likeCount', 'desc')
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(Number(limit) || 20, 50))
    .get()
    .catch(() => ({ data: [] }));

  return result.data.map((item) => {
    const { likedOpenids, authorOpenid, ...safeItem } = item;
    return safeItem;
  });
}

async function listAllServices() {
  const [courier, print] = await Promise.all([listServices('courier', 20), listServices('print', 20)]);
  return { courier, print };
}

async function createService(event, openid) {
  await assertActiveUser(openid);

  const type = SERVICE_TYPES.includes(event.type) ? event.type : '';
  const title = text(event.title, 40);
  const location = text(event.location, 60);
  const desc = text(event.desc, 200);
  const contact = text(event.contact, 80);

  assert(type, '请选择类型');
  assert(title.length >= 2, '名称至少 2 个字');
  assert(location.length >= 2, '地点至少 2 个字');
  assert(desc.length >= 4, '说明至少 4 个字');

  await checkTextSecurity(openid, [title, location, desc, contact].filter(Boolean).join('\n'));

  const now = new Date();
  const result = await db.collection('guide_services').add({
    data: {
      type,
      title,
      location,
      desc,
      contact,
      authorOpenid: openid,
      status: 'visible',
      likeCount: 0,
      likedOpenids: [],
      reportCount: 0,
      createdAt: now,
      updatedAt: now
    }
  });

  return ok({
    service: {
      _id: result._id,
      type,
      title,
      location,
      desc,
      contact,
      status: 'visible',
      likeCount: 0,
      reportCount: 0,
      createdAt: now,
      updatedAt: now
    }
  });
}

async function likeService(event, openid) {
  await assertActiveUser(openid);

  const id = text(event.id, 80);
  assert(id, '缺少内容 ID');

  const serviceRef = db.collection('guide_services').doc(id);
  const service = await serviceRef.get().then((res) => res.data).catch(() => null);
  assert(service && service.status === 'visible', '内容不存在');

  const likedOpenids = Array.isArray(service.likedOpenids) ? service.likedOpenids : [];
  const liked = likedOpenids.includes(openid);
  const nextOpenids = liked ? likedOpenids.filter((item) => item !== openid) : [...likedOpenids, openid];
  const likeCount = nextOpenids.length;

  await serviceRef.update({
    data: {
      likedOpenids: nextOpenids,
      likeCount,
      updatedAt: new Date()
    }
  });

  return ok({ id, liked: !liked, likeCount });
}

async function listPayload() {
  const [guideResult, noticeResult, guideServices] = await Promise.all([
    getConfigDoc('guides'),
    getConfigDoc('cauc_notices'),
    listAllServices()
  ]);
  const guideData = guideResult && guideResult.data ? guideResult.data : {};
  const noticeData = noticeResult && noticeResult.data ? noticeResult.data : {};

  return ok({
    groups: Array.isArray(guideData.groups) ? guideData.groups : [],
    notices: Array.isArray(noticeData.items) ? noticeData.items : [],
    noticesUpdatedAt: noticeData.updatedAt || '',
    noticesSourceUrl: noticeData.sourceUrl || '',
    guideServices
  });
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (event.action === 'save') {
      if (!(await isAdmin(openid))) {
        return fail('仅管理员可操作');
      }

      const groups = Array.isArray(event.groups) ? event.groups.slice(0, 20) : [];
      await db.collection('system_config').doc('guides').set({
        data: {
          groups,
          updatedAt: new Date(),
          operatorOpenid: openid
        }
      });
      return ok();
    }

    if (event.action === 'notices') {
      const noticeResult = await getConfigDoc('cauc_notices');
      const noticeData = noticeResult && noticeResult.data ? noticeResult.data : {};
      return ok({
        notices: Array.isArray(noticeData.items) ? noticeData.items : [],
        noticesUpdatedAt: noticeData.updatedAt || '',
        noticesSourceUrl: noticeData.sourceUrl || ''
      });
    }

    if (event.action === 'createService') return createService(event, openid);
    if (event.action === 'likeService') return likeService(event, openid);

    return listPayload();
  } catch (error) {
    console.error(error);
    return fail(error.publicMessage || error.message || '服务异常');
  }
};
