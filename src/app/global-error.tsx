'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <p className="text-6xl font-semibold text-gray-200 mb-4">!</p>
            <h1 className="text-2xl font-semibold text-accent mb-3">Something went wrong</h1>
            <p className="text-gray-500 mb-8">
              The site encountered an error. Please try again.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => reset()}
                className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors"
              >
                Try Again
              </button>
              <a
                href="/"
                className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:border-accent transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
