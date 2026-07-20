const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const {
    buildPropertySnapshot,
    buildSystemContent,
} = require('../services/aiPropertySnapshot');
const {
    resolveConversationBuildingFocus,
    collectPrivateRedactionTermsFromProjects,
    extractPropertyListingRefsFromMessage,
} = require('../services/aiBuildingFocus');
const { resolveConversationUnitFocus, sanitizeClientReply, isUnitInterestMessage } = require('../services/aiUnitFocus');
const {
    buildVerificationConsentReply,
    resolveListingRefs,
} = require('../services/aiRestrictedInfo');
const { beginVerification, isVerified, clearSession, markConsentAgreed, getSession } = require('../services/aiVerificationStore');
const { getOtpTriggerQuestionCount } = require('../services/aiVerificationConfig');
const { ensurePolicyInPrompt } = require('../services/aiPolicyPrompt');
const { getOrCreateCompanyProfile, toPublicCompanyProfile } = require('../services/companyProfile');
const {
    isQuestionLimitReached,
    recordTokenUsage,
    recordUserMessage,
    clearUsage,
} = require('../services/aiUsageLimiter');
const { recordDailyTokenUsage } = require('../services/aiTokenUsage');
const {
    clearConversationState,
    conversationBuildingFocus,
    conversationUnitFocus,
    conversations,
    getChatMessages,
    setListingFocus,
} = require('../services/aiConversationState');

const prisma = new PrismaClient();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function trackCompletionUsage(userKey, usage) {
    recordTokenUsage(userKey, usage?.total_tokens || 0);
    recordDailyTokenUsage(prisma, usage).catch((error) => {
        console.error('Failed to persist AI token usage:', error);
    });
}

function conversationHasEnded(text) {
    const endings = [
        'thank you',
        'thanks for reaching out',
        'goodbye',
        'have a great day',
        'take care',
        "you're welcome",
        'see you soon',
    ];

    return endings.some((phrase) => text.toLowerCase().includes(phrase));
}

function rememberListingFocus(userKey, message, buildingFocus, unitFocus, pageUrl = '') {
    const texts = [message, pageUrl].filter(Boolean);

    for (const text of texts) {
        const urlRefs = extractPropertyListingRefsFromMessage(text);
        const lastPropertyUrl = urlRefs[urlRefs.length - 1];

        if (lastPropertyUrl) {
            setListingFocus(userKey, {
                buildingRef: buildingFocus?.buildingRef || lastPropertyUrl.listingRef,
                projectSlug: lastPropertyUrl.projectSlug,
                unitRef: buildingFocus ? null : unitFocus?.unitRef || null,
            });
            return;
        }
    }

    if (buildingFocus?.buildingRef) {
        setListingFocus(userKey, {
            buildingRef: buildingFocus.buildingRef,
            projectSlug: null,
            unitRef: null,
        });
        return;
    }

    if (unitFocus?.unitRef) {
        setListingFocus(userKey, {
            unitRef: unitFocus.unitRef,
            buildingRef: null,
            projectSlug: null,
        });
    }
}

function buildVerificationFocus(userKey, message, activeFocus, pageUrl = '') {
    return resolveListingRefs(activeFocus || {}, {
        pendingMessage: message,
        userKey,
        chatMessages: getChatMessages(userKey),
        pageUrl,
    });
}

function startQuestionLimitVerificationFlow({
    userKey,
    message,
    activeFocus,
    pageUrl,
    chatHistory,
}) {
    const verificationFocus = buildVerificationFocus(userKey, message, activeFocus, pageUrl);

    beginVerification(userKey, {
        topic: 'chat_quota',
        pendingMessage: message,
        buildingRef: verificationFocus.buildingRef,
        unitRef: verificationFocus.unitRef,
        projectSlug: verificationFocus.projectSlug,
        pageUrl: pageUrl || null,
    });
    markConsentAgreed(userKey);

    const consentReply = buildVerificationConsentReply('chat_quota');
    chatHistory.push({ role: 'assistant', content: consentReply });

    return {
        reply: consentReply,
        verificationRequired: true,
        verification: {
            status: getSession(userKey)?.status || 'contact_pending',
            topic: 'chat_quota',
            showConsentActions: false,
            showContactForm: true,
        },
    };
}

