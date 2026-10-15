import { OzilBlogIndex } from "@/components/ozil-goal/blog";
import { ozilBlogMetadata } from "@/components/ozil-goal/blog-metadata";

export function generateMetadata() { return ozilBlogMetadata(); }
export default function Page() { return <OzilBlogIndex />; }
