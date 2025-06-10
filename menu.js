import readline from 'readline';
import { spawn } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let serverProcess = null;
let clientProcess = null;

function showMenu() {
  console.log('\nCorpaBot Menu:');
  console.log('1. Start server');
  console.log('2. Stop server');
  console.log('3. Start client');
  console.log('4. Stop client');
  console.log('5. Exit');
  rl.question('Select an option: ', handleMenu);
}

function handleMenu(option) {
  switch (option.trim()) {
    case '1':
      if (!serverProcess) {
        serverProcess = spawn('npm', ['run', 'dev'], { cwd: 'server', stdio: 'inherit', shell: true });
        serverProcess.on('exit', () => { serverProcess = null; });
      } else {
        console.log('Server already running');
      }
      showMenu();
      break;
    case '2':
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      } else {
        console.log('Server is not running');
      }
      showMenu();
      break;
    case '3':
      if (!clientProcess) {
        clientProcess = spawn('npm', ['run', 'dev'], { cwd: 'client', stdio: 'inherit', shell: true });
        clientProcess.on('exit', () => { clientProcess = null; });
      } else {
        console.log('Client already running');
      }
      showMenu();
      break;
    case '4':
      if (clientProcess) {
        clientProcess.kill();
        clientProcess = null;
      } else {
        console.log('Client is not running');
      }
      showMenu();
      break;
    case '5':
      if (serverProcess) serverProcess.kill();
      if (clientProcess) clientProcess.kill();
      rl.close();
      break;
    default:
      console.log('Invalid option');
      showMenu();
  }
}

showMenu();
