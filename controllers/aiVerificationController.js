const { prisma } = require('../prisma/prismaClient');
const {
  buildVerificationCancelReply,
  buildVerificationContactReply,
  buildVerificationDeclinedReply,
  buildVerificationOtpSentReply,
  buildVerificationOtpDevReply,
  buildVerifiedRestrictedReply,
  buildQuotaVerifiedReply,
  isValidMobile,
  normalizeMobileNumber,
} = require('../services/aiRestrictedInfo');
const {
  getSession,
  markConsentAgreed,
  markConsentDeclined,
  generateOtpCode,
  setContact,
  verifyOtp,
} = require('../services/aiVerificationStore');
const { sendOtpSms } = require('../services/smsOtpDelivery');
const { isOtpVerificationEnabled } = require('../services/aiVerificationConfig');
const { getChatMessages } = require('../services/aiConversationState');
const { resetUsage } = require('../services/aiUsageLimiter');
const { saveVerifiedLead } = require('../services/leadService');

async function loadProjects() {
  return prisma.projects.findMany({
    include: {
      buildings: {
        include: {
          units: {
            include: { assets: true },
          },
        },
      },
      deliverables: true,
      assets: true,
    },
  });
}

function verificationPayload(session, extra = {}) {
  return {
    verificationRequired: true,
    verification: {
      status: session?.status || 'consent_pending',
      topic: session?.topic || null,
      ...extra,
    },
  };
}

function activeFocusFromSession(session, userKey) {
  if (!session) return null;

  return {
    buildingRef: session.buildingRef || null,
    unitRef: session.unitRef || null,
    projectSlug: session.projectSlug || null,
    pendingMessage: session.pendingMessage || null,
    pageUrl: session.pageUrl || null,
    userKey,
  };
}

function rejectWhenDisabled(res) {
  if (isOtpVerificationEnabled()) {
    return false;
  }

  res.status(503).json({
    error: 'Mobile OTP verification is currently disabled.',
    otpVerificationEnabled: false,
  });
  return true;
}

exports.postConsent = async (req, res) => {
  try {
    if (rejectWhenDisabled(res)) {
      return;
    }
    const { senderId, source, agreed } = req.body;
    const userKey = senderId || source || 'test-user';
    const session = getSession(userKey);

    if (!session || session.status !== 'consent_pending') {
      return res.status(400).json({ error: 'No pending verification consent.' });
    }

    if (!agreed) {
      markConsentDeclined(userKey);
      return res.json({
        reply: buildVerificationDeclinedReply(),
        verificationRequired: false,
      });
    }

    markConsentAgreed(userKey);
    const updated = getSession(userKey);

    return res.json({
      reply: buildVerificationContactReply(),
      ...verificationPayload(updated, { showContactForm: true }),
    });
  } catch (error) {
    console.error('Verification consent error:', error);
    res.status(500).json({ error: 'Failed to process consent.' });
  }
};

exports.postContact = async (req, res) => {
  try {
    if (rejectWhenDisabled(res)) {
      return;
    }
    const { senderId, source, contact } = req.body;
    const userKey = senderId || source || 'test-user';
    const session = getSession(userKey);

    if (!session || session.status !== 'contact_pending') {
      return res.status(400).json({ error: 'No pending contact request.' });
    }

    const mobile = normalizeMobileNumber(contact);
    if (!isValidMobile(contact)) {
      return res.status(400).json({ error: 'Please provide a valid Philippine mobile number (e.g. 09171234567).' });
    }

    const code = generateOtpCode();

    try {
      const delivery = await sendOtpSms(mobile, code);

      if (!delivery.delivered) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            error: 'We could not send the verification SMS right now. Please try again later.',
          });
        }

        setContact(userKey, mobile, code);
        const updated = getSession(userKey);

        return res.json({
          reply: buildVerificationOtpDevReply(),
          ...verificationPayload(updated, {
            showOtpForm: true,
            devOtpCode: code,
          }),
        });
      }
    } catch (err) {
      console.error('OTP SMS delivery failed:', err);
      return res.status(503).json({
        error: 'We could not send the verification SMS. Check your mobile number or try again in a moment.',
      });
    }

    setContact(userKey, mobile, code);
    const updated = getSession(userKey);

    return res.json({
      reply: buildVerificationOtpSentReply(),
      ...verificationPayload(updated, { showOtpForm: true }),
    });
  } catch (error) {
    console.error('Verification contact error:', error);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
};

exports.postVerifyOtp = async (req, res) => {
  try {
    if (rejectWhenDisabled(res)) {
      return;
    }
    const { senderId, source, code, pageUrl } = req.body;
    const userKey = senderId || source || 'test-user';
    const result = verifyOtp(userKey, code);

    if (!result.ok) {
      const messages = {
        no_pending_otp: 'There is no OTP request in progress. Please start again.',
        expired: 'Your OTP has expired. Please request a new one.',
        invalid: 'That OTP is incorrect. Please try again.',
      };

      return res.status(400).json({
        error: messages[result.reason] || 'OTP verification failed.',
        verificationRequired: true,
        verification: {
          status: 'otp_pending',
          showOtpForm: true,
        },
      });
    }

    const session = result.session;
    resetUsage(userKey);

    try {
      const savedLead = await saveVerifiedLead(prisma, userKey, session);
      if (!savedLead) {
        console.warn('Verified lead was not saved: missing contact in verification session.', { userKey });
      }
    } catch (leadError) {
      console.error('Failed to save verified lead:', leadError?.message || leadError);
    }

    if (session.topic === 'chat_quota') {
      return res.json({
        reply: buildQuotaVerifiedReply(),
        verificationRequired: false,
      });
    }

    const projects = await loadProjects();
    const focusContext = {
      userKey,
      pendingMessage: session.pendingMessage,
      chatMessages: getChatMessages(userKey),
      pageUrl: pageUrl || session.pageUrl || null,
    };
    const reply = buildVerifiedRestrictedReply(
      session.topic,
      activeFocusFromSession(session, userKey),
      projects,
      focusContext,
    );

    return res.json({
      reply,
      verificationRequired: false,
    });
  } catch (error) {
    console.error('Verification OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
};

exports.postCancel = async (req, res) => {
  try {
    if (rejectWhenDisabled(res)) {
      return;
    }
    const { senderId, source } = req.body;
    const userKey = senderId || source || 'test-user';
    markConsentDeclined(userKey);

    return res.json({
      reply: buildVerificationCancelReply(),
      verificationRequired: false,
    });
  } catch (error) {
    console.error('Verification cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel verification.' });
  }
};
