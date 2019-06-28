const http = require('http');
const fs = require('fs');
const prefix = '**[VMA]** -';

module.exports = (args, msg) => {

    if(args[1] === 'install' || args[1] === 'i') {

        if(args[2] === undefined) return msg.channel.send(`${prefix} Specify an addons name.`)

        let download = function(url, dest, cb) {
            var file = fs.createWriteStream(dest);
            var request = http.get(url, function(response) {
              response.pipe(file);
              file.on('finish', function() {
                file.close(cb);  // close() is async, call cb after close completes.
              });
            }).on('error', function(err) { // Handle errors
              fs.unlink(dest); // Delete the file async. (But we don't check the result)
              if (cb) cb(err.message);
            });
        };

        download('http://dl.vdjs.io/a/'+args[2], `./addons/${args[2]}.zip`, function(res, err) {
            if(err) return console.log('Error')

            console.log('idk')
        });

    }
    else if(args[1] === 'uninstall') {

    }
    else if(args[1] === undefined) {
        msg.channel.send('test')
    }
    else {
        msg.channel.send(`${prefix} Invalid argument '${args[1]}'.`)
    }

}