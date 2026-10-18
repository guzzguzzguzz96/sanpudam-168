import Image, { getImageProps } from "next/image";

export function MediaFrame({
  alt,
  className = "",
  desktopFocalPoint = "50% 50%",
  desktopImage,
  mobileFocalPoint,
  mobileImage,
  placeholderLabel,
  priority = false,
  sizes = "(max-width: 767px) 100vw, 50vw",
}) {
  const fallbackImage = desktopImage ?? mobileImage;
  const desktopPosition = desktopImage?.focalPoint ?? desktopFocalPoint;
  const mobilePosition =
    mobileImage?.focalPoint ?? mobileFocalPoint ?? desktopPosition;
  const mobileSource =
    mobileImage?.src && mobileImage.width && mobileImage.height
      ? getImageProps({
          src: mobileImage.src,
          alt: alt ?? fallbackImage?.alt ?? "",
          width: mobileImage.width,
          height: mobileImage.height,
          sizes,
        }).props
      : null;

  if (!fallbackImage?.src) {
    return (
      <div
        className={`home-media home-media--placeholder ${className}`.trim()}
        role="img"
        aria-label={placeholderLabel}
      >
        <span aria-hidden="true" className="home-media__placeholder-mark" />
        <span className="home-media__placeholder-label">
          {placeholderLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`home-media ${className}`.trim()}
      style={{
        "--home-media-focal-desktop": desktopPosition,
        "--home-media-focal-mobile": mobilePosition,
      }}
    >
      <picture className="home-media__picture">
        {mobileSource ? (
          <source
            media="(max-width: 767px)"
            srcSet={mobileSource.srcSet}
            sizes={mobileSource.sizes}
          />
        ) : null}
        <Image
          alt={alt ?? fallbackImage.alt ?? ""}
          className="home-media__image"
          fill
          preload={priority}
          sizes={sizes}
          src={fallbackImage.src}
        />
      </picture>
    </div>
  );
}
