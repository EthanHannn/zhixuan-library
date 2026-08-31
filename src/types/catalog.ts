export interface BookSummary {
  id: number;
  title: string;
  author: string;
  tag1: string;
  tag2: string;
  score: number;
  xiancaoCount: number;
  ducaoCount: number;
  size: string;
  popularity: number;
  hasContent: boolean;
  chapterCount: number;
  coverPath: string | null;
}

export interface CategorySummary {
  name: string;
  count: number;
}
