import { logoImage } from "@/components/logo-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return logoImage(32, 7);
}
