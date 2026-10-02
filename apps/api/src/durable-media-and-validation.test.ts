import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  createDurableMediaToken,
  verifyDurableMediaToken,
  createDurableMediaUrl,
} from "./lib/r2.js";
import { validatePostForTargets } from "./modules/posts/posts.service.js";
import { sanitizeErrorMessage } from "./middleware/errorHandler.js";

describe("Durable Media Tokens & R2 Proxying", () => {
  const samplePayload = {
    mediaAssetId: "b85d38a0-2f6e-4c7b-94d3-112233445566",
    workspaceId: "c12d45e6-7a8b-9c0d-1e2f-334455667788",
    objectKey: "workspaces/c12d45e6/media/sample.jpg",
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour future
  };

  it("successfully signs and verifies a valid token payload", () => {
    const token = createDurableMediaToken(samplePayload);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const verified = verifyDurableMediaToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.mediaAssetId).toBe(samplePayload.mediaAssetId);
    expect(verified?.workspaceId).toBe(samplePayload.workspaceId);
    expect(verified?.objectKey).toBe(samplePayload.objectKey);
  });

  it("rejects an expired token", () => {
    const expiredPayload = {
      ...samplePayload,
      exp: Math.floor(Date.now() / 1000) - 60, // 1 minute in the past
    };
    const token = createDurableMediaToken(expiredPayload);
    const verified = verifyDurableMediaToken(token);
    expect(verified).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createDurableMediaToken(samplePayload);
    const [data, sig] = token.split(".");
    const tampered = `${data}.${sig}tampered`;
    const verified = verifyDurableMediaToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects malformed token inputs without throwing", () => {
    expect(verifyDurableMediaToken("not-a-token")).toBeNull();
    expect(verifyDurableMediaToken("a.b.c")).toBeNull();
    expect(verifyDurableMediaToken("")).toBeNull();
  });

  it("creates a correctly structured durable URL with encoded filename", () => {
    const targetDate = new Date(Date.now() + 30 * 86400 * 1000); // 30 days future
    const url = createDurableMediaUrl(
      samplePayload.workspaceId,
      samplePayload.mediaAssetId,
      samplePayload.objectKey,
      "test image (1).png",
      targetDate,
    );

    expect(url).toMatch(
      /\/api\/v1\/media\/durable\/[^/]+\/test%20image%20\(1\)\.png$/,
    );
  });
});

