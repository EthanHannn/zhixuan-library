import Link from "next/link";
import { BookCover } from "./BookCover";
import type { BookSummary } from "@/types/catalog";

export function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="group overflow-hidden rounded-[1.4rem] border border-[#ded6c7] bg-white/75 shadow-[0_12px_35px_rgba(58,49,39,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(58,49,39,0.13)]">
      <div className="flex gap-4 p-4">
        <Link href={`/book/${book.id}`} className="relative w-[104px] shrink-0 overflow-hidden rounded-xl bg-[#e5dfd2] shadow-md">
          <BookCover id={book.id} title={book.title} coverPath={book.coverPath} className="aspect-[5/7] h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" sizes="104px" />
          <span className="absolute right-2 top-2 rounded-full bg-[#263e35]/90 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">{book.score.toFixed(1)}</span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col py-1">
          <Link href={`/book/${book.id}`} className="line-clamp-2 font-serif text-lg font-bold leading-6 text-[#263e35] transition hover:text-[#a14f37]">{book.title}</Link>
          <Link href={`/author/${encodeURIComponent(book.author)}`} className="mt-2 w-fit text-sm text-stone-500 transition hover:text-[#a14f37] hover:underline">{book.author}</Link>
          <Link href={`/category/${encodeURIComponent(book.tag1)}`} className="mt-3 w-fit rounded-full bg-[#eef1e9] px-2.5 py-1 text-xs text-[#466657] transition hover:bg-[#dfe9df]">{book.tag1.replace("精校", "")}</Link>
          <div className="mt-auto flex items-center justify-between pt-3 text-xs text-stone-400">
            <span>{book.chapterCount ? `${book.chapterCount.toLocaleString("zh-CN")} 章` : book.size}</span>
            <Link href={book.hasContent ? `/read/${book.id}` : `/book/${book.id}`} className="font-medium text-[#a14f37] transition group-hover:translate-x-0.5">{book.hasContent ? "开始阅读 →" : "查看详情 →"}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
