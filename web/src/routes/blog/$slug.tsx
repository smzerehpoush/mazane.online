import { createFileRoute, notFound } from "@tanstack/react-router";

import { BlogPostView, blogPostHead } from "@/components/content/BlogViews";
import { NotFoundPanel } from "@/components/content/NotFoundPanel";
import { PageShell } from "@/components/content/PageShell";
import { loadBlogPost } from "@/lib/content-data";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await loadBlogPost({ data: { slug: params.slug } });
    if (post === null) throw notFound();
    return post;
  },
  head: ({ loaderData }) => blogPostHead(loaderData),
  component: BlogPostPage,
  notFoundComponent: () => (
    <PageShell>
      <NotFoundPanel
        title="پست یافت نشد"
        note="این نوشته منتشر نشده یا پس گرفته شده است."
      />
    </PageShell>
  ),
});

function BlogPostPage() {
  return (
    <PageShell>
      <BlogPostView post={Route.useLoaderData()} />
    </PageShell>
  );
}
