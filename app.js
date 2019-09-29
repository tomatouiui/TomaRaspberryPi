const Joi = require('joi');
const express = require('express');
const fs = require('fs');
const child_process = require('child_process');
var sudo = require('sudo');
const app = express();
// Johnny-Five for RPi
//const raspi = require('raspi-io');
const raspi = require('pi-io');
const five = require('johnny-five');
const board = new five.Board({io: new raspi()});
var os = require('os');
var ifaces = os.networkInterfaces();
var ipAddress = '';
var PubNub = require('pubnub');
   
pubnub = new PubNub({
    publishKey : 'pub-c-6ec3cc71-ed99-4a02-be91-04d615df3ae0',
    subscribeKey : 'sub-c-560194c2-3c94-11e8-a2e8-d2288b7dcaaf'
});

var servoHolder = new five.Servo({
    pin: 'GPIO18',
    type: "continuous"
  });

var servoHolder2 = new five.Servo({
    pin: 'GPIO17',
    type: "continuous"
  });

board.on('ready', () => {
  console.log('board is ready');
  // Create a new `motion` hardware instance.
  //const motion = new five.Motion('P1-7'); //a PIR is wired on pin 7 (GPIO 4)
  var motion = new five.Motion('GPIO4'); //a PIR is wired on pin 7 (GPIO 4)
  // var servo = new five.Servo({
  //   pin: 'GPIO17',
  //   //type: "continuous"
  // });
  
  servoHolder.to( 130 );
  servoHolder2.to( 80 );

  // 'calibrated' occurs once at the beginning of a session
  motion.on('calibrated', () => {
    console.log('calibrated');
    //servo.to( 90 );
  });

  // Motion detected
  motion.on('motionstart', () => {
    var timestamp1 = Date.parse(new Date());
    getphoto(timetrans(timestamp1));
    console.log('motionstart at '+timetrans(timestamp1));
    //servo.to( 145 );
  });

  // 'motionend' events
  motion.on('motionend', () => {
    console.log('motionend');
    //servo.to( 90 );
  });
  
  //servo.sweep();
});

Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }

    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      console.log(ifname + ':' + alias, iface.address);
      ipAddress = iface.address;
    } else {
      // this interface has only one ipv4 adress
      console.log(ifname, iface.address);
      ipAddress = iface.address;
    }
    ++alias;
  });
});


app.use(express.json());

app.use('/assets', express.static('assets'))
app.use('/dist', express.static('dist'))

app.get('/control',function(req,res){
   res.sendfile(__dirname + '/control.html')
   //res.render('index')
})

const courses = [
    {id:1, name: 'toma'},
    {id:2, name: 'apple'},
    {id:3, name: 'banana'},
];

app.get('/', (req, res) => {
	res.send('hello here is toma~~~');
});

app.get('/api/toot', (req, res) => {
	res.send(courses);
});

app.get('/api/toot/:id', (req, res) => {
	const course = courses.find(c => c.id === parseInt(req.params.id));
	if(!course) res.status(404).send('没找到呀！');
	res.send(course);
});

app.get('/api/holder/:angle', (req, res) => {
  servoHolder.to( req.params.angle );
  res.send(req.params.angle);
});

app.get('/api/holder2/:angle', (req, res) => {
  servoHolder2.to( req.params.angle );
  res.send(req.params.angle);
});

app.get('/api/takephoto/:id', (req, res) => {
	// Run raspistill command to take a photo with the camera module
    let filename = 'photo/image_'+req.params.id+'.jpg';
    let args = ['-o', filename];
    let spawn = child_process.spawn('raspistill', args);

    spawn.on('exit', (code) => {
      console.log('A photo is saved as '+filename+ ' with exit code, ' + code);
        var options = {
		    cachePassword: true,
		    prompt: 'Password, yo? ',
		    spawnOptions: { /* other options for spawn */ }
		};
		var child = sudo([ 'mv', filename, '/var/www/html/wordpress/wp-content/uploads/photo' ], options);
		child.stdout.on('data', function (data) {
		    console.log(data.toString());
		});
      res.send('A photo is saved as /var/www/html/wordpress/wp-content/uploads/'+filename+ ' with exit code, ' + code);
    });

});

app.post('/api/toot', (req, res) => {
	const schema = {
		name: Joi.string().min(3).required()
	};

	const result = Joi.validate(req.body, schema);
	//console.log(result);

	if(result.error){
       //400 bad request
       res.status(400).send(result.error.details[0].message);
       return;
	}
	const course = {
		id: courses.length + 1,
		name: req.body.name
	};
	courses.push(course);
	res.send(course);
});

app.get('/api/posts/:year/:month', (req, res) => {
	res.send(req.params);
	//res.send(req.query);
});

    pubnub.addListener({
        message: function(message) {
            console.log("take photo Message!!");
            console.log(message.message);
            getphoto(message.message);
        },
        presence: function(presenceEvent) {
            // handle presence
        }
    });

    pubnub.subscribe({
        channels: ['takephoto'] 
    });

function getphoto(name){
	// Run raspistill command to take a photo with the camera module
    let filename = 'photo/image_'+name+'.jpg';
    let args = ['-w', '320', '-h', '240','-vf','-o', filename, '-t', '800'];
    let spawn = child_process.spawn('raspistill', args);

    spawn.on('exit', (code) => {
    	var timestamp = Date.parse(new Date());
        console.log('保存一张照片 '+filename+ ' with exit code, ' + code+'. at '+timetrans(timestamp));
        var options = {
		    cachePassword: true,
		    prompt: 'Password, yo?',
		    spawnOptions: { /* other options for spawn */ }
		};
		var child = sudo([ 'mv', filename, '/var/www/html/wordpress/wp-content/uploads/photo' ], options);
		child.stdout.on('data', function (data) {
		    console.log(data.toString());
		});
        console.log('A photo is saved as /var/www/html/wordpress/wp-content/uploads/'+filename+ ' with exit code, ' + code+'. at '+timetrans(timestamp));
        console.log('ipAddress: '+ipAddress);  
          pubnub.publish({
    		    channel: 'photo',
            message: {image: 'http://'+ipAddress+'/wordpress/wp-content/uploads/'+filename, timestamp: timestamp},
    		    //message: {image: filename, timestamp: timestamp},
    		    callback: (m) => {console.log(m);},
    		    error: (err) => {console.log(err);}
    		  });
    });
}

function timetrans(date){
    var date = new Date(date);//如果date为13位不需要乘1000
    var Y = date.getFullYear() + '-';
    var M = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1) + '-';
    var D = (date.getDate() < 10 ? '0' + (date.getDate()) : date.getDate()) + '-';
    var h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
    var m = (date.getMinutes() <10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
    var s = (date.getSeconds() <10 ? '0' + date.getSeconds() : date.getSeconds());
    return Y+M+D+h+m+s;
}

app.listen(3000, () => console.log('i am at 3000'));
