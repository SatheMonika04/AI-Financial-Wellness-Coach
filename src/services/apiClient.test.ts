import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_CONFIG, apiClient, ApiError, ENDPOINTS } from "@/services/apiClient";

describe("authentication API client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 1, name: "Example User", email: "user@example.com" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("posts signup fields as JSON and includes cookie credentials", async () => {
    const payload = { name: "Example User", email: "user@example.com", password: "password-123" };
    await apiClient.post(ENDPOINTS.signup, payload);

    expect(fetch).toHaveBeenCalledWith(
      `${API_CONFIG.baseUrl}${ENDPOINTS.signup}`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("surfaces FastAPI error details instead of swallowing them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: "An account with this email already exists" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(apiClient.post(ENDPOINTS.signup, {})).rejects.toMatchObject({
      name: "Error",
      message: "An account with this email already exists",
      status: 409,
    } satisfies Partial<ApiError>);
  });
});
