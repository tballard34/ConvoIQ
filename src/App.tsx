import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>ConvoIQ</h1>
      <p>
        This is an example of serving a React application with jpwcqnriq HarperDB's{' '}
        <a href="https://docs.harperdb.io/docs/reference/components/built-in-extensions#static">
          static component
        </a>
        .
      </p>
      <div className="counter">
        <p className="count">{count}</p>
        <div className="controls">
          <button className="decrement" onClick={() => setCount(count - 1)}>
            -
          </button>
          <button className="increment" onClick={() => setCount(count + 1)}>
            +
          </button>
        </div>
      </div>
    </main>
  );
}

