const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const BLOCKED_WORDS = ['约炮', '裸聊', '网赌', '代考', '办证', '校园贷'];
const CATEGORIES = ['fate', 'study', 'meal', 'sport', 'activity', 'life'];
const TARGET_GENDERS = ['all', 'male', 'female'];

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(message) {
  return { ok: false, message };
}

function text(value, max = 400) {
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
  assert(!hit, '内容包含敏感词，请修改后再发送');
}

async function checkTextSecurity(openid, content) {
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
    throwPublic('内容含有敏感词或违规信息，请修改后再发送');
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

function normalizeGender(value) {
  return ['male', 'female'].includes(value) ? value : '';
}

function todayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function drawLimit(gender) {
  return gender === 'female' ? 2 : 1;
}

async function throwBottle(event, openid, user) {
  const userGender = normalizeGender(user.gender);
  assert(userGender, '请先前往“我的”页面完善性别信息');

  const category = CATEGORIES.includes(event.category) ? event.category : 'fate';
  const targetGender = TARGET_GENDERS.includes(event.targetGender) ? event.targetGender : 'all';
  const title = text(event.title, 40) || '一张缘分签';
  const content = text(event.content, 500);
  assert(content.length >= 4, '内容至少 4 个字');

  await checkTextSecurity(openid, [title, content].join('\n'));

  const now = new Date();
  const result = await db.collection('posts').add({
    data: {
      authorOpenid: openid,
      authorVerificationStatus: user.verificationStatus || 'none',
      channel: 'friend',
      topic: 'bottle',
      type: 'bottle',
      category,
      title,
      content,
      location: '',
      contact: '',
      price: '',
      images: [],
      anonymous: true,
      targetGender,
      userGender,
      bottleStatus: 'active',
      status: 'visible',
      resolved: false,
      pinned: false,
      featured: false,
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now
    }
  });

  await db.collection('users').doc(user._id).update({
    data: {
      postCount: _.inc(1),
      updatedAt: now
    }
  });

  return ok({
    id: result._id,
    message: '缘分签已投递'
  });
}

async function getDrawState(openid, gender) {
  const day = todayKey();
  const id = `${openid}_${day}`;
  const existing = await db.collection('bottle_draws').doc(id).get().catch(() => null);
  const count = existing && existing.data ? existing.data.count || 0 : 0;
  const limit = drawLimit(gender);
  return {
    day,
    id,
    count,
    limit,
    remaining: Math.max(0, limit - count)
  };
}

async function drawBottle(event, openid, user) {
  const myGender = normalizeGender(user.gender);
  assert(myGender, '请先前往“我的”页面完善性别信息');

  const state = await getDrawState(openid, myGender);
  if (state.remaining <= 0) {
    return ok({
      data: null,
      drawState: state,
      message: `今天已经抽完了，${myGender === 'female' ? '女生每天 2 次' : '男生每天 1 次'}`
    });
  }

  const match = {
    channel: 'friend',
    topic: 'bottle',
    type: 'bottle',
    status: 'visible',
    bottleStatus: 'active',
    authorOpenid: _.neq(openid),
    targetGender: _.in(['all', myGender])
  };

  if (CATEGORIES.includes(event.category)) {
    match.category = event.category;
  }

  const result = await db.collection('posts').aggregate().match(match).sample({ size: 1 }).end();
  const bottle = result.list && result.list.length ? result.list[0] : null;

  if (!bottle) {
    return ok({
      data: null,
      drawState: state,
      message: '暂时没有可抽取的内容，换个主题再试'
    });
  }

  const now = new Date();
  const ref = db.collection('bottle_draws').doc(state.id);
  const existing = await ref.get().catch(() => null);
  if (existing && existing.data) {
    await ref.update({
      data: {
        count: _.inc(1),
        updatedAt: now,
        lastBottleId: bottle._id
      }
    });
  } else {
    await ref.set({
      data: {
        openid,
        gender: myGender,
        day: state.day,
        count: 1,
        limit: state.limit,
        lastBottleId: bottle._id,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  await db.collection('posts').doc(bottle._id).update({
    data: {
      viewCount: _.inc(1),
      updatedAt: now
    }
  });

  return ok({
    data: {
      ...bottle,
      viewCount: (bottle.viewCount || 0) + 1
    },
    drawState: {
      ...state,
      count: state.count + 1,
      remaining: Math.max(0, state.remaining - 1)
    },
    message: '成功抽到一张缘分签'
  });
}

async function listLatest(event, openid, user) {
  const myGender = normalizeGender(user.gender);

  const category = CATEGORIES.includes(event.category) ? event.category : '';
  const where = {
    channel: 'friend',
    topic: 'bottle',
    type: 'bottle',
    status: 'visible',
    bottleStatus: 'active'
  };
  where.targetGender = myGender ? _.in(['all', myGender]) : 'all';
  if (category) where.category = category;

  const result = await db
    .collection('posts')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Number(event.limit) || 20, 50))
    .get();

  return ok({ bottles: result.data });
}

async function listMine(openid) {
  const result = await db
    .collection('posts')
    .where({
      authorOpenid: openid,
      channel: 'friend',
      topic: 'bottle',
      status: _.neq('deleted')
    })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return ok({ bottles: result.data });
}

async function reportBottle(event, openid) {
  const id = text(event.id, 80);
  const reason = text(event.reason, 80) || '其他违规';
  assert(id, '缺少内容 ID');

  const reportId = `bottle_${id}_${openid}`;
  const reportRef = db.collection('reports').doc(reportId);
  const existing = await reportRef.get().catch(() => null);
  const now = new Date();

  await reportRef.set({
    data: {
      targetType: 'bottle',
      targetId: id,
      postId: id,
      reporterOpenid: openid,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    }
  });

  if (!existing || !existing.data) {
    await db.collection('posts').doc(id).update({
      data: {
        reportCount: _.inc(1),
        updatedAt: now
      }
    });
  }

  return ok();
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const action = text(event.action, 32);
    const user = action === 'listLatest'
      ? await requireReadableUser(openid)
      : await requireUser(openid);

    if (action === 'throwBottle') return throwBottle(event, openid, user);
    if (action === 'drawBottle') return drawBottle(event, openid, user);
    if (action === 'listLatest') return listLatest(event, openid, user);
    if (action === 'listMine') return listMine(openid);
    if (action === 'drawState') return ok({ drawState: await getDrawState(openid, normalizeGender(user.gender)) });
    if (action === 'report') return reportBottle(event, openid);

    return fail('未知操作');
  } catch (error) {
    console.error(error);
    return fail(error.publicMessage || error.message || '服务异常');
  }
};
