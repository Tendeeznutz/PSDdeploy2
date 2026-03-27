import dynamic from 'next/dynamic';

const HomePage = dynamic(() => import('./HomePage'), {
  loading: () => (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  ),
});

export default function Page() {
  return <HomePage />;
}
