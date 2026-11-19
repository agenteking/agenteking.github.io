interface Props {
  name: string;
  widths: number[];
  ratio: number; // ancho / alto
  sizes: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

/** Imagen responsive AVIF/WebP con width/height explícitos (sin CLS). */
export function Picture({ name, widths, ratio, sizes, alt, className, priority }: Props) {
  const set = (ext: string) => widths.map((w) => `/img/${name}-${w}.${ext} ${w}w`).join(", ");
  const w = widths[widths.length - 1] ?? 800;
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <img
        src={`/img/${name}-${widths[0]}.webp`}
        srcSet={set("webp")}
        sizes={sizes}
        width={w}
        height={Math.round(w / ratio)}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
}
