export const MIN_BOOK_SCORE = Number(process.env.MIN_BOOK_SCORE || "7.5");

export const CATEGORY_META: Record<string, { icon: string; accent: string; description: string }> = {
  "都市·娱乐": { icon: "城", accent: "#a5523d", description: "灯火人间，百态生活" },
  "精校玄幻": { icon: "玄", accent: "#6b4e8a", description: "异世大陆，万象奇境" },
  "精校历史": { icon: "史", accent: "#986f35", description: "长河回望，兴替风云" },
  "精校仙侠": { icon: "仙", accent: "#317267", description: "山海问道，御剑长生" },
  "精校科幻": { icon: "星", accent: "#3f6481", description: "星海无垠，未来回声" },
  "精校灵异": { icon: "夜", accent: "#55556f", description: "幽微诡谲，夜读奇谈" },
  "精校游戏": { icon: "游", accent: "#477349", description: "虚实之间，热血征途" },
  "精校奇幻": { icon: "奇", accent: "#72527a", description: "魔法史诗，远方旅途" },
  "精校武侠": { icon: "侠", accent: "#98453d", description: "江湖风雨，快意恩仇" },
  "精校军事": { icon: "兵", accent: "#596548", description: "铁血烽烟，家国纵横" },
  "二次元": { icon: "漫", accent: "#b65d7a", description: "幻想青春，轻盈世界" },
  "精校竞技": { icon: "竞", accent: "#bd6938", description: "赛场争锋，巅峰对决" },
};

export function getCategoryMeta(name: string) {
  return CATEGORY_META[name] || { icon: name.slice(0, 1), accent: "#6f6a5f", description: "馆藏精选作品" };
}
