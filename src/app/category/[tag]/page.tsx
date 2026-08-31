import { BookCollection } from "@/components/BookCollection";
import { SiteHeader } from "@/components/SiteHeader";
import { getCategoryMeta } from "@/lib/catalog";

export default async function CategoryPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag);
  const meta = getCategoryMeta(tag);
  return <div className="min-h-screen bg-[#f5f1e8]"><SiteHeader /><BookCollection title={tag.replace("精校", "")} eyebrow={`${meta.icon} · CATEGORY`} description={meta.description} tag={tag} /></div>;
}
