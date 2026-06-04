const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const BLOCKED_WORDS = ['约炮', '裸聊', '网赌', '代考', '办证', '校园贷'];

function cleanProfile(profile = {}) {
  return {
    nickname: String(profile.nickname || '').slice(0, 24),
    avatarUrl: String(profile.avatarUrl || '').slice(0, 300)
  };
}

function text(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function normalizeGender(value) {
  return ['male', 'female'].includes(value) ? value : '';
}

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(message) {
  return { ok: false, message };
}

function checkLocalWords(content) {
  const normalized = String(content || '').toLowerCase();
  const hit = BLOCKED_WORDS.find((word) => normalized.includes(word.toLowerCase()));
  if (hit) throw new Error('内容包含敏感词，请修改后再提交');
}

async function checkTextSecurity(openid, content) {
  if (!content) return;
  checkLocalWords(content);

  const result = await cloud.openapi.security.msgSecCheck({
    openid,
    scene: 2,
    version: 2,
    content
  });

  const suggest = result && result.result && result.result.suggest;
  if (suggest !== 'pass') {
    throw new Error('内容含有敏感词或违规信息，请修改后再提交');
  }
}

exports.main = async (event) => {
  try {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return fail('未获取到 OpenID');
  }

  const users = db.collection('users');
  const now = new Date();
  const existing = await users.where({ openid }).limit(1).get();

  if (existing.data.length) {
    const user = existing.data[0];

    if (event.action === 'register') {
      const nickname = text(event.nickname, 24);
      const gender = normalizeGender(event.gender);
      if (!nickname || !gender) {
        return fail('请填写昵称并选择性别');
      }

      await checkTextSecurity(openid, nickname);
      await users.doc(user._id).update({
        data: {
          nickname,
          gender,
          registered: true,
          registeredAt: user.registeredAt || now,
          updatedAt: now,
          lastLoginAt: now
        }
      });

      return ok({
        user: {
          ...user,
          nickname,
          gender,
          registered: true,
          openid
        }
      });
    }

    if (event.action === 'submitFeedback') {
      if (!user.registered) {
        return fail('请先完成注册');
      }

      const content = text(event.content, 800);
      const contact = text(event.contact, 80);
      if (content.length < 4) {
        return fail('建议内容至少 4 个字');
      }

      await checkTextSecurity(openid, [content, contact].filter(Boolean).join('\n'));
      await db.collection('feedbacks').add({
        data: {
          authorOpenid: openid,
          userId: user._id,
          nickname: user.nickname || '',
          content,
          contact,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        }
      });

      return ok();
    }

    if (event.action === 'updateGender') {
      const gender = normalizeGender(event.gender);
      if (!gender) {
        return fail('请选择性别');
      }

      await users.doc(user._id).update({
        data: {
          gender,
          updatedAt: now,
          lastLoginAt: now
        }
      });

      return {
        ok: true,
        user: {
          ...user,
          gender,
          openid
        }
      };
    }

    if (event.action === 'submitVerification') {
      if (!user.registered) {
        return fail('请先完成注册');
      }

      const verification = {
        school: text(event.school, 40),
        college: text(event.college, 40),
        studentNoSuffix: text(event.studentNoSuffix, 12),
        realNameHint: text(event.realNameHint, 20)
      };

      if (!verification.school || !verification.college || !verification.studentNoSuffix) {
        return fail('请补全认证信息');
      }

      await users.doc(user._id).update({
        data: {
          ...verification,
          verificationStatus: 'pending',
          verificationSubmittedAt: now,
          updatedAt: now
        }
      });

      return {
        ok: true,
        user: {
          ...user,
          ...verification,
          verificationStatus: 'pending'
        }
      };
    }

    if (event.action === 'updateProfile') {
      if (!user.registered) {
        return fail('请先完成注册');
      }

      const profile = cleanProfile(event.profile);
      await users.doc(user._id).update({
        data: {
          ...profile,
          updatedAt: now,
          lastLoginAt: now
        }
      });
      return {
        ok: true,
        user: {
          ...user,
          ...profile,
          openid
        }
      };
    }

    await users.doc(user._id).update({
      data: {
        lastLoginAt: now
      }
    });

    return {
      ok: true,
      user: {
        ...user,
        registered: Boolean(user.registered),
        openid
      }
    };
  }

  if (['submitVerification', 'submitFeedback', 'updateProfile'].includes(event.action)) {
    return fail('请先完成注册');
  }

  const submittedVerification = event.action === 'submitVerification'
    ? {
        school: text(event.school, 40),
        college: text(event.college, 40),
        studentNoSuffix: text(event.studentNoSuffix, 12),
        realNameHint: text(event.realNameHint, 20)
      }
    : null;

  if (submittedVerification) {
    if (
      !submittedVerification.school ||
      !submittedVerification.college ||
      !submittedVerification.studentNoSuffix
    ) {
      return fail('请补全认证信息');
    }
  }

  const newUser = {
    openid,
    role: 'user',
    status: 'active',
    gender: normalizeGender(event.gender),
    registered: event.action === 'register' && Boolean(text(event.nickname, 24)) && Boolean(normalizeGender(event.gender)),
    verificationStatus: submittedVerification ? 'pending' : 'none',
    school: submittedVerification ? submittedVerification.school : '',
    college: submittedVerification ? submittedVerification.college : '',
    studentNoSuffix: submittedVerification ? submittedVerification.studentNoSuffix : '',
    realNameHint: submittedVerification ? submittedVerification.realNameHint : '',
    nickname: event.action === 'register' ? text(event.nickname, 24) : '',
    avatarUrl: '',
    postCount: 0,
    likeReceivedCount: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    verificationSubmittedAt: submittedVerification ? now : null,
    registeredAt: event.action === 'register' ? now : null
  };

  if (event.action === 'register' && !newUser.registered) {
    return fail('请填写昵称并选择性别');
  }

  if (event.action === 'register') {
    await checkTextSecurity(openid, newUser.nickname);
  }

  const result = await users.add({ data: newUser });

  return {
    ok: true,
    user: {
      _id: result._id,
      ...newUser
    }
  };
  } catch (error) {
    console.error(error);
    return fail(error.message || '服务异常');
  }
};