describe("Provider Capability Validation (Matrix)", () => {
  const dummyImage = { kind: "IMAGE", originalName: "photo.jpg" };
  const dummyVideo = { kind: "VIDEO", originalName: "clip.mp4" };

  describe("Facebook validation rules", () => {
    const fbChannel = [{ provider: "facebook", name: "FB Page" }];

    it("accepts valid single photo post", () => {
      expect(() =>
        validatePostForTargets("Valid text", [dummyImage], fbChannel),
      ).not.toThrow();
    });

    it("accepts valid multi-photo album up to 10 photos", () => {
      const tenImages = Array(10).fill(dummyImage);
      expect(() =>
        validatePostForTargets("10 photos", tenImages, fbChannel),
      ).not.toThrow();
    });

    it("rejects more than 10 photos", () => {
      const elevenImages = Array(11).fill(dummyImage);
      expect(() =>
        validatePostForTargets("11 photos", elevenImages, fbChannel),
      ).toThrow(/maximum of 10 photos/i);
    });

    it("rejects mixed images and videos", () => {
      expect(() =>
        validatePostForTargets("Mixed", [dummyImage, dummyVideo], fbChannel),
      ).toThrow(/mixing images and videos/i);
    });

    it("rejects multiple videos", () => {
      expect(() =>
        validatePostForTargets("Two videos", [dummyVideo, dummyVideo], fbChannel),
      ).toThrow(/multiple videos/i);
    });

    it("rejects text exceeding 63,206 characters", () => {
      const longText = "a".repeat(63207);
      expect(() =>
        validatePostForTargets(longText, [], fbChannel),
      ).toThrow(/cannot exceed 63,206 characters/i);
    });
  });

  describe("Instagram validation rules", () => {
    const igChannel = [{ provider: "instagram", name: "IG Business" }];

    it("rejects text-only posts without media", () => {
      expect(() =>
        validatePostForTargets("Text only", [], igChannel),
      ).toThrow(/requires at least one image or video attachment/i);
    });

    it("accepts post with image", () => {
      expect(() =>
        validatePostForTargets("Caption", [dummyImage], igChannel),
      ).not.toThrow();
    });

    it("rejects carousel with more than 10 items", () => {
      const elevenImages = Array(11).fill(dummyImage);
      expect(() =>
        validatePostForTargets("Caption", elevenImages, igChannel),
      ).toThrow(/maximum of 10 media items/i);
    });

    it("rejects caption exceeding 2,200 characters", () => {
      const longCaption = "a".repeat(2201);
      expect(() =>
        validatePostForTargets(longCaption, [dummyImage], igChannel),
      ).toThrow(/cannot exceed 2,200 characters/i);
    });
  });

  describe("Threads validation rules", () => {
    const threadsChannel = [{ provider: "threads", name: "Threads Account" }];

    it("rejects posts exceeding 500 characters", () => {
      const longText = "a".repeat(501);
      expect(() =>
        validatePostForTargets(longText, [], threadsChannel),
      ).toThrow(/cannot exceed 500 characters/i);
    });

    it("accepts post under 500 characters", () => {
      expect(() =>
        validatePostForTargets("Short thread", [], threadsChannel),
      ).not.toThrow();
    });

    it("rejects attachments exceeding 10 media items", () => {
      const elevenImages = Array(11).fill(dummyImage);
      expect(() =>
        validatePostForTargets("Thread", elevenImages, threadsChannel),
      ).toThrow(/maximum of 10 media items/i);
    });
  });

  describe("LinkedIn validation rules", () => {
    const liChannel = [{ provider: "linkedin-page", name: "LinkedIn Company" }];

    it("rejects posts exceeding 3,000 characters", () => {
      const longText = "a".repeat(3001);
      expect(() =>
        validatePostForTargets(longText, [], liChannel),
      ).toThrow(/cannot exceed 3,000 characters/i);
    });

    it("rejects mixed images and videos", () => {
      expect(() =>
        validatePostForTargets("Post", [dummyImage, dummyVideo], liChannel),
      ).toThrow(/mixing images and videos/i);
    });

    it("rejects multiple videos", () => {
      expect(() =>
        validatePostForTargets("Post", [dummyVideo, dummyVideo], liChannel),
      ).toThrow(/multiple videos/i);
    });

    it("rejects more than 9 images", () => {
      const tenImages = Array(10).fill(dummyImage);
      expect(() =>
        validatePostForTargets("Post", tenImages, liChannel),
      ).toThrow(/maximum of 9 images/i);
    });

    it("accepts valid 9 images", () => {
      const nineImages = Array(9).fill(dummyImage);
      expect(() =>
        validatePostForTargets("Post", nineImages, liChannel),
      ).not.toThrow();
    });
  });
});

describe("Error Message Sanitization (Security & Redaction)", () => {
  it("redacts AWS / R2 presigned URL signature credentials from error output", () => {
    const rawError =
      "Request failed with url https://r2.cloudflarestorage.com/my-bucket/image.jpg?X-Amz-Signature=abcdef1234567890&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE";
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain("abcdef1234567890");
    expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts bearer tokens and api keys from error output", () => {
    const rawError = "Unauthorized: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid";
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts session cookies", () => {
    const rawError = "Failed while sending cookie sm_session=1234567890abcdef1234567890abcdef";
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain("1234567890abcdef1234567890abcdef");
    expect(sanitized).toContain("[REDACTED]");
  });
});
