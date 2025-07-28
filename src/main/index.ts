import Main from './main';
import Child from './child';

const ipc = process.send ? new Child() : new Main();
