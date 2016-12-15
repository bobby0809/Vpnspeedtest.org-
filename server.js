var http = require("http");
var url = require('url');
var fs = require('fs');
var io = require('socket.io')();
var privacy_test_map = JSON.parse(fs.readFileSync('vpnprivacytest_vpns.json', 'utf8'));


var last_speedtest_result = 'none';


var localhost_server = http.createServer(function(request, response){
    var path = decodeURI(url.parse(request.url, true).pathname);
    console.log(path);

    if (request.method == 'POST') {
        console.log("POST");
        var body = '';
        request.on('data', function (data) {
            body += data;
            console.log("Partial body: " + body);
        });
        request.on('end', function () {
            console.log("Body: " + body);
            last_speedtest_result = body;
            io.emit('newspeedtest', {'message': body});
        });
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end('post received');
    }
});

var server = http.createServer(function(request, response){
    var path = decodeURI(url.parse(request.url, true).pathname);
    console.log(path);

    if (request.method == 'POST') {
        response.writeHead(404);
        response.write("you cannot post from the interwebs - 404");
        response.end();
    }
    else
    {
        if (path == '/') {
            path = "/index.html";
        }
        if (path.startsWith("..") || path.startsWith("//")) {
            response.writeHead(404);
            response.write("oooooops this doesn't exist - 404");
            response.end();
        }
        else if (path.startsWith("/logs/")) {
            if (!path.endsWith(".json")) {
                path += ".gz";      //all text files except .json have .gz extension
            }
            fs.readFile(__dirname + path, function(error, data){
                console.log("Dir=" + __dirname);
                console.log("Path=" + path)
                if (error){
                    response.writeHead(404);
                    response.write("hmmmm close - 404");
                    response.end();
                }
                else{
                    var response_headers = {"Content-Type": "text/plain"};
                    if (path.endsWith(".gz")) {
                        response_headers["Content-Encoding"] = "gzip";
                    }
                    response.writeHead(200, response_headers);
                    response.write(data);
                    response.end();
                }
            });
        }
        else if (path.startsWith("/js/")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "text/javascript"});
                    response.write(data, "utf8");
                    response.end();
                }
            });
        }
        else if (path.endsWith(".css")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "text/css"});
                    response.write(data, "utf8");
                    response.end();
                }
            });
        }
        else if (path.startsWith("/img/") || path.startsWith("/badges/") || path.startsWith("/logos/")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "image/png"});
                    response.write(data);
                    response.end();
                }
            });
        }
        else if (path.endsWith(".html")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "text/html"});
                    response.write(data, "utf8");
                    response.end();
                }
            });
        }
        else if (path.endsWith(".csv")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "text/plain"});
                    response.write(data, "utf8");
                    response.end();
                }
            });
        }
        else if (path.endsWith(".zip")) {
            fs.readFile(__dirname + path, function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oooooops this doesn't exist - 404");
                    response.end();
                }
                else{
                    response.writeHead(200, {"Content-Type": "application/zip"});
                    response.write(data);
                    response.end();
                }
            });
        }
        else {
            response.writeHead(404);
            response.write("oooooops this doesn't exist - 404");
            response.end();
        }
    }
});

localhost_server.listen(7777, '127.0.0.1');
server.listen(3000);

