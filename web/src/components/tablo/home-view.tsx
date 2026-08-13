import type { PublishedPost } from "@/lib/blog";
import { byPopularity, type ViewCounts } from "@/lib/views";

export function postExcerpt(bodyMd: string, maxChars = 130): string {
  const paragraph =
    bodyMd
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find((block) => block !== "" && !block.startsWith("#") && !block.startsWith("-")) ?? "";
  const plain = paragraph
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length <= maxChars ? plain : `${plain.slice(0, maxChars).trimEnd()}…`;
}

export function sidebarPosts(posts: PublishedPost[]): PublishedPost[] {
  return posts.slice(0, 4);
}

export function bottomPosts(posts: PublishedPost[], counts: ViewCounts = {}): PublishedPost[] {
  return byPopularity(posts, counts).slice(0, 3);
}
