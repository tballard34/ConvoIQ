import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900">ConvoIQ</h1>
        <p className="mt-4 text-gray-600">
          This is an example of serving a React application with HarperDB's{' '}
          <a
            href="https://docs.harperdb.io/docs/reference/components/built-in-extensions#static"
            className="text-teal-500 hover:underline"
          >
            static component
          </a>
          .
        </p>
        <div className="mt-8">
          <p className="text-6xl font-bold text-gray-900">{count}</p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setCount(count - 1)}
              className="h-12 w-12 rounded-full bg-red-500 text-2xl font-bold text-white transition hover:scale-110 hover:bg-red-600 active:scale-95"
            >
              -
            </button>
            <button
              onClick={() => setCount(count + 1)}
              className="h-12 w-12 rounded-full bg-teal-500 text-2xl font-bold text-white transition hover:scale-110 hover:bg-teal-600 active:scale-95"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
