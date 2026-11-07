import { v2 as cloudinary } from "cloudinary";
import { incomingTransformation, videoFolder } from "@/lib/browse-video";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Short-lived signature for one direct browser-to-Cloudinary video upload. The folder and the trim are inside the signature, so the browser can't change them. */
export function signBrowseVideoUpload(storeId: string, opts: { official: boolean }) {
  const params: Record<string, string | number> = {
    folder: videoFolder(storeId, opts.official),
    transformation: incomingTransformation(opts.official),
    timestamp: Math.round(Date.now() / 1000),
  };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET ?? "");
  return { cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "", apiKey: process.env.CLOUDINARY_API_KEY ?? "", params, signature };
}
