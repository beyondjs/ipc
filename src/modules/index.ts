import Child from './child';
import Main from './main';

module.exports = process.send ? new Child() : new Main();
