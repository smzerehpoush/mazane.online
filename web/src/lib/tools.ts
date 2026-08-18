import type { InternalLink } from "./tool-page";

export const TOOLS_HUB_PATH = "/abzarha";

export const TOOLS_HUB_LINK: InternalLink = {
  href: TOOLS_HUB_PATH,
  label: "همه‌ی ابزارهای تابلو",
};

export interface ToolEntry {
  href: string;
  action: string;
  question: string;
  summary: string;
}

/**
 * ⚠️ A tuple of at least two, not `ToolEntry[]`: the hub, the header nav item
 * and the home page's action cards are all built from this list, and a list
 * that shrank to one would leave a hub page that only links to itself — a
 * shape no test would read as broken.
 */
export const TOOLS: readonly [ToolEntry, ToolEntry, ...ToolEntry[]] = [
  {
    href: "/mohasebe-tala",
    action: "محاسبه‌ی طلای نو",
    question: "اجرت ساخت طلایی که خریدم چقدر بوده؟",
    summary:
      "وزن قطعه و درصدهای روی فاکتور را وارد کنید تا اجرت ساخت، سود فروشنده و مالیات جدا از ارزش خود طلا نوشته شود.",
  },
  {
    href: "/mohasebe-forush-tala",
    action: "محاسبه‌ی فروش دست‌دوم",
    question: "طلای دست‌دومم را بفروشم، چقدر به من می‌دهند؟",
    summary:
      "ارزش طلای قطعه از روی وزن و عیار حساب می‌شود و می‌بینید چرا اجرت و مالیاتِ روز خرید در مبلغ فروش برنمی‌گردد.",
  },
  {
    href: "/tabdil-mazane",
    action: "تبدیل مظنه به گرم",
    question: "مظنه‌ای که شنیده‌ام چند تومان در گرم می‌شود؟",
    summary:
      "مظنه‌ای را که در بازار شنیده‌اید وارد کنید تا نرخ هر گرم طلای ۱۸ عیار معادلش نوشته شود، و برعکس. تابلو خودش مظنه‌ای اعلام نمی‌کند.",
  },
  {
    href: "/kodam-saku",
    action: "انتخاب سکوی خرید",
    question: "کدام سکو برای من؟",
    summary:
      "به سه پرسش درباره‌ی مبلغ خرید، تحویل فیزیکی و فروش کوتاه‌مدت جواب می‌دهید و می‌بینید کم‌ترین کارمزد اعلامی در همان معیار مال کدام سکوست.",
  },
];