//the socket.io stuff
var listener = io.listen(server);
listener.sockets.on('connection', function(socket){

    //send the latest test result when a client connects
    socket.emit('newspeedtest', {'message': last_speedtest_result});

    //send an overall summary for a VPN
    socket.on('gauges-overview', function(vpn){
        console.log('gauges-overview', vpn);
            
        var request = require('request');
        var headers = {'Content-Type': '--data-urlencode'};
        var options = {
            url: 'http://localhost:8086/query?pretty=true',
            method: 'GET',
            headers: headers,
            qs: {'db': 'vst3', 'q': 'select MEAN("https-download-speed"),MEAN("p2p-download-speed"),MEAN("dns-lookup-time"),MEAN("vpn-connection-time"),COUNT("https-download-speed"),COUNT("p2p-download-speed") from speedtest where vpn=\''+vpn+'\''}
        };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // Print out the response body
                console.log(body);
                
                try {
                    var data = JSON.parse(body);
            
                    var results = data.results;
                    var series = results[0]['series'];
                    var values = series[0]['values'];
                    var avg_https = values[0][1];
                    var avg_p2p = values[0][2];
                    var avg_dns = values[0][3];
                    var avg_conn = values[0][4];
                    var count_https_results = values[0][5];
                    var count_p2p_results = values[0][6];
                    console.log(avg_https, avg_p2p, avg_dns, avg_conn, count_https_results, count_p2p_results);
                    var num_results = parseInt(count_https_results) + parseInt(count_p2p_results);
                    //only send the response to the socket that made the request (not all clients)
                    io.to(socket.id).emit('gauges-overview', {'vpn': vpn, 'avg_https':avg_https, 'avg_p2p':avg_p2p, 'avg_dns':avg_dns, 'avg_conn':avg_conn, 'num_results':num_results});
                }
                catch (err) {
                    console.log("ERROR! " + err.message);
                }
            }
        })
    });
    
    //send detailed summaries for a vpn
    socket.on('gauges-detailed', function(vpn){
        console.log('gauges-detailed', vpn);
        
        var request = require('request');
        var headers = {'Content-Type': '--data-urlencode'};
        var options = {
            url: 'http://localhost:8086/query?pretty=true',
            method: 'GET',
            headers: headers,
            qs: {'db': 'vst3', 'q': 'select MEAN("https-download-speed"),MEAN("p2p-download-speed") from speedtest where vpn=\''+vpn+'\' group by location'}
            };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                
                try {
                    var data = JSON.parse(body);
                    var series = data.results[0]['series'];
            
                    var return_data = {};
            
                    for (len = series.length, i=0; i<len; ++i) {
                        var speed_data = series[i];
                        console.log(i, speed_data);
                        var test_location = speed_data['tags']['location'];
                        //var test_location = tags['location'];
                        console.log(test_location);
                        var values = speed_data['values'][0];
                        console.log(values);
                
                        var speeds = {'https':values[1], 'p2p':values[2]};
                        return_data[test_location] = speeds;
                    }
                    console.log(return_data);
                    //only send the response to the socket that made the request (not all clients)
                    io.to(socket.id).emit('gauges-detailed', return_data);
                }
                catch (err) {
                    console.log("ERROR! " + err.message);
                }
            }
        })
    });
    
    //send all the results for a vpn and location (to draw a line graph)
    socket.on('graph', function(data){
        console.log('graph', data);
        var vpn = data.vpn;
        var location= data.location;
        
        var request = require('request');
        var headers = {'Content-Type': '--data-urlencode'};
        var options = {
            url: 'http://localhost:8086/query?pretty=true',
            method: 'GET',
            headers: headers,
            qs: {'db': 'vst3', 'q': 'select "https-download-speed","p2p-download-speed","log-results","time" from speedtest where vpn=\''+vpn+'\' and location=\''+location+'\''}
            };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                
                try {
                    var data = JSON.parse(body);
                    var series = data.results[0]['series'];
                    var values = series[0]['values'];
                    console.log(values);
                    
                    var speedtest_data = [];
                    for (len = values.length, i=0; i<len; ++i) {
                        speedtest_data[i] = {
                            time: values[i][0],
                            https_speed: values[i][1],
                            p2p_speed: values[i][2],
                            results: values[i][3]
                        };
                    }

                    //only send the response to the socket that made the request (not all clients)
                    io.to(socket.id).emit('graph', speedtest_data);
                }
                catch (err) {
                    console.log("ERROR! " + err.message);
                }
            }
        })
    });
    
    //send the results.json file from the speedtest
    socket.on('result', function(filename){
        console.log('result', filename);
        fs.readFile(__dirname + '/logs/' + filename, 'utf-8', function(error, data){
            if (error){
                console.log('Error:', error);
            }
            else{
                console.log(data);
                io.to(socket.id).emit('result', data);
            }
        });
    });
    
    //send the total number of test results
    socket.on('counter', function(data){
        console.log('counter');
            
        var request = require('request');
        var headers = {'Content-Type': '--data-urlencode'};
        var options = {
            url: 'http://localhost:8086/query?pretty=true',
            method: 'GET',
            headers: headers,
            qs: {'db': 'vst3', 'q': 'select COUNT("https-download-speed"),COUNT("p2p-download-speed") from speedtest'}
        };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // Print out the response body
                console.log(body);
                
                try {
                    var data = JSON.parse(body);
            
                    var results = data.results;
                    var series = results[0]['series'];
                    var values = series[0]['values'];
                    var count_https_results = values[0][1];
                    var count_p2p_results = values[0][2];
                    console.log(count_https_results, count_p2p_results);
                    var num_results = parseInt(count_https_results) + parseInt(count_p2p_results);
                    //only send the response to the socket that made the request (not all clients)
                    io.to(socket.id).emit('counter', num_results);
                }
                catch (err) {
                    console.log("ERROR! " + err.message);
                }
            }
        })
    });
    
    //send the privacy data for selected VPN
    socket.on('privacy-vpn', function(vpn){
        console.log('privacy-vpn', vpn);
            
        try {
            
            vpn_info = privacy_test_map[vpn];
            console.log(vpn_info)
            
            //only send the response to the socket that made the request (not all clients)
            io.to(socket.id).emit('privacy-vpn', vpn_info);

        }
        catch (err) {
            console.log("ERROR! " + err.message);
        }
    });
    
    //send the privacy data for selected VPN
    socket.on('privacy-vpnlist', function(){
        console.log('privacy-vpnlist');
            
        try {
            
            var vpn_keys = [];

            for (var key in privacy_test_map) {
                if (privacy_test_map.hasOwnProperty(key)) {
                    vpn_keys.push(key);
                }
            }
            
            vpn_keys.sort();
            
            //vpn_keys = privacy_test_map.keys();
            console.log(vpn_keys)
            
            //only send the response to the socket that made the request (not all clients)
            io.to(socket.id).emit('privacy-vpnlist', vpn_keys);

        }
        catch (err) {
            console.log("ERROR! " + err.message);
        }
    });
});


