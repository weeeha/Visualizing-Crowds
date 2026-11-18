import { createRoot } from 'react-dom/client';
import { RankingApp } from './RankingApp';
import '../styles.css';
import './ranking.css';

createRoot(document.getElementById('root')!).render(<RankingApp />);
