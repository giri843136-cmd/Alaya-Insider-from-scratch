import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-semibold text-gray-200 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-accent mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8">The page you are looking for does not exist or has been moved.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors">
            Go Home
          </Link>
          <Link href="/products" className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:border-accent transition-colors">
            Browse Products
          </Link>
        </div>
        <div className="mt-8 flex items-center justify-center gap-4 text-sm text-gray-400">
          <Link href="/journal" className="hover:text-accent">Guides</Link>
          <Link href="/categories" className="hover:text-accent">Categories</Link>
          <Link href="/contact" className="hover:text-accent">Contact</Link>
        </div>
      </div>
    </div>
  );
}
