import { describe, it, expect } from "vitest";

describe("HF Token Validation", () => {
  it("can access the mmrech/evb-br Space API with the token", async () => {
    const token = process.env.HF_TOKEN;
    expect(token).toBeTruthy();

    const response = await fetch(
      "https://huggingface.co/api/spaces/mmrech/evb-br",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.id).toBe("mmrech/evb-br");
  });
});
