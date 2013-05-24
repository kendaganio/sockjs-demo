// 1. Dependencies
var http = require('http');
var sockjs = require('sockjs');
var node_static = require('node-static');

// 2. Global Variables
var webSockets, buffer = [], clients = {};


var whisper = function(id, message) {
	if (!clients[id]) return;
	clients[id].write( JSON.stringify(message) );
}

var broadcast = function(message, exclude) {
	for ( var i in clients ) {
		if ( i != exclude ) clients[i].write( JSON.stringify(message) );
	}
}

// 2. Static files server
var static_directory = new node_static.Server(__dirname);

// 3. Usual http stuff
var server = http.createServer();
server.addListener('request', function(req, res) {
    static_directory.serve(req, res);
});
server.addListener('upgrade', function(req,res){
    res.end();
});

// 4. What to do on connection?
var onConnection = function(conn) {
	clients[conn.id] = conn;

	broadcast({ type: 'newUser' }, conn.id);
	whisper(conn.id, { type: 'history', message: buffer, id: conn.id });

	conn.on('data', function onDataCB (data) {
		data = JSON.parse(data);

		if ( data.type == 'text' ) {
			if ( !data.message ) return;

			data.message = data.message.substr(0, 128);

			if ( buffer.length > 15 ) buffer.shift();
		
      buffer.push(data.message);
			broadcast({ type: 'message', message: data.message, id: conn.id });
		}

	});

	conn.on('close', function onCloseCB () {
		delete clients[conn.id];
		broadcast({ type: 'userLeft' });
	});
}

// 5. Run Servers
webSockets = sockjs.createServer();
webSockets.on('connection', onConnection);
webSockets.installHandlers(server, { prefix:'/echo' } );
server.listen(9999, '0.0.0.0');
