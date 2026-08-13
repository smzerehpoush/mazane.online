import { createFileRoute } from "@tanstack/react-router";

import { BlogIndexView, blogIndexHead } from "@/components/content/BlogViews";
import { PageShell } from "@/components/content/PageShell";
import { loadBlogIndex } from "@/lib/content-data";

export const Route = createFileRoute("/blog/")({
  loader: async () => loadBlogIndex(),
  head: () => blogIndexHead(),
  component: BlogIndex,
});

function BlogIndex() {
  const { posts } = Route.useLoaderData();
  return (
    <PageShell>
      <BlogIndexView posts={posts} />
    </PageShell>
  );
}
