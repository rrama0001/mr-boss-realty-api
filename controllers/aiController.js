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
    detectRestrictedInfoRequest,
    buildVerificationConsentReply,
    buildVerifiedRestrictedReply,
    collectLocationRedactionTermsFromProjects,
    isAiPrivacyRefusalReply,
    resolveListingRefs,
    RESTRICTED_TOPICS,
} = require('../services/aiRestrictedInfo');
const { beginVerification, isVerified, clearSession } = require('../services/aiVerificationStore');
const { isOtpVerificationEnabled } = require('../services/aiVerificationConfig');
const { ensurePolicyInPrompt } = require('../services/aiPolicyPrompt');
const {
    isQuotaExceeded,
    recordTokenUsage,
    recordUserMessage,
    clearUsage,
} = require('../services/aiUsageLimiter');
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

function startVerificationConsentFlow({
    userKey,
    message,
    activeFocus,
    pageUrl,
    chatHistory,
    restrictedRequest,
}) {
    const verificationFocus = buildVerificationFocus(userKey, message, activeFocus, pageUrl);

    beginVerification(userKey, {
        topic: restrictedRequest.topic,
        pendingMessage: message,
        buildingRef: verificationFocus.buildingRef,
        unitRef: verificationFocus.unitRef,
        projectSlug: verificationFocus.projectSlug,
        pageUrl: pageUrl || null,
    });

    const consentReply = buildVerificationConsentReply(restrictedRequest.topic);
    chatHistory.push({ role: 'assistant', content: consentReply });

    return {
        reply: consentReply,
        verificationRequired: true,
        verification: {
            status: 'consent_pending',
            topic: restrictedRequest.topic,
            showConsentActions: true,
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

        const locationRedactTerms = collectLocationRedactionTermsFromProjects(projects);
        const globalRedactTerms = [...globalRedactNames, ...locationRedactTerms];

        const systemContent = buildSystemContent(aiPrompt, dataText, {
            buildingSummary: buildingFocus?.summary || '',
            unitSummary: unitFocus?.summary || '',
        });

        if (!conversations.has(userKey)) {
            conversations.set(userKey, [{ role: 'system', content: systemContent }]);
        } else {
            conversations.get(userKey)[0] = { role: 'system', content: systemContent };
        }

        const chatHistory = conversations.get(userKey);
        chatHistory.push({ role: 'user', content: message });
        recordUserMessage(userKey);

        const restrictedRequest = detectRestrictedInfoRequest(message);
        const focusContext = {
            userKey,
            pendingMessage: message,
            chatMessages: getChatMessages(userKey),
            pageUrl,
        };

        if (restrictedRequest && isVerified(userKey)) {
            const verificationFocus = buildVerificationFocus(userKey, message, activeFocus, pageUrl);
            const verifiedReply = buildVerifiedRestrictedReply(
                restrictedRequest.topic,
                verificationFocus,
                projects,
                focusContext,
            );
            chatHistory.push({ role: 'assistant', content: verifiedReply });

            return res.json({
                reply: verifiedReply,
                verificationRequired: false,
                otpVerificationEnabled: isOtpVerificationEnabled(),
            });
        }

        if (isOtpVerificationEnabled() && restrictedRequest && !isVerified(userKey)) {
            return res.json({
                ...startVerificationConsentFlow({
                    userKey,
                    message,
                    activeFocus,
                    pageUrl,
                    chatHistory,
                    restrictedRequest,
                }),
                otpVerificationEnabled: true,
            });
        }

        if (isOtpVerificationEnabled() && !isVerified(userKey) && isQuotaExceeded(userKey)) {
            return res.json({
                ...startVerificationConsentFlow({
                    userKey,
                    message,
                    activeFocus,
                    pageUrl,
                    chatHistory,
                    restrictedRequest: {
                        topic: 'chat_quota',
                        label: 'continued AI chat access',
                    },
                }),
                otpVerificationEnabled: true,
            });
        }

        const completion = await openai.chat.completions.create({
            model: aiModel,
            messages: chatHistory,
            temperature: aiSettings?.temperature || 0.3,
        });

        recordTokenUsage(userKey, completion.usage?.total_tokens || 0);

        const aiReply = sanitizeClientReply(
            completion.choices[0].message.content,
            activeFocus,
            {
                stripInterestContactAsk: isUnitInterestMessage(message),
                redactNames: globalRedactTerms,
            },
        );

        if (isOtpVerificationEnabled() && !isVerified(userKey) && isAiPrivacyRefusalReply(aiReply)) {
            const fallbackRequest = restrictedRequest || {
                topic: 'address',
                label: RESTRICTED_TOPICS.address.label,
            };

            return res.json({
                ...startVerificationConsentFlow({
                    userKey,
                    message,
                    activeFocus,
                    pageUrl,
                    chatHistory,
                    restrictedRequest: fallbackRequest,
                }),
                otpVerificationEnabled: true,
            });
        }

        chatHistory.push({ role: 'assistant', content: aiReply });

        if (conversationHasEnded(aiReply)) {
            clearConversationState(userKey);
            clearSession(userKey);
            clearUsage(userKey);
        }

        res.json({
            reply: aiReply,
            otpVerificationEnabled: isOtpVerificationEnabled(),
        });
    } catch (error) {
        console.error('AI error details:', error);
        res.status(500).json({
            error: 'Failed to generate reply.',
            details: error.message || error,
        });
    }
};
