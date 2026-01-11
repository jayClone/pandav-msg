import request from "supertest";
import app from "../app.js";
import User from "../models/User.js";

describe("Auth API Tests", () => {
  const testUser = {
    name: "Test User",
    email: "test@example.com",
    password: "password123"
  };

  // Clean up after tests
  afterAll(async () => {
    await User.deleteMany({});
  });

  // Test 1: Register Works
  describe("POST /api/auth/register", () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    it("should reject duplicate email registration", async () => {
        await User.create(testUser);

        const res = await request(app)
            .post("/api/auth/register")
            .send(testUser);

        expect(res.statusCode).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("user already exist");
    });

    // Test 3: Missing Fields
    it("should reject registration with missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "John" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // Test 4: Login Tests
  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await User.deleteMany({});
      await User.create(testUser);
    });

    it("should login with correct credentials and return token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    // Test 5: Wrong Password Rejected
    it("should reject login with wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword"
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid password");
    });

    it("should reject login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: testUser.password
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // Test 6: Protected Routes
  describe("GET /api/auth/me", () => {
    let token;

    beforeEach(async () => {
      await User.deleteMany({});
      await User.create(testUser);

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        });

      token = loginRes.body.token;
    });

    // Test 7: Token Valid → /me Works
    it("should return user data with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });

    // Test 8: Token Invalid → Access Denied
    it("should reject request with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken123");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject request without token", async () => {
      const res = await request(app)
        .get("/api/auth/me");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});