'use client';

import DestinationSelector from '@/components/public/DestinationSelector';

export default function ProductCTA({ product }: { product: any }) {
  return <DestinationSelector product={product} />;
}
