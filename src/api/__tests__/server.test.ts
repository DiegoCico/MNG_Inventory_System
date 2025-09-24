import request from "supertest";
import app from "../src/server";

describe("API Routes", () => {
  it("GET /api/hello should return message", async () => {
    const res = await request(app).get("/api/hello");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Hello from Express API!" });
  });

  it("GET / should return root message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("API up");
  });
});
