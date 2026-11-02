import { ImageResponse } from "next/og";

/** The header's ½ mark (dark rounded square, white glyph) rendered as a PNG for browser and home-screen icons. */
export function logoImage(size: number, radius: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          borderRadius: radius,
          color: "#fff",
          fontSize: size * 0.56,
          fontWeight: 700,
        }}
      >
        ½
      </div>
    ),
    { width: size, height: size },
  );
}
