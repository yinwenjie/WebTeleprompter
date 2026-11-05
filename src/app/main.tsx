import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { App } from './App';
import { createContainer } from './bootstrap';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('找不到 #root 节点');

const container = createContainer(document.documentElement);
container.start();

createRoot(rootElement).render(
  <StrictMode>
    <App stores={container.stores} />
  </StrictMode>,
);
