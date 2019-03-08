var express = require('express');
var app = express();
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
app.use(express.static(path.join(__dirname, 'public')));
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var users = {};
var connections = [];
// mongoose.connect('mongodb://localhost:27017/test', {useNewUrlParser: true});
mongoose.connect('mongodb://tranhung2027:Tranhung1996_@ds159840.mlab.com:59840/chatroom', {useNewUrlParser: true});
server.listen(process.env.PORT || 3000, function (err) {
    if (err) throw err;
    console.log("running ..")
});
var db = new Schema({
    nick:String,
    msg: String,
    friends:{type:String, required:false},
},{collection: "userM"});

var UserBD = mongoose.model('userDB',db);

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/index.html");
})

io.on('connection', function (socket) {
    // console.log('connection :' + socket.id);
    UserBD.find({},function(err, docs){
        if(err) throw err;
        socket.emit('load old messages', docs);
    })
    socket.on('users', function(data, callback){
        if(data.userName in users){
            callback(false);
        }else{
            callback(true);
            socket.user = data.userName;
            users[socket.user] = socket;
            updateUser(data.peerId);     
        }
    });

    socket.on('joinroom',(rm)=>{ //join room
        if(rm === ''){
            io.sockets.emit('success', socket.user + " new user has joined ! ");
        }
        else{
            socket.join(rm);
            // console.log(socket)
            // socket.broadcast.in(data).emit('success', socket.user + " new user has joined");
            io.to(rm).emit('success', socket.user + " new user has joined room " + rm);//chat room
            socket.on('typing send',function(data){ //typing send
                socket.broadcast.to(rm).emit('typing',{nick:socket.user,msg:data});
            });
        }
    })

    function updateUser(peerId){
        io.sockets.emit('username',Object.keys(users),peerId);
    }
    socket.on('open box', function(data){
        // console.log(socket)
        users[data].emit('open box username',{nick: socket.user});
    });
    socket.on('my other event', function(data){
        var msg = data.trim();
        io.sockets.in('a').emit('news', {msg: msg, nick: socket.user});
        if (msg.substr(0,3) === '/p ') {
            msg = msg.substr(3);
            var ind = msg.indexOf(' ');
            if(ind !== -1){
                var name = msg.substring(0, ind);
                var msg = msg.substring(ind + 1);
                if(name in users){
                    users[name].emit('private name', {msg: msg, nick: socket.user});
                    // socket.to().emit('private name', {msg: msg, nick: socket.user});
                }else{
                    console.log('Error! user name exit!')
                }
            }else{
                console.log('error! ')
            }
        } else {
            UserBD.find({nick: socket.user},function(err, a){
                if(err) throw err;
                else{
                        new UserBD({
                            nick: socket.user,
                            msg: msg
                        }).save(()=>{
                            let keys = Object.keys(socket.rooms);
                            for(var i = 1; i < keys.length; i++){
                                io.sockets.in(socket.rooms[keys[i]]).emit('news', {msg: msg, nick: socket.user});
                            }
                        })
                    }
                })
            
        }
        
    });
    //send messages one user
    socket.on('send message one', function(data, msgName){
        users[msgName].emit('new message one',{msg: data, nick: socket.user, sendTo: msgName}); // nguoi nhan **
        users[socket.user].emit('new message one',{ msg: data, nick: socket.user, sendTo: msgName}); // nguoi gui **
        // console.log(data +':'+ msgName);
    })
    // socket.broadcast.to('WsoqWiD8j2Z1DOGgAAAD').emit('news', data);
    // socket.on('typing send',function(data){
    //     socket.broadcast.emit('typing',{nick:socket.user,msg:data});
    // });

    socket.on('disconnect', function(data){
        if(!socket.user) return;
        delete users[socket.user];
        updateUser();
    })
});