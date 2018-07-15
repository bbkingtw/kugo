const log=console.log
const iconv=require('iconv-lite');
const md5=require('md5');

var b=new Buffer('成功')//e6 88 90 e5 8a 9f
var c=iconv.encode(b,'big5') //a6 a8 a5 5c
var b2=new Buffer(c) //a6 a8 a5 5c
var c2=iconv.decode(b2,'big5')//成功
//return log(b2,c2)

var argv=require('optimist').argv;
var chalk=require('chalk');
var yy=chalk.bgYellow;
var rr=chalk.bgRed;
var _=require('lodash');
var async=require('async')
var sqls=require('./sqls');


oracledb=require('oracledb')
oracledb.resultSet=resultSet;
oracledb.extendedMetaData=true;
oracledb.autoCommit=true;
oracledb.homogeneous=true;
oracledb.poolPingInterval=10;
oracledb.queueTimeout=8000;
oracledb.poolTimeout = 3;
//oracledb.fetchAsString=[oracledb.CLOB];
//oracledb.fetchAsBuffer=[oracledb.BLOB];

var cfg={
	user:'system',
	password:'oracle'
}

var path=require('path')
var express=require('express')
var app=express()
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port=8778
http.listen(port)

if (true){
	mongojs=require('mongojs')
	var db=mongojs('mongodb://localhost:27017/kugo',['manual']);

	for (var sql_id in sqls){
		var obj={sql_id:sql_id, sql:sqls[sql_id],dt:new Date()}
		db.manual.update({sql_id:sql_id}, obj, {upsert:true}); 
	}

	db.manual.find({}, function(err,results){
		log(err,results);
	});
}

io.on('connection', function(socket){
	socket.on('exec', function(sql_id){
		log(rr('------'));
		log(yy('exec sql_id',sql_id));

		exec(cfg, sql_id, function(err,ret){
			inactive(function(err, inact){
				log(rr('inact',inact));
				ret.inact=inact||'na';
				log(yy('ret'),ret);
				socket.emit('data', ret);
			});
		});
	})

	socket.on('execSQL', function(sql){
		log(yy('execSQL',sql));

		var xsql=sql.replace(/ +/g,' ');
		var sql_id=md5(xsql);
		log(rr('sql_id',sql_id));

		db.manual.find({sql_id:sql_id}, function(err,data){
			if (!err && data.length==0) db.manual.insert({
				dt:new Date(), 
				sql_id:sql_id,
				sql:sql
			}, function(err2, data2){
				go_exec()
			});
			else go_exec()
		});

		function go_exec(){
			exec(cfg, null, function(err,ret){
				inactive(function(err, inact){
					log(rr('inact',inact));
					ret.inact=inact||'na';
					log(yy('ret'),ret);
					socket.emit('data', ret);
				});
			},sql)
		}
	})
});

var resultSet=false;

app.get('/manual/del/:sql_id', function(req,res){
	var sql_id=req.params.sql_id;
	db.manual.remove({sql_id:sql_id}, function(err){
		if (err) return res.send(err.message); else res.send('done');
	});
});

app.get('/manual', function(req,res){
	db.manual.find({},function(err,rows){
		log('rows.length',rows.length,rows);
		res.render('manual.jade',{rows:rows});
	});
});

app.get('/', function(req,res){
	res.render('main.jade',{values:_.keys(sqls)})
});

app.get('/cdn/:file', function(req,res){
	res.sendfile(path.join(__dirname,'cdn',req.params.file));
});

app.get('/files/:file*', function(req,res){
	var file=path.join(__dirname,req.params.file,req.params[0]);
	res.sendfile(file);
});

app.get('/sql_id/:sql_id', function(req,res){
	exec(cfg, req.params.sql_id, function(err,ret){
		if (err) return res.send(err)
		res.send(ret);
	});
});


var pool;
var connection;

function prepare_pool(ret) {
	return function(cb){
		if (!ret.sql) ret.sql=sqls[ret.sql_id]
		//var param=params[ret.sql_id]||{};

		if (pool) {
			//log(yy('reuse pool'));
			return cb(null, ret, pool);
		}
		log(rr('create pool'));

		oracledb.createPool(cfg, function(err,xpool){
			pool=xpool
			if (err) ret.err='create_pool:'+err.message;
			if (err) return cb(null, ret);
			cb(err, ret, pool);
		})	
	}
}

function prepare_connection(ret, pool, cb){
	if (connection) { return cb(null, ret, connection); }
	log(rr('create connection'));

	pool.getConnection(function(err,xconn){
		connection=xconn;

		if (err) {
			ret.err='getConnection:'+err.message;
			return cb(err, ret, connection);
		}
		else cb(null, ret, connection);
	});
}

function parse_sql(ret, connection, cb){
	log(ret.sql);
	connection.getStatementInfo(ret.sql, function(err, info){
		ret.info=info;
		if (err) {
			ret.err='info:'+err.message;
			return cb(err, ret ,connection); 
		}

		var select=info.statementType==oracledb.STMT_TYPE_SELECT
		if (select) ret.act='select'
		else ret.act='non_select';

		ret.select=ret.act=='select';

		cb(err, ret, connection);
	});
}

function execSQL(ret, connection, cb){
	connection.execute(ret.sql, function(err,result){
		ret.result=result;
		if (err) {
			ret.err='execSQL:'+err.message;
		 	return cb(err, ret); 
		}
		log(ret);

		if (ret.select) {
			log('show_detail');
			if (resultSet)
				ret.resultSet.getRows(3, function(err,xrows){
					return cb(err, xrows);
				});
			else {
				var rows=result.rows;
				ret.rows=rows;
				return cb(err, ret);
			}
		}
		else {
			cb(err, ret);
		}
	})
}

//setInterval(getInactive, 10000);

function inactive(cb) {
	var ret={sql_id:'inact'}	
  var acts=[prepare_pool(ret), prepare_connection, parse_sql, execSQL]
	var x=[1,2,3,4,5];
	x=[1]

	go_id('misc', cb);

	if(false) async.mapLimit(x,10,go_id,function(err, ret){
		log('err',err)
		log('ret',new Date(),ret);
		if(err) return cb(err);
		cb(null, ret.cnt);
	});
	
	function go_id(id, cb){
		async.waterfall(acts, function(err, ret){
			if(err) return cb(err);
			var cnt=ret.rows[0][0]
			//cb(err, {id:id, cnt:cnt})
			cb(err, cnt);
		})
	}
};

function str(x) {
	return JSON.stringify(x)
}

function logx(x){
	log(rr('======'));
	log(str(x));
	process.exit(3);
}

function exec(cfg, sql_id, cb, sql) {
	var ret={sql_id:sql_id, sql:sql};

  var acts=[prepare_pool(ret), prepare_connection, parse_sql, execSQL]

	async.waterfall(acts, function(err, ret){
		log(rr('err',err));
		log(yy('ret'),ret);

		if (err) return cb(err, ret)
		
		log('ret.rows', ret.rows);
		if (ret.rows){
			var xxx=ret.rows[0][1]
			log(rr('xxx'),xxx);
			if (xxx) {
				var bbb=new Buffer(xxx)
				log('bbb',bbb);
			}
			else {
				log('no xxx');
			}
		}
		cb(err, ret);
	})

	function show(s){
		return function(err, ret){
			if (cb) return cb(err, ret)
			io.emit('show',{err4:err, ret:ret});
		}
	}
}
