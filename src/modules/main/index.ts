import Main from './main';
import Child from './child';

export /*bundle*/ const ipc = process.send ? new Child() : new Main();
