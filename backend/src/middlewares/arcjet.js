import arcjet, { tokenBucket, shield, detectBot } from "@arcjet/node";

/**
 * Initialize Arcjet for Bun + Express
 * Uses ONLY user-agent - most reliable characteristic
 */
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",

  // ✅ Fixed: Proper characteristics
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
  // ✅ SKIP ARCJET FOR HEALTH CHECK
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
    // ✅ Continue without Arcjet if it fails
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
  try {
    const decision = await authAj.protect(req, { requested: 1 });

    // ✅ SAFE ACCESS: Check if limits exists
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
    // ✅ Continue WITHOUT rate limiting if Arcjet fails
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
  try {
    const decision = await otpAj.protect(req, { requested: 1 });

    // ✅ SAFE ACCESS
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
 * Message rate limiting: 50 messages per minute
 */
const msgAj = arcjet({
  key: process.env.ARCJET_KEY,
  environment: process.env.ARCJET_ENV || "production",
  characteristics: ["ip.src", "http.request.headers['user-agent']"],
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
  try {
    const decision = await msgAj.protect(req, { requested: 1 });

    // ✅ SAFE ACCESS
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