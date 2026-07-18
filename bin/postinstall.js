#!/usr/bin/env node

console.log('\n\x1b[32m=================================================\x1b[0m');
console.log('\x1b[1m\x1b[32m  vroute installed successfully!\x1b[0m');
console.log('\x1b[32m=================================================\x1b[0m\n');

console.log('To complete setup and generate your local SSL Certificate Authority, run:\n');
console.log('  \x1b[36m$ vroute setup\x1b[0m\n');

console.log('Then you can start the background proxy:\n');
console.log('  \x1b[36m$ vroute start\x1b[0m\n');

console.log('And add your first local domain:\n');
console.log('  \x1b[36m$ vroute add myapp.test 3000\x1b[0m\n');

console.log('\x1b[2m* Note: vroute requires ports 80 and 443 to be available to function as a reverse proxy.\x1b[0m\n');
