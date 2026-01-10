import request from "supertest";
import app from "../app";

describe("Health Check API", () => {
  it("status ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
