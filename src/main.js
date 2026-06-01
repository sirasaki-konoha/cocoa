import './style.css';
import { Game } from './game/Game.js';

const root = document.querySelector('#game-root');
const game = new Game(root);

game.init();
