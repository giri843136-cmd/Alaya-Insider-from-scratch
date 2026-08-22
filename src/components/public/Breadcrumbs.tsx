import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-gray-400 mb-6">
      <ol className="flex items-center gap-1.5 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <Link href="/" className="hover:text-accent transition-colors" itemProp="item">
            <span itemProp="name">Home</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <span className="text-gray-300">/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-accent transition-colors" itemProp="item">
                <span itemProp="name">{item.label}</span>
              </Link>
            ) : (
              <span className="text-gray-600" itemProp="name">{item.label}</span>
            )}
            <meta itemProp="position" content={String(i + 2)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
