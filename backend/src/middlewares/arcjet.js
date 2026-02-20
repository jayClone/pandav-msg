import arcjet, { tokenBucket, shield, detectBot } from "@arcjet/node";

/**
 * Initialize Arcjet for Bun + Express
 * Includes: Rate limiting + Bot detection + DDoS protection
 */
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["ip.src"],  // Rate limit by IP
  rules: [
    // ✅ Shield: Protects from SQL injection, XSS, etc
    shield({
      mode: "LIVE",
    }),

    // ✅ Bot Detection: Block malicious bots
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",    // Google, Bing, etc
        "CATEGORY:MONITOR",           // Uptime monitoring
        "CATEGORY:PREVIEW",           // Link previews (Slack, Discord)
      ],
    }),

    // ✅ Global rate limit: 100 requests per 10 minutes
    tokenBucket({
      mode: "LIVE",
      refillRate: 100,
      interval: 600,  // 10 minutes
      capacity: 100,
    }),
  ],
});

/**
 * Global Arcjet middleware
 * Protects against: rate limits, bots, DDoS, SQL injection
 */
export const globalArcjet = async (req, res, next) => {
  try {
    const decision = await aj.protect(req, {
      requested: 1,  // Cost 1 token per request
    });

    // Add headers for debugging
    res.set("X-Arcjet-Decision", decision.conclusion);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(
            (decision.limits[0]?.resetTime - Date.now()) / 1000
          ),
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
    // Graceful degradation: allow request if Arcjet fails
    next();
  }
};

/**
 * Auth rate limiting: 5 attempts per 15 minutes
 */
const authAj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 900,  // 15 minutes
      capacity: 5,
    }),
  ],
});

export const authArcjet = async (req, res, next) => {
  try {
    const decision = await authAj.protect(req, { requested: 1 });

    res.set("X-RateLimit-Limit", 5);
    res.set(
      "X-RateLimit-Remaining",
      decision.limits[0]?.remaining || 0
    );

    if (decision.isDenied()) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again later.",
        retryAfter: Math.ceil(
          (decision.limits[0]?.resetTime - Date.now()) / 1000
        ),
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
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 3,
      interval: 3600,  // 1 hour
      capacity: 3,
    }),
  ],
});

export const otpArcjet = async (req, res, next) => {
  try {
    const decision = await otpAj.protect(req, { requested: 1 });

    res.set("X-RateLimit-Limit", 3);
    res.set(
      "X-RateLimit-Remaining",
      decision.limits[0]?.remaining || 0
    );

    if (decision.isDenied()) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please try again later.",
        retryAfter: Math.ceil(
          (decision.limits[0]?.resetTime - Date.now()) / 1000
        ),
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
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 50,
      interval: 60,  // 1 minute
      capacity: 50,
    }),
  ],
});

export const messageArcjet = async (req, res, next) => {
  try {
    const decision = await msgAj.protect(req, { requested: 1 });

    res.set("X-RateLimit-Limit", 50);
    res.set(
      "X-RateLimit-Remaining",
      decision.limits[0]?.remaining || 0
    );

    if (decision.isDenied()) {
      return res.status(429).json({
        success: false,
        message: "Too many messages. Please slow down.",
        retryAfter: Math.ceil(
          (decision.limits[0]?.resetTime - Date.now()) / 1000
        ),
      });
    }

    next();
  } catch (error) {
    console.error("❌ Message Arcjet error:", error.message);
    next();
  }
};