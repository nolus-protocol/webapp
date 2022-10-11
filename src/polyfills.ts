import process from 'process';
import { Buffer } from 'buffer';
import EventEmitter from 'events';

window.Buffer = Buffer;
window.process = process;
window.global = window;
(window as any).EventEmitter = EventEmitter;