var http = require('http');
var httpProxy = require('http-proxy');
var QRCode = require('qrcode')
var crypto = require('crypto');
var fs = require('fs');

var algorithm = 'aes-256-ctr';
var password = 'd6F3Efeq';

//user credentials
var usrName = 'milordBox';
var usrPass = 'test';

//var hashedID = crypto.createHash('md5').update(p2id).digest('hex');
//console.log("hashedID",hashedID);

var proxy = httpProxy.createProxyServer({});

var testPort = 8140;
var authCheckPort = 8141;

/*functions*/
function encrypt(text){
  var cipher = crypto.createCipher(algorithm,password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
function decrypt(text){
  var decipher = crypto.createDecipher(algorithm,password)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

//0c9ac0807b3e3721691baa5ca4bb52cafd1dd4e59fe9d87355bc417ec1c86a6a9a05c09acbdf921088897275e040ccc4fe05fae9
function getUrlFromHash(hash){
	var newURL = decrypt(hash);
	console.log("newURL", newURL);
}

function addAuthCode(code, codeType){
	var fullFile = {'sentCodes': [], 'recievedCodes': []};
	fs.exists('authcodes.json', (exists) => {
		if(exists){
			fs.readFile('authcodes.json', (err, data) => {
				if(err){
					console.log("err",err);
				}
				else{
					fullFile = JSON.parse(data);
					fullFile[codeType].push(code);
					var json = JSON.stringify(fullFile);
					fs.writeFile('authcodes.json', json, err => {
						if(err){
							console.log("err",err);
						}
						else{
							console.log("file saved successfully");
						}
					});
				}
			});
		}
		else{
			console.log("file needs to be made");
			fullFile[codeType].push(code);
			var json = JSON.stringify(fullFile);
			fs.writeFile('authcodes.json', json, err => {
				if(err){
					console.log("err",err);
				}
				else{
					console.log("file saved successfully");
				}
			});
		}
	});
}


function lookUpPromise(code){
	return new Promise((resolve,reject) => {
		fs.exists('authcodes.json', (exists) => {
			if(exists){
				fs.readFile('authcodes.json', (err, data) => {
					if(err){
						console.log("err",err);
						resolve(false);
					}
					else{
						fullFile = JSON.parse(data);
						for(var i in fullFile['sentCodes']){
							if(code == fullFile['sentCodes'][i]){
								console.log("matching!");
								resolve(true);
							}
						}
						resolve(false);
					}
				});
			}
			else{
				console.log("no authcode file made");
				resolve(false);
			}
		});
	});
	
}

async function lookUpCode(code){
	var result = await lookUpPromise(code);
	console.log("result",result);
	return result;
}

//ip and hash stored in QR code
//first connect message gets pinged, asks for pass
//send password, if correct, transmits auth hash over to other peer
//now you can ping that computer with ip/hash/signal/auth

//oauth process :)


//http://129.25.30.251/?!sid=2a2e17734dc72336891fd6daef0d0a34&signal=foobar&passhash=1234


//'http://192.168.1.201/newAuth?!sid=0987d89f33755a7f28';
/*this is public facing (port 80), this set only validates and proxies traffic to other servers*/
var gatewayServer = http.createServer(function(req, res) {
	try{
		console.log("req.url",req.url);
		//console.log("req",req);
		var url = req.url.split('?');
		if(url[0] == '/newAuth'){
			console.log("its a newAuth");
			var params = url[1].split('=');
			if(params[0] == '!sid'){
				console.log("we have some !sid");
				var fetchedUsrName = decrypt(params[1]);
				if(fetchedUsrName == usrName){
					console.log("were in business, proxy to auth stuff");
					proxy.web(req, res, { target: `http://127.0.0.1:${authCheckPort}` });
				}
				else{console.log("usrName not matching");}
			}
			else{console.log("not !sid");}
		}
		else{console.log("not /newAuth");}
	}
	catch(err){
		console.log("err",err);
	}

	//recieving POST
	if(req.method == 'POST'){
		var body = '';
        req.on('data', function (data) {
            body += data;
            console.log("Partial body: " + body);
        });
        req.on('end', function () {
            console.log("Body: " + body);

            //if it is a /processAuth, check if the password is correct, if true, generate authCode
            if(req.url == '/processAuth'){
            	var params = body.split('&');
            	var pass = params[0].split('=');
            	if(pass[0] == 'pass'){
            		if(pass[1] == usrPass){
            			console.log("password is same, send hashed authCode");
            			crypto.randomBytes(48, function(err, buffer) {
						  var token = buffer.toString('hex');
						  //save token to file
						  addAuthCode(token, 'sentCodes');
						  res.write(token);
						  res.end();
						});
            		}
            		else{console.log("password doesnt match");}
            	}
            	else{console.log("not pass?");}
            }
            else{console.log("not processAuth");}

        });
	}

	//recieving an actual command, with authCode
	try{
		console.log("req.url",req.url);
		//console.log("req",req);
		var url = req.url.split('?');
		if(url[0] == '/command'){
			var command = '';
			var params = url[1].split('&');
			for(var i in params){
				var set = params[i].split('=');
				if(set[0] == '!sid'){
					if(decrypt(set[1]) == usrName){
						console.log("sid is a match");
					}
					else{
						console.log("sid not matching!");
						command = 'nope';
						//return false
					}
				}
				if(set[0] == 'trigger'){
					command = set[1];
				}
				if(set[0] == 'authCode'){
					if(lookUpCode(set[1])){
						console.log("authCode is a match!");
					}
					else{
						console.log("authcode doesnt match");
						command = 'nope';
						//return false
					}
				}
			}
			//all is clear, issue command!
			res.write(command);
			res.end();
		}
		else{console.log("not /command");}
	}
	catch(err){
		console.log("err",err);
	}


});
gatewayServer.listen(8011);




/*this asks for the user's password, if success, will generate and save a hashed AuthCode*/
var authCheckServer = http.createServer(function(req, res) {
	fs.readFile('./passwordPage.html', function (err, html) {
	    if (err) {
	        throw err; 
	    }
	    res.writeHeader(200, {"Content-Type": "text/html"});  
        res.write(html);  
        res.end();
	});
});
authCheckServer.listen(authCheckPort);




/*the QR code generator for starting the oAuth process*/
var qrGenerator = http.createServer(function(req, res) {
	var code = `http://192.168.1.201/newAuth?!sid=${encrypt(usrName)}` //ip + 'servername'
	var hashedCode = encrypt(code);
	console.log(hashedCode);
	getUrlFromHash(hashedCode);
	res.writeHead(200, {'Content-Type': 'text/html'});
	QRCode.toDataURL(hashedCode, function (err, url) {
	  res.write(`<img src="${url}">`);
	  res.end();
	})
});
qrGenerator.listen(testPort);