exports.getReply = async (req, res) => {
    try {
        const { message, source, senderId, pageUrl } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const aiSettings = await prisma.ai_settings.findFirst();
        const aiPrompt = ensurePolicyInPrompt(
            aiSettings?.prompt || "You are Mr. Boss Realty's helpful real estate assistant.",
        );
        const aiModel = aiSettings?.model || 'gpt-4o-mini';

        const projects = await prisma.projects.findMany({
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

        const companyProfile = toPublicCompanyProfile(await getOrCreateCompanyProfile(prisma));
        const companyContact = {
            phone: companyProfile.phone || '',
            email: companyProfile.email || '',
        };

        const dataText = buildPropertySnapshot(projects);
        const userKey = senderId || source || 'test-user';
        const globalRedactNames = collectPrivateRedactionTermsFromProjects(projects);

        const previousBuildingFocus = conversationBuildingFocus.get(userKey) || null;
        const buildingFocus = resolveConversationBuildingFocus(projects, message, previousBuildingFocus);

        if (buildingFocus) {
            conversationBuildingFocus.set(userKey, { buildingRef: buildingFocus.buildingRef });
            conversationUnitFocus.delete(userKey);
        }

        let unitFocus = null;
        if (!buildingFocus) {
            const previousUnitFocus = conversationUnitFocus.get(userKey) || null;
            unitFocus = resolveConversationUnitFocus(projects, message, previousUnitFocus);

            if (unitFocus) {
                conversationUnitFocus.set(userKey, { unitRef: unitFocus.unitRef });
            }
        }

        const activeFocus = buildingFocus || unitFocus;
        rememberListingFocus(userKey, message, buildingFocus, unitFocus, pageUrl);

        const systemContent = buildSystemContent(aiPrompt, dataText, {
            buildingSummary: buildingFocus?.summary || '',
            unitSummary: unitFocus?.summary || '',
            companyContact,
        });

        if (!conversations.has(userKey)) {
            conversations.set(userKey, [{ role: 'system', content: systemContent }]);
        } else {
            conversations.get(userKey)[0] = { role: 'system', content: systemContent };
        }

        const chatHistory = conversations.get(userKey);
        chatHistory.push({ role: 'user', content: message });
        recordUserMessage(userKey);

        const isWebsiteChat = String(source || '').trim().toLowerCase() === 'website';
        const otpTriggerQuestionCount = isWebsiteChat
            ? await getOtpTriggerQuestionCount()
            : null;
        const otpEnabled = otpTriggerQuestionCount != null;

        // OTP question limit applies to website chat only — not Messenger or admin test.
        if (
            isWebsiteChat
            && otpEnabled
            && !isVerified(userKey)
            && isQuestionLimitReached(userKey, otpTriggerQuestionCount + 1)
        ) {
            return res.json({
                ...startQuestionLimitVerificationFlow({
                    userKey,
                    message,
                    activeFocus,
                    pageUrl,
                    chatHistory,
                }),
                otpVerificationEnabled: true,
                otpTriggerQuestionCount,
            });
        }

        const completion = await openai.chat.completions.create({
            model: aiModel,
            messages: chatHistory,
            temperature: aiSettings?.temperature || 0.3,
        });

        trackCompletionUsage(userKey, completion.usage);

        const aiReply = sanitizeClientReply(
            completion.choices[0].message.content,
            activeFocus,
            {
                stripInterestContactAsk: isUnitInterestMessage(message),
                redactNames: globalRedactNames,
                companyContact,
            },
        );

        chatHistory.push({ role: 'assistant', content: aiReply });

        if (conversationHasEnded(aiReply)) {
            clearConversationState(userKey);
            clearSession(userKey);
            clearUsage(userKey);
        }

        res.json({
            reply: aiReply,
            otpVerificationEnabled: otpEnabled,
            otpTriggerQuestionCount: otpEnabled ? otpTriggerQuestionCount : null,
        });
    } catch (error) {
        console.error('AI error details:', error);
        res.status(500).json({
            error: 'Failed to generate reply.',
            details: error.message || error,
        });
    }
};

function isOtpFlowAssistantMessage(content) {
    const text = String(content || '');
    if (!text) return false;

    return (
        /one-time password|\bOTP\b/i.test(text)
        || /make sure you are a real person/i.test(text)
        || /Under our data privacy policy/i.test(text)
        || /Please enter your mobile number or email/i.test(text)
        || /Please provide your mobile number or email/i.test(text)
        || /We sent a one-time password/i.test(text)
        || /OTP delivery is not configured/i.test(text)
        || /development code shown below/i.test(text)
    );
}

/**
 * After chat-quota OTP succeeds, answer the pending user question that triggered verification.
 */
exports.continueAfterQuotaVerification = async (userKey, pageUrl = '') => {
    const chatHistory = conversations.get(userKey);
    if (!Array.isArray(chatHistory) || chatHistory.length < 2) {
        return null;
    }

    while (chatHistory.length > 1) {
        const last = chatHistory[chatHistory.length - 1];
        if (last.role !== 'assistant' || !isOtpFlowAssistantMessage(last.content)) {
            break;
        }
        chatHistory.pop();
    }

    const pendingUser = [...chatHistory].reverse().find((entry) => entry.role === 'user');
    const message = String(pendingUser?.content || '').trim();
    if (!message) {
        return null;
    }

    const aiSettings = await prisma.ai_settings.findFirst();
    const aiPrompt = ensurePolicyInPrompt(
        aiSettings?.prompt || "You are Mr. Boss Realty's helpful real estate assistant.",
    );
    const aiModel = aiSettings?.model || 'gpt-4o-mini';

    const projects = await prisma.projects.findMany({
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

    const companyProfile = toPublicCompanyProfile(await getOrCreateCompanyProfile(prisma));
    const companyContact = {
        phone: companyProfile.phone || '',
        email: companyProfile.email || '',
    };

    const dataText = buildPropertySnapshot(projects);
    const globalRedactNames = collectPrivateRedactionTermsFromProjects(projects);

    const previousBuildingFocus = conversationBuildingFocus.get(userKey) || null;
    const buildingFocus = resolveConversationBuildingFocus(projects, message, previousBuildingFocus);

    if (buildingFocus) {
        conversationBuildingFocus.set(userKey, { buildingRef: buildingFocus.buildingRef });
        conversationUnitFocus.delete(userKey);
    }

    let unitFocus = null;
    if (!buildingFocus) {
        const previousUnitFocus = conversationUnitFocus.get(userKey) || null;
        unitFocus = resolveConversationUnitFocus(projects, message, previousUnitFocus);

        if (unitFocus) {
            conversationUnitFocus.set(userKey, { unitRef: unitFocus.unitRef });
        }
    }

    const activeFocus = buildingFocus || unitFocus;
    rememberListingFocus(userKey, message, buildingFocus, unitFocus, pageUrl);

    const systemContent = buildSystemContent(aiPrompt, dataText, {
        buildingSummary: buildingFocus?.summary || '',
        unitSummary: unitFocus?.summary || '',
        companyContact,
    });
    chatHistory[0] = { role: 'system', content: systemContent };

    const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: chatHistory,
        temperature: aiSettings?.temperature || 0.3,
    });

    trackCompletionUsage(userKey, completion.usage);

    const aiReply = sanitizeClientReply(
        completion.choices[0].message.content,
        activeFocus,
        {
            stripInterestContactAsk: isUnitInterestMessage(message),
            redactNames: globalRedactNames,
            companyContact,
        },
    );

    chatHistory.push({ role: 'assistant', content: aiReply });

    if (conversationHasEnded(aiReply)) {
        clearConversationState(userKey);
        clearSession(userKey);
        clearUsage(userKey);
    }

    return aiReply;
};
