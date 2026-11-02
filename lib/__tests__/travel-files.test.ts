import { describe, expect, it } from "vitest";
import { sniffFileType, isStoreTravelFile, cleanFileName, travelFolderFor } from "@/lib/travel-files";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("sniffFileType", () => {
  it("recognises PDF, JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffFileType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });
  it("rejects html, executables and empty input", () => {
    expect(sniffFileType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    expect(sniffFileType(bytes())).toBeNull();
  });
});

describe("isStoreTravelFile", () => {
  it("only accepts ids inside this store's travel folder", () => {
    expect(isStoreTravelFile(`${travelFolderFor("s1")}/abc.pdf`, "s1")).toBe(true);
    expect(isStoreTravelFile(`${travelFolderFor("s2")}/abc.pdf`, "s1")).toBe(false);
    expect(isStoreTravelFile(`${travelFolderFor("s1")}/../../s2/x`, "s1")).toBe(false);
    expect(isStoreTravelFile("biznest-kyc/u1/id.jpg", "s1")).toBe(false);
  });
});

describe("cleanFileName", () => {
  it("drops path pieces and control characters and falls back to 'file'", () => {
    expect(cleanFileName("C:\\Users\\me\\passport scan.pdf")).toBe("passport scan.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("a\u0000b.png")).toBe("ab.png");
    expect(cleanFileName("   ")).toBe("file");
  });
});
