import arcjet, { tokenBucket, shield, detectBot } from "@arcjet/node";

// Arcjet is a real, cloud-backed rate limiter with a real quota. Automated
// tests share one IP+UA characteristic across potentially dozens of runs in
// a short window (this suite alone drives the OTP-gated auth flow directly,
// unlike before), so without this they'd trip real rate limits and fail for
// reasons that have nothing to do with what each test is actually checking.
// Bypassing Arcjet entirely in tests is the standard pattern for this exact
// problem — don't let CI depend on a live third-party service's quota.
const isTestEnv = process.env.NODE_ENV === "test";

/**
 * Initialize Arcjet for Bun + Express
 * Tracks by source IP (Arcjet's built-in fingerprint) plus user-agent as a
 * secondary signal. IP alone would previously have been skipped in favor of
 * user-agent only, which meant every client sharing a UA string shared one
 * rate-limit bucket and the limit was trivially bypassed by rotating the header.
 */
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",

  characteristics: [
    "ip.src",
    "http.request.headers['user-agent']",
  ],

  rules: [
    shield({
      mode: "LIVE",
    }),

    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
      ],
    }),

    tokenBucket({
      mode: "LIVE",
      refillRate: 100,
      interval: 600,
      capacity: 100,
    }),
  ],
});

/**
 * Global Arcjet middleware
 * ✅ Skips /health endpoint
 */
export const globalArcjet = async (req, res, next) => {
  if (isTestEnv) {
    return next();
  }

  if (req.path === "/health" || req.path === "/api/v1/health") {
    return next();
  }

  try {
    const decision = await aj.protect(req, {
      requested: 1,
    });

    res.set("X-Arcjet-Decision", decision.conclusion);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const resetTime = decision.limits?.[0]?.resetTime || Date.now() + 60000;
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        });
      }

      if (decision.reason.isBot()) {
        return res.status(403).json({
          success: false,
          message: "Bot traffic detected. Access denied.",
        });
      }

      return res.status(403).json({
        success: false,
        message: "Request denied by security rules.",
      });
    }

    next();
  } catch (error) {
    console.error("❌ Arcjet error:", error.message);
    next();
  }
};

/**
 * Auth rate limiting: 5 attempts per 15 minutes
 */
const authAj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",
  characteristics: ["ip.src", "http.request.headers['user-agent']"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 900,
      capacity: 5,
    }),
  ],
});

export const authArcjet = async (req, res, next) => {
  if (isTestEnv) {
    return next();
  }

  try {
    const decision = await authAj.protect(req, { requested: 1 });

    const remaining = decision.limits?.[0]?.remaining ?? 5;
    const resetTime = decision.limits?.[0]?.resetTime ?? (Date.now() + 900000);

    res.set("X-RateLimit-Limit", "5");
    res.set("X-RateLimit-Remaining", remaining.toString());

    if (decision.isDenied()) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      console.warn(`⚠️  Auth rate limit exceeded. Retry after: ${retryAfter}s`);

      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again later.",
        retryAfter: Math.max(1, retryAfter),
      });
    }

    next();
  } catch (error) {
    console.error("❌ Auth Arcjet error:", error.message);
    next();
  }
};

/**
 * OTP rate limiting: 3 attempts per hour
 */
const otpAj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",
  characteristics: ["ip.src", "http.request.headers['user-agent']"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 3,
      interval: 3600,
      capacity: 3,
    }),
  ],
});

export const otpArcjet = async (req, res, next) => {
  if (isTestEnv) {
    return next();
  }

  try {
    const decision = await otpAj.protect(req, { requested: 1 });

    const remaining = decision.limits?.[0]?.remaining ?? 3;
    const resetTime = decision.limits?.[0]?.resetTime ?? (Date.now() + 3600000);

    res.set("X-RateLimit-Limit", "3");
    res.set("X-RateLimit-Remaining", remaining.toString());

    if (decision.isDenied()) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      console.warn(`⚠️  OTP rate limit exceeded. Retry after: ${retryAfter}s`);

      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please try again later.",
        retryAfter: Math.max(1, retryAfter),
      });
    }

    next();
  } catch (error) {
    console.error("❌ OTP Arcjet error:", error.message);
    next();
  }
};

/**
 * OTP *verify* rate limiting: 15 attempts per hour — deliberately separate
 * from otpArcjet (send/resend). That bucket is tightly limited (3/hour) to
 * stop email-sending abuse, but verify-otp was sharing it too — a couple of
 * genuine typos while entering a 6-digit code could burn through the same
 * budget needed to request a fresh OTP, locking a real user out of both
 * retrying and resending for a full hour. Typos are expected; they
 * shouldn't cost the same as triggering an actual email send.
 */
const otpVerifyAj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",
  characteristics: ["ip.src", "http.request.headers['user-agent']"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 15,
      interval: 3600,
      capacity: 15,
    }),
  ],
});

export const otpVerifyArcjet = async (req, res, next) => {
  if (isTestEnv) {
    return next();
  }

  try {
    const decision = await otpVerifyAj.protect(req, { requested: 1 });

    const remaining = decision.limits?.[0]?.remaining ?? 15;
    const resetTime = decision.limits?.[0]?.resetTime ?? (Date.now() + 3600000);

    res.set("X-RateLimit-Limit", "15");
    res.set("X-RateLimit-Remaining", remaining.toString());

    if (decision.isDenied()) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      console.warn(`⚠️  OTP verify rate limit exceeded. Retry after: ${retryAfter}s`);

      return res.status(429).json({
        success: false,
        message: "Too many verification attempts. Please try again later.",
        retryAfter: Math.max(1, retryAfter),
      });
    }

    next();
  } catch (error) {
    console.error("❌ OTP verify Arcjet error:", error.message);
    next();
  }
};

/**
 * Message rate limiting: 50 messages per minute
 */
const msgAj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",
  // messageArcjet always runs after `protect`, so the authenticated user id
  // is available and is a stronger key than IP/UA for a per-account limit.
  characteristics: ["ip.src", "userId"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 50,
      interval: 60,
      capacity: 50,
    }),
  ],
});

export const messageArcjet = async (req, res, next) => {
  if (isTestEnv) {
    return next();
  }

  try {
    const decision = await msgAj.protect(req, {
      requested: 1,
      userId: req.user?.userId || req.user?._id?.toString() || "anonymous",
    });

    const remaining = decision.limits?.[0]?.remaining ?? 50;
    const resetTime = decision.limits?.[0]?.resetTime ?? (Date.now() + 60000);

    res.set("X-RateLimit-Limit", "50");
    res.set("X-RateLimit-Remaining", remaining.toString());

    if (decision.isDenied()) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      console.warn(`⚠️  Message rate limit exceeded. Retry after: ${retryAfter}s`);

      return res.status(429).json({
        success: false,
        message: "Too many messages. Please slow down.",
        retryAfter: Math.max(1, retryAfter),
      });
    }

    next();
  } catch (error) {
    console.error("❌ Message Arcjet error:", error.message);
    next();
  }
};