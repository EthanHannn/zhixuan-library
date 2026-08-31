import { BookCollection } from "@/components/BookCollection";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AuthorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const author = decodeURIComponent(name);
  return <div className="min-h-screen bg-[#f5f1e8]"><SiteHeader /><BookCollection title={author} eyebrow="AUTHOR ARCHIVE" description={`收录 ${author} 在书房中的全部高分作品。`} author={author} /></div>;
}
