import { describe, expect, it } from "vitest";
import { cvFolderFor, isStoreCvRef, makeCvRef, parseCvRef, validateCvValue, cvViewHref, CV_ALLOWED_TYPES } from "@/lib/recruitment-cv";

describe("Recruitment CV storage rules", () => {
  const own = makeCvRef(`${cvFolderFor("store_a")}/jane_cv.pdf`);
  it("round-trips a private ref", () => {
    expect(parseCvRef(own)).toBe(`${cvFolderFor("store_a")}/jane_cv.pdf`);
    expect(parseCvRef("https://x.com/cv.pdf")).toBeNull();
    expect(parseCvRef(null)).toBeNull();
  });
  it("only accepts a private ref from the same store's folder", () => {
    expect(isStoreCvRef(own, "store_a")).toBe(true);
    expect(isStoreCvRef(own, "store_b")).toBe(false);
    expect(isStoreCvRef(makeCvRef("biznest/store_a/recruitment-cvs/../../secret"), "store_a")).toBe(false);
    expect(isStoreCvRef(makeCvRef("biznest/store_a/digital/x.pdf"), "store_a")).toBe(false);
  });
  it("validates stored values", () => {
    expect(validateCvValue("", "store_a")).toBeNull();
    expect(validateCvValue("https://drive.google.com/x", "store_a")).toBeNull();
    expect(validateCvValue(own, "store_a")).toBeNull();
    expect(validateCvValue(own, "store_b")).not.toBeNull();
    expect(validateCvValue("ftp://x", "store_a")).not.toBeNull();
  });
  it("allows PDF/Word only and builds the viewer link", () => {
    expect(CV_ALLOWED_TYPES.has("application/pdf")).toBe(true);
    expect(CV_ALLOWED_TYPES.has("image/png")).toBe(false);
    expect(cvViewHref("acme", "c1")).toBe("/api/store/acme/recruitment/cv?candidateId=c1");
  });
});
