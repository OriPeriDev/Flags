const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {

  socket.on('gameDisconnect', () => {
    let room = rooms.find(room => room.users.includes(socket.id));
    if (room) {
      room.users = room.users.filter(id => id !== socket.id);
      room.number--;
      if (room.number === 0) {
        rooms = rooms.filter(r => r.code !== room.code);
      } else {
        const remainingUser = room.users[0];
        io.to(remainingUser).emit('winlose', 'dis');
        rooms = rooms.filter(r => r.code !== room.code);
      }
    }
  });


  socket.on('find', (data) => {
    let room = rooms.find(room => room.number < 2);
    if (room === undefined) {
      room = { code: generateRoomCode(), number: 1, users: [socket.id], names:[data.name], pfp:[data.pfp], answers: [null, null], answer: null };
      rooms.push(room);
    } else {
      room.number = 2;
      room.users.push(socket.id);
      room.names.push(data.name);
      room.pfp.push(data.pfp);

      op =1
      room.users.forEach(user => {
        
        io.to(user).emit('start', {name: room.names[op], pfp:room.pfp[op]});
        op=0;
      });
    }
    socket.join(room.code);
    socket.emit('roomAssignedCode', room.code);

  });

  socket.on('flag', async () => {
    let room = rooms.find(room => room.users.includes(socket.id));
    if (room && room.users[0] === socket.id) {  // Only the host emits the 'flag' event
      
      const countryData = await getRandomCountry();

      const { countryCode, countryName, additionalCountries } = countryData;
      room.answer = countryName;
      // Create an array with countryName and additionalCountries
      const allCountries = [countryName, ...additionalCountries];

      // Shuffle the array (Fisher-Yates shuffle algorithm)
      for (let i = allCountries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCountries[i], allCountries[j]] = [allCountries[j], allCountries[i]];
      }
      room.users.forEach(user => {
        io.to(user).emit('quiz', { countryCode, countryNames: allCountries });
      });
    }
  });

  socket.on('countryClicked', async (answer) => {
    let room = rooms.find(room => room.users.includes(socket.id));
    if (room) {
      if (room.users[0] === socket.id) {
        me = 0;
      } else {
        me = 1;
      }
      if (room.answers[me] === null) {
        room.answers[me] = answer;
        var op = (me-1)*-1;
        if(room.answers[me]===room.answer){
          io.to(room.users[me]).emit('colors', [0, 1]); // 0: you, 1: right green
          io.to(room.users[op]).emit('colors', [1,1]); // 1: else, 1: right green
        } else{
          io.to(room.users[me]).emit('colors', [0, 0]); // 0: you, 0: wrong red
          io.to(room.users[op]).emit('colors', [1,0]); // 1: else, 0: wrong red
        }
        // if(room.answers[0]===room.answer){
        //   io.to(room.users[0]).emit('colors', [0, 1]); // 0: you, 1: right green
        //   io.to(room.users[1]).emit('colors', [1,1]); // 1: else, 1: right green
        // } else{
        //   io.to(room.users[0]).emit('colors', [0, 0]); // 0: you, 0: wrong red
        //   io.to(room.users[1]).emit('colors', [1,0]); // 1: else, 0: wrong red
        // }
        // if(room.answers[1]===room.answer){
        //   io.to(room.users[0]).emit('colors', [1, 1]);
        //   io.to(room.users[1]).emit('colors', [0,1]);
        // }else{
        //   io.to(room.users[0]).emit('colors', [1, 0]);
        //   io.to(room.users[1]).emit('colors', [0,0]);
        // }
      }
      if (room.answers[0] !== null && room.answers[1] !== null) { // Both users have clicked
        if (room.answers[0] === room.answer && room.answers[1] !== room.answer) {
          io.to(room.users[0]).emit('winlose', 'w');
          io.to(room.users[1]).emit('winlose', 'l');
          rooms = rooms.filter(r => r.code !== room.code);
        } else if (room.answers[0] !== room.answer && room.answers[1] === room.answer) {
          io.to(room.users[0]).emit('winlose', 'l');
          io.to(room.users[1]).emit('winlose', 'w');
          rooms = rooms.filter(r => r.code !== room.code);
        } else {
          room.answers = [null, null]; // Reset answers
          const countryData = await getRandomCountry();

          const { countryCode, countryName, additionalCountries } = countryData;
          room.answer = countryName;
          // Create an array with countryName and additionalCountries
          const allCountries = [countryName, ...additionalCountries];

          // Shuffle the array (Fisher-Yates shuffle algorithm)
          for (let i = allCountries.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCountries[i], allCountries[j]] = [allCountries[j], allCountries[i]];
          }
          setTimeout(function () {
            room.users.forEach(user => {
              io.to(user).emit('quiz', { countryCode, countryNames: allCountries });
            });
          }, 460);
          
        }
      }
    }
  });

});

var rooms = []

async function getRandomCountry() {
  const url = 'https://flagcdn.com/en/codes.json';

  try {
    // Fetch JSON data
    const response = await fetch(url);
    const data = await response.json();

    const entries = Object.entries(data).filter(([code, name]) => {
      // Exclude entries like US states
      return !code.startsWith('us-'); // Exclude US states
      // You can add more filters here if needed for other non-country codes
    });

    // Generate random index
    const randomIndex = Math.floor(Math.random() * entries.length);

    // Get random entry [countryCode, countryName]
    const [countryCode, countryName] = entries[randomIndex];

    // Get 3 additional random country names (excluding the selected country)
    const additionalCountries = [];
    while (additionalCountries.length < 3) {
      const additionalIndex = Math.floor(Math.random() * entries.length);
      if (additionalIndex !== randomIndex) {
        additionalCountries.push(entries[additionalIndex][1]);
      }
    }

    return {
      countryCode,
      countryName,
      additionalCountries
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (rooms.some(room => room.code === code)) {
    return generateRoomCode();
  }
  return code;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
