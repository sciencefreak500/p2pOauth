var http = require('http');
var httpProxy = require('http-proxy');
var crypto = require('crypto');

var port = 8478;
var p2id = 'milordBox';

var hashedID = crypto.createHash('md5').update(p2id).digest('hex');
console.log("hashedID",hashedID);

var proxy = httpProxy.createProxyServer({});


//ip and hash stored in QR code
//first connect message gets pinged, asks for pass
//send password, if correct, transmits auth hash over to other peer
//now you can ping that computer with ip/hash/signal/auth

//oauth process :)


//http://129.25.30.251/?!sid=2a2e17734dc72336891fd6daef0d0a34&signal=foobar&passhash=1234


var publicServer = http.createServer(function(req, res) {
	var parsedURL = [0,0];
	console.log("req.url",req.url);
	try{
		parsedURL = req.url.split('/?!')[1].split('&')[0].split('=');  
	}
	catch(err){
		//console.log("err",err);
		console.log("error, split", err);
	}
	if(parsedURL[0] == 'sid' && parsedURL[1] == hashedID){
		console.log("yup");
		proxy.web(req, res, { target: `http://127.0.0.1:${port}` });
	}
	else{
		console.log("nope");
	}
});

var privateServer = http.createServer(function(req, res) {
	var password = 1234;
	console.log("welcome to the private server", req.url);
	var allParams = req.url.split('/?!')[1].split('&');
	var command = '';

	for(var i in allParams){
		console.log("allParams[i]",allParams[i]);
		var indiv = allParams[i].split('=');
		var key = indiv[0];
		var value = indiv[1];

		if(key == 'sid'){
			if(value != hashedID){
				console.log("didnt match!");
				return;
			}
		}
		else if(key == 'signal'){
			command = value;
			console.log("command",command);
		}
		else if(key == 'passhash'){
			if(value != password){
				console.log("password didnt match!");
				return;
			}
		}
	}

	if(command != ''){
		res.write(command);
		res.end();
	}

});

console.log(`listening on port ${port} and 80`);

publicServer.listen(80);
privateServer.listen(port);