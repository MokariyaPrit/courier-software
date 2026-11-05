'use client';

import { AnjaniBillEditor } from '../AnjaniBillEditor';
import { useParams } from 'next/navigation';

export default function EditAnjaniBillPage() {
  const params = useParams();
  const id = String(params.id || '');
  return <AnjaniBillEditor billId={id} />;
}
