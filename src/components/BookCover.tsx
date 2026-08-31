"use client";

import Image from "next/image";
import { useState } from "react";

interface BookCoverProps {
  id: number;
  title: string;
  coverPath?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function BookCover({ id, title, coverPath, className = "", priority = false, sizes }: BookCoverProps) {
  const fallback = `/covers/${id}.svg`;
  const [failed, setFailed] = useState(false);
  const src = failed ? fallback : coverPath || fallback;

  return (
    <Image
      src={src}
      alt={`${title}封面`}
      width={300}
      height={420}
      priority={priority}
      sizes={sizes}
      unoptimized
      onError={() => {
        if (src !== fallback) setFailed(true);
      }}
      className={className}
    />
  );
}
