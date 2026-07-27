import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link href="/">Return home</Link>
    </main>
  );
}
