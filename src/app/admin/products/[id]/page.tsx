'use client';

import { useParams } from 'next/navigation';
import ProductEditor from '@/components/admin/ProductEditor';

export default function EditProduct() {
  const params = useParams();
  return <ProductEditor productId={params.id as string} />;
}
