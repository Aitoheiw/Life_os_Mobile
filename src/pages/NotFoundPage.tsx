import { Link } from 'react-router';
import { Card, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        title="Page introuvable"
        action={
          <Link to="/" className="text-sm text-accent hover:underline">
            Retour à aujourd’hui
          </Link>
        }
      />
    </Card>
  );
}
